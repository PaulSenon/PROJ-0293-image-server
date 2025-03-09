import { S3Client } from "@aws-sdk/client-s3";
import type { IStreamRequestHandler } from "./interfaces/IStreamRequestHandler.js";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { ResponseStream, isInAWS } from "lambda-stream";
import S3FileLoader from "../secondary/S3FileLoader.js";
import SharpImageProcessor from "../secondary/SharpImageProcessor.js";
import ProcessImageUseCase from "../../application/useCases/ProcessImageUseCase.js";
import { pipeline } from "stream/promises";

const BUCKET_NAME = process.env.BUCKET_NAME;
const SUCCESS_CACHE_CONTROL =
  "public, max-age=21600, stale-while-revalidate=86400, stale-if-error=86400";
const NOT_FOUND_CACHE_CONTROL =
  "public, max-age=1, stale-while-revalidate=10, stale-if-error=86400";
const ERROR_CACHE_CONTROL = "public, max-age=1";

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
      // 1. parse request params
      const rawRequestParams = event.queryStringParameters || {};
      const headerCustomCacheKey = event.headers["x-cache-key"] || "";
      const headerIfNoneMatch = event.headers["if-none-match"];

      // 2. setup s3 file loader
      if (!BUCKET_NAME) throw Error("missing env BUCKET_NAME");
      const s3Client = new S3Client({});
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
      await Promise.race([
        pipeline(stream, responseStream),
        new Promise((resolve) => setTimeout(resolve, 10_000)),
      ]);
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
