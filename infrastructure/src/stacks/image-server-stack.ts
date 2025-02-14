import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";

interface ImageServerStackProps extends cdk.StackProps {
  environment: string;
  costCenter: string;
  projectName: string;
  imageProcessor: {
    memorySize: number;
    timeout: number;
  };
  cloudfront: {
    priceClass: number;
  };
  cmsStackName: string;
}

/**
 * Image Server Infrastructure Stack
 *
 * This stack manages the serverless image processing infrastructure including:
 * - Lambda function for image processing with streaming response
 * - CloudFront distribution for caching and delivery
 * - CloudWatch monitoring and alerting
 *
 * Dependencies:
 * - CMS stack (for S3 bucket and IAM role)
 *   - SSM Parameter: /${cmsStackName}/media-bucket/name
 *   - SSM Parameter: /${cmsStackName}/image-server/role-arn
 *
 * Exports:
 * - CloudFront URL
 */
export class ImageServerStack extends cdk.Stack {
  public readonly processingFunction: lambda.Function;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: ImageServerStackProps) {
    super(scope, id, props);

    const stackName = id.toLowerCase();

    // Add global project tags first
    cdk.Tags.of(this).add("Project", props.projectName);
    cdk.Tags.of(this).add("Environment", props.environment);
    cdk.Tags.of(this).add("CostCenter", props.costCenter);
    cdk.Tags.of(this).add("Service", "ImageServer");
    cdk.Tags.of(this).add("ManagedBy", "CDK");

    // Import CMS bucket name from SSM parameter
    const cmsBucketName = ssm.StringParameter.valueForStringParameter(
      this,
      `/${props.cmsStackName}/media-bucket/name`
    );

    // Import CMS bucket
    // const cmsBucketName = s3.Bucket.fromBucketName(
    //   this,
    //   "ImportedCMSBucket",
    //   cmsBucketName
    // );

    // Import image server role from CMS stack
    const imageServerRole = iam.Role.fromRoleArn(
      this,
      "ImportedImageServerRole",
      ssm.StringParameter.valueForStringParameter(
        this,
        `/${props.cmsStackName}/image-server/role-arn`
      )
    );

    // Create Lambda function for image processing
    this.processingFunction = new lambda.Function(
      this,
      "ImageProcessingLambda",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        handler: "imageProcessor.handler",
        code: lambda.Code.fromAsset("./lambdas/imageProcessing"),
        timeout: cdk.Duration.seconds(props.imageProcessor.timeout),
        memorySize: props.imageProcessor.memorySize,
        architecture: lambda.Architecture.ARM_64,
        role: imageServerRole, // Use the role from CMS stack
        environment: {
          NODE_OPTIONS: "--enable-source-maps",
          BUCKET_NAME: cmsBucketName,
        },
      }
    );

    // Add specific resource tags
    cdk.Tags.of(this.processingFunction).add("ResourceType", "Lambda");
    cdk.Tags.of(this.processingFunction).add("ResourceName", "ImageProcessor");

    // Create Lambda Function URL with IAM auth
    const processorUrl = this.processingFunction.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.AWS_IAM,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
      cors: {
        allowedOrigins: ["*"],
        allowedHeaders: ["*"],
        allowedMethods: [lambda.HttpMethod.GET],
      },
    });

    // CloudFront Function for Accept header normalization
    const acceptHeaderNormalization = new cloudfront.Function(
      this,
      "AcceptHeaderNormalization",
      {
        code: cloudfront.FunctionCode.fromInline(`
          function handler(event) {
            var request = event.request;
            var headers = request.headers;
            var queryParams = request.querystring;
            var type = 'jpeg';
            
            // 1. Normalize the Accept header
            if (headers.accept) {
              var accept = headers.accept.value;
              if (accept.includes('image/avif')) {
                headers.accept = {value: 'image/avif'};
                type = 'avif';
              } else if (accept.includes('image/webp')) {
                headers.accept = {value: 'image/webp'};
                type = 'webp';
              } else {
                headers.accept = {value: 'image/jpeg'};
                type = 'jpeg';
              }
            }

            // 2. rewrite the URI to include cache key
            var cacheKey = '/img/'+type+'/'+queryParams.uri.value;
            // store cache key in headers for debugging
            headers['x-cache-key'] = {value: cacheKey};
            request.uri = cacheKey;

            return request;
          }
        `),
      }
    );

    // Create an Origin Access Control that tells CloudFront to sign requests (SIGV4)
    const oac = new cloudfront.FunctionUrlOriginAccessControl(
      this,
      "ImageProcessorFunctionUrlOAC",
      {
        originAccessControlName: "ImageProcessorOAC",
        signing: cloudfront.Signing.SIGV4_ALWAYS,
      }
    );

    // CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, "ImageCDN", {
      defaultBehavior: {
        origin: new origins.FunctionUrlOrigin(processorUrl, {
          originShieldEnabled: true,
          originShieldRegion: this.region,
          originAccessControlId: oac.originAccessControlId,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: new cloudfront.CachePolicy(this, "ImageCachePolicy", {
          queryStringBehavior: cloudfront.CacheQueryStringBehavior.allowList(
            "uri",
            "w",
            "h",
            "q",
            "type",
            "meta"
          ),
          headerBehavior: cloudfront.CacheHeaderBehavior.allowList(
            "Accept",
            "X-Cache-Key"
          ),
          cookieBehavior: cloudfront.CacheCookieBehavior.none(),
          enableAcceptEncodingGzip: true,
          enableAcceptEncodingBrotli: true,
          defaultTtl: cdk.Duration.days(365),
          maxTtl: cdk.Duration.days(365),
          minTtl: cdk.Duration.days(365),
        }),
        originRequestPolicy: new cloudfront.OriginRequestPolicy(
          this,
          "ImageOriginRequestPolicy",
          {
            queryStringBehavior:
              cloudfront.OriginRequestQueryStringBehavior.allowList(
                "uri",
                "w",
                "h",
                "q",
                "type",
                "meta" // todo move this to another endpoint
              ),
            headerBehavior: cloudfront.OriginRequestHeaderBehavior.allowList(
              "Accept",
              "X-Cache-Key"
            ),
          }
        ),
        functionAssociations: [
          {
            function: acceptHeaderNormalization,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      },
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
      priceClass: this.getPriceClass(props.cloudfront.priceClass),
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      enableIpv6: true,
    });

    // Add specific resource tags
    cdk.Tags.of(this.distribution).add("ResourceType", "CloudFront");
    cdk.Tags.of(this.distribution).add("ResourceName", "ImageCDN");

    this.processingFunction.addPermission("AllowCloudFrontInvoke", {
      principal: new iam.ServicePrincipal("cloudfront.amazonaws.com"),
      action: "lambda:InvokeFunctionUrl",
      functionUrlAuthType: lambda.FunctionUrlAuthType.AWS_IAM,
      // Restrict to this specific CloudFront distribution using its ARN
      sourceArn: `arn:aws:cloudfront::${cdk.Aws.ACCOUNT_ID}:distribution/${this.distribution.distributionId}`,
    });

    // Set up CloudWatch alarms
    this.setupMonitoring();

    // CloudFormation outputs
    new cdk.CfnOutput(this, "DistributionUrl", {
      value: this.distribution.distributionDomainName,
      description: "CloudFront Distribution URL",
      exportName: `${stackName}-distribution-url`,
    });
  }

  private getPriceClass(priceClass: number): cloudfront.PriceClass {
    switch (priceClass) {
      case 100:
        return cloudfront.PriceClass.PRICE_CLASS_100;
      case 200:
        return cloudfront.PriceClass.PRICE_CLASS_200;
      case 300:
        return cloudfront.PriceClass.PRICE_CLASS_ALL;
      default:
        return cloudfront.PriceClass.PRICE_CLASS_100;
    }
  }

  private setupMonitoring() {
    // Lambda monitoring
    new cloudwatch.Alarm(this, "ProcessorErrorsAlarm", {
      metric: this.processingFunction.metricErrors(),
      threshold: 5,
      evaluationPeriods: 2,
      alarmDescription: "Alert on high error rate in image processing",
    });

    new cloudwatch.Alarm(this, "ProcessorDurationAlarm", {
      metric: this.processingFunction.metricDuration(),
      threshold: this.processingFunction.timeout!.toMilliseconds() * 0.8,
      evaluationPeriods: 2,
      alarmDescription: "Alert when processing time nears timeout",
    });

    // CloudFront monitoring
    new cloudwatch.Alarm(this, "CloudFrontErrorRateAlarm", {
      metric: new cloudwatch.Metric({
        namespace: "AWS/CloudFront",
        metricName: "TotalErrorRate",
        dimensionsMap: {
          DistributionId: this.distribution.distributionId,
        },
        statistic: "Average",
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 2,
      alarmDescription: "Alert on high CloudFront error rate",
    });
  }
}
