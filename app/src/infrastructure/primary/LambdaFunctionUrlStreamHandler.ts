import type { IStreamRequestHandler } from "./interfaces/IStreamRequestHandler.js";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { ResponseStream, isInAWS } from "lambda-stream";
import S3FileLoader from "../secondary/S3FileLoader.js";
import SharpImageProcessor from "../secondary/SharpImageProcessor.js";
import ProcessImageUseCase from "../../application/useCases/ProcessImageUseCase.js";
import { getS3Client } from "./s3ClientProvider.js";
const BUCKET_NAME = process.env.BUCKET_NAME;
const SUCCESS_CACHE_CONTROL =
  "public, max-age=21600, stale-while-revalidate=86400, stale-if-error=86400";
const NOT_FOUND_CACHE_CONTROL =
  "public, max-age=1, stale-while-revalidate=10, stale-if-error=86400";
const ERROR_CACHE_CONTROL = "public, max-age=1";

console.log(process.env.DEV_ONLY_S3_ACCESS_KEY);
console.log(process.env.DEV_ONLY_S3_SECRET_KEY);
console.log(process.env.DEV_ONLY_S3_ENDPOINT);
console.log(process.env.AWS_REGION);
console.log(BUCKET_NAME);

// This is a type for the AWS Lambda streamifyResponse handler
// It's not available in the @types/aws-lambda package, so we define it here
declare global {
  namespace awslambda {
    class HttpResponseStream {
      static from(stream: any, options: any): any;
    }
  }
}

export class LambdaFunctionUrlStreamHandler
  implements IStreamRequestHandler<APIGatewayProxyEventV2, ResponseStream>
{
  constructor() {
    if (!isInAWS()) {
      throw Error(
        "LambdaFunctionUrlStreamHandler must be used in AWS lambda environment"
      );
    }
  }

  async handle(
    event: APIGatewayProxyEventV2,
    responseStream: ResponseStream
  ): Promise<void> {
    try {
      console.log("request", {
        params: event.queryStringParameters,
        headers: event.headers,
      });

      // 1. parse request params
      const rawRequestParams = event.queryStringParameters || {};
      const headerCustomCacheKey = event.headers["x-cache-key"] || "";
      const headerIfNoneMatch = event.headers["if-none-match"];

      // 2. setup s3 file loader
      if (!BUCKET_NAME) throw Error("missing env BUCKET_NAME");
      const s3Client = getS3Client();
      const s3FileLoader = new S3FileLoader({
        bucketName: BUCKET_NAME,
        s3Client,
      });

      // 3. setup image processor
      const imageProcessor = new SharpImageProcessor();

      // 4. run use case
      const useCase = new ProcessImageUseCase({
        fileBodyStreamLoader: s3FileLoader,
        fileMetaLoader: s3FileLoader,
        imageMetadataProcessor: imageProcessor,
        imageProcessor: imageProcessor,
      });
      const useCaseResult = await useCase.execute({
        rawParams: rawRequestParams,
        rawHeaders: event.headers ?? {},
      });

      // 5. handle use case exceptions
      if (!useCaseResult.success) {
        switch (useCaseResult.error.code) {
          case "FILE_NOT_FOUND":
            responseStream = this.getResponseStream({
              responseStream,
              statusCode: 404,
              eTag: headerIfNoneMatch,
              customCacheKey: headerCustomCacheKey,
            });
            responseStream.end();
            return;
          case "INVALID_PARAM_EXCEPTION":
            responseStream = this.getResponseStream({
              responseStream,
              statusCode: 400,
              contentType: "application/json",
              customCacheKey: headerCustomCacheKey,
            });
            console.warn(
              useCaseResult.error.code,
              useCaseResult.error.privateMessage
            );
            responseStream.write(
              JSON.stringify({
                message: useCaseResult.error.getPublicMessage(),
              })
            );
            responseStream.end();
            return;
          case "IMAGE_PROCESSING_EXCEPTION":
            throw Error(useCaseResult.error.privateMessage);
          default:
            console.error(`unhandled exception`, useCaseResult.error);
            throw Error(`unhandled exception`);
        }
      }

      // 6. handle use case unmodified
      if (useCaseResult.data.type === "unmodified") {
        responseStream = this.getResponseStream({
          responseStream,
          statusCode: 304,
          eTag: headerIfNoneMatch,
          customCacheKey: headerCustomCacheKey,
        });
        responseStream.end();
        return;
      }

      // 7. handle use case success
      const { headers, stream } = useCaseResult.data;
      responseStream = this.getResponseStream({
        responseStream,
        statusCode: 200,
        contentType: headers.contentType,
        eTag: headers.eTag,
        customCacheKey: headerCustomCacheKey,
      });

      stream.pipe(responseStream);
      // await Promise.race([
      //   pipeline(stream, responseStream),
      //   new Promise((resolve) => setTimeout(resolve, 10_000)),
      // ]);
      // Set up a timeout to prevent hanging connections
      const timeout = setTimeout(() => {
        console.warn("Stream processing timeout reached (10s)");
        if (!responseStream.writableEnded) responseStream.end();
      }, 10000);

      // Clean up timeout when stream ends
      stream.on("end", () => clearTimeout(timeout));
      stream.on("error", (err) => {
        clearTimeout(timeout);
        console.error("Stream error:", err);
        if (!responseStream.writableEnded) responseStream.end();
      });
      return;
    } catch (error) {
      console.error("Error processing image:", error);
      responseStream = this.getResponseStream({
        responseStream,
        statusCode: 500,
        contentType: "application/json",
      });
      responseStream.write(
        JSON.stringify({ message: "Error processing image" })
      );
      responseStream.end();
    }
  }

  private getResponseStream(params: {
    responseStream: ResponseStream;
    statusCode: number;
    contentType?: string;
    eTag?: string;
    customCacheKey?: string;
  }) {
    const { responseStream, statusCode, contentType, eTag, customCacheKey } =
      params;
    const cacheControl = this.getCacheControlFromStatusCode(statusCode);
    return awslambda.HttpResponseStream.from(responseStream, {
      statusCode,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": cacheControl,
        "Content-Type": contentType,
        "X-Cache-Key": customCacheKey,
        ETag: eTag,
      },
    });
  }

  private getCacheControlFromStatusCode(statusCode: number) {
    if (statusCode === 200) return SUCCESS_CACHE_CONTROL;
    if (statusCode === 304) return SUCCESS_CACHE_CONTROL;
    if (statusCode === 404) return NOT_FOUND_CACHE_CONTROL;
    return ERROR_CACHE_CONTROL;
  }
}
