import express from "express";
import type { Request, Response } from "express";
import type { IStreamRequestHandler } from "./interfaces/IStreamRequestHandler.js";
import S3FileLoader from "../secondary/S3FileLoader.js";
import SharpImageProcessor from "../secondary/SharpImageProcessor.js";
import ProcessImageUseCase from "../../application/useCases/ProcessImageUseCase.js";
import type {
  RawRequestHeaders,
  RawRequestParams,
} from "../../shared/dto/Request.dto.js";
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
export class ExpressStreamHandler
  implements IStreamRequestHandler<Request, Response>
{
  constructor() {
    // No environment check needed for Express
  }

  async handle(req: Request, res: Response): Promise<void> {
    try {
      // 1. parse request params
      const rawRequestParams = req.query;
      const headerCustomCacheKey = req.header("x-cache-key") || "";
      const headerIfNoneMatch = req.header("if-none-match");

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
        rawParams: rawRequestParams as unknown as RawRequestParams,
        rawHeaders: req.headers as unknown as RawRequestHeaders,
      });

      // 5. handle use case exceptions
      if (!useCaseResult.success) {
        switch (useCaseResult.error.code) {
          case "FILE_NOT_FOUND":
            this.setResponseHeaders(res, {
              statusCode: 404,
              eTag: headerIfNoneMatch,
              customCacheKey: headerCustomCacheKey,
            });
            res.end();
            return;
          case "INVALID_PARAM_EXCEPTION":
            this.setResponseHeaders(res, {
              statusCode: 400,
              contentType: "application/json",
              customCacheKey: headerCustomCacheKey,
            });
            console.warn(
              useCaseResult.error.code,
              useCaseResult.error.privateMessage
            );
            res.json({
              message: useCaseResult.error.getPublicMessage(),
            });
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
        this.setResponseHeaders(res, {
          statusCode: 304,
          eTag: headerIfNoneMatch,
          customCacheKey: headerCustomCacheKey,
        });
        res.end();
        return;
      }

      // 7. handle use case success
      const { headers, stream } = useCaseResult.data;
      this.setResponseHeaders(res, {
        statusCode: 200,
        contentType: headers.contentType,
        eTag: headers.eTag,
        customCacheKey: headerCustomCacheKey,
      });

      // Handle streaming response
      stream.pipe(res);

      // Set up a timeout to prevent hanging connections
      const timeout = setTimeout(() => {
        console.warn("Stream processing timeout reached (10s)");
        if (!res.writableEnded) res.end();
      }, 10000);

      // Clean up timeout when stream ends
      stream.on("end", () => clearTimeout(timeout));
      stream.on("error", (err) => {
        clearTimeout(timeout);
        console.error("Stream error:", err);
        if (!res.writableEnded) res.end();
      });

      return;
    } catch (error) {
      console.error("Error processing image:", error);
      this.setResponseHeaders(res, {
        statusCode: 500,
        contentType: "application/json",
      });
      res.json({ message: "Error processing image" });
    }
  }

  private setResponseHeaders(
    res: Response,
    params: {
      statusCode: number;
      contentType?: string;
      eTag?: string;
      customCacheKey?: string;
    }
  ) {
    const { statusCode, contentType, eTag, customCacheKey } = params;
    const cacheControl = this.getCacheControlFromStatusCode(statusCode);

    res.status(statusCode);
    res.set({
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": cacheControl,
      "X-Cache-Key": customCacheKey || "",
    });

    if (contentType) {
      res.set("Content-Type", contentType);
    }

    if (eTag) {
      res.set("ETag", eTag);
    }

    return res;
  }

  private getCacheControlFromStatusCode(statusCode: number) {
    if (statusCode === 200) return SUCCESS_CACHE_CONTROL;
    if (statusCode === 304) return SUCCESS_CACHE_CONTROL;
    if (statusCode === 404) return NOT_FOUND_CACHE_CONTROL;
    return ERROR_CACHE_CONTROL;
  }
}

// Create an Express server with the handler
export function createExpressServer(port: number) {
  const app = express();
  const handler = new ExpressStreamHandler();

  // Configure main route
  app.get("/", async (req, res) => {
    await handler.handle(req, res);
  });

  // Add a health check endpoint
  app.get("/health", (_, res) => {
    res.status(200).send("OK");
  });

  // Start the server
  return app.listen(port, () => {
    console.log(`Express server listening on port ${port}`);
  });
}

// Server startup function for import and direct use
export default function startServer(port: number) {
  return createExpressServer(port);
}
