import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { ImageProcessor } from "../../core/imageProcessor.js";
import type { ImageProcessingOptions } from "../../core/imageProcessor.js";
import type { APIGatewayProxyEvent } from "aws-lambda";

// This is a type for the AWS Lambda streamifyResponse handler
// It's not available in the @types/aws-lambda package, so we define it here
declare global {
  namespace awslambda {
    function streamifyResponse(
      handler: (
        event: APIGatewayProxyEvent,
        responseStream: any
      ) => Promise<void>
    ): (event: APIGatewayProxyEvent, context: any) => Promise<void>;

    class HttpResponseStream {
      static from(stream: any, options: any): any;
    }
  }
}

export const handler = awslambda.streamifyResponse(
  async (event, responseStream) => {
    try {
      const s3Client = new S3Client({});
      const BUCKET_NAME = process.env.BUCKET_NAME;

      console.log("queryStringParameters", event.queryStringParameters);
      console.log("headers", event.headers);
      console.log("bucketName", BUCKET_NAME);

      if (!event.queryStringParameters || !event.queryStringParameters.uri) {
        throw new Error("Missing required parameter: uri");
      }

      const { uri, w, h, q, type, meta } = event.queryStringParameters;
      const acceptHeader = event.headers["accept"] || "";
      const debugCacheKey = event.headers["x-cache-key"] || "";
      const ifNoneMatch = event.headers["if-none-match"];

      // Check if the source image exists and get its ETag
      const headResult = await s3Client.send(
        new HeadObjectCommand({
          Bucket: BUCKET_NAME,
          Key: uri,
        })
      );
      console.log("headResult", headResult);

      const sourceETag = headResult.ETag || "";
      const successCacheControl =
        "public, max-age=21600, stale-while-revalidate=86400";

      // If-None-Match handling
      if (ifNoneMatch === sourceETag) {
        const metadata = {
          statusCode: 304,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "X-Cache-Key": debugCacheKey,
            "Cache-Control": successCacheControl,
            ETag: sourceETag,
          },
        };

        responseStream = awslambda.HttpResponseStream.from(
          responseStream,
          metadata
        );
        responseStream.end();
        return;
      }

      // Get the source image as a stream
      const command = new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: uri,
      });
      const response = await s3Client.send(command);
      if (response.Body === undefined) throw new Error("No body in response");
      if (!(response.Body instanceof Readable))
        throw new Error("Body is not a stream");

      // If metadata is requested, extract and return it
      if (meta === "true") {
        const imageBuffer = await ImageProcessor.streamToBuffer(response.Body);
        const metadata = await ImageProcessor.extractMetadata(imageBuffer);

        responseStream = awslambda.HttpResponseStream.from(responseStream, {
          statusCode: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "X-Cache-Key": debugCacheKey,
            "Cache-Control": successCacheControl,
            ETag: sourceETag,
            "Content-Type": "application/json",
          },
        });

        responseStream.write(JSON.stringify(metadata));
        responseStream.end();
        return;
      }

      // Determine output format
      let outputFormat = type || "jpeg";
      if (!type) {
        if (acceptHeader.includes("image/avif")) outputFormat = "avif";
        else if (acceptHeader.includes("image/webp")) outputFormat = "webp";
      }

      // Prepare image processing options
      const options: ImageProcessingOptions = {
        width: w ? parseInt(w, 10) : undefined,
        height: h ? parseInt(h, 10) : undefined,
        quality: q ? parseInt(q, 10) : 85,
        outputFormat: outputFormat as any,
        fit: "cover",
        allowUpscale: false,
        sharpen: true,
      };

      // Set up response headers
      responseStream = awslambda.HttpResponseStream.from(responseStream, {
        statusCode: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "X-Cache-Key": debugCacheKey,
          "Content-Type": `image/${outputFormat}`,
          "Cache-Control": successCacheControl,
          ETag: sourceETag,
        },
      });

      // Process the image stream
      await ImageProcessor.processImageStream(
        response.Body,
        responseStream,
        options
      );
    } catch (error: unknown) {
      console.error("Error processing image:", error);
      const metadata = {
        statusCode: (error as any)?.statusCode || 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      };
      responseStream = awslambda.HttpResponseStream.from(
        responseStream,
        metadata
      );
      responseStream.write(
        JSON.stringify({ message: "Error processing image" })
      );
      responseStream.end();
    }
  }
);
