import express from "express";
import type { Request, Response, Router, RequestHandler } from "express";
import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { Readable } from "stream";
import { ImageProcessor } from "../../core/imageProcessor.js";
import type { ImageProcessingOptions } from "../../core/imageProcessor.js";

// Create Express router
export const router: Router = express.Router();

// Image processing endpoint
const processImage: RequestHandler = async (req, res, _next) => {
  try {
    const s3Client = new S3Client({
      endpoint: process.env.AWS_ENDPOINT,
      region: process.env.AWS_REGION || "us-east-1",
      forcePathStyle: true,
    });
    const BUCKET_NAME = process.env.BUCKET_NAME;

    console.log("query", req.query);
    console.log("headers", req.headers);
    console.log("bucketName", BUCKET_NAME);

    const { uri, w, h, q, type, meta } = req.query;

    if (!uri || typeof uri !== "string") {
      res.status(400).json({ message: "Missing required parameter: uri" });
      return;
    }

    const acceptHeader = req.headers["accept"] || "";
    const debugCacheKey = req.headers["x-cache-key"] || "";
    const ifNoneMatch = req.headers["if-none-match"];

    // Check if the source image exists and get its ETag
    try {
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
        res
          .status(304)
          .set("Access-Control-Allow-Origin", "*")
          .set("X-Cache-Key", debugCacheKey as string)
          .set("Cache-Control", successCacheControl)
          .set("ETag", sourceETag)
          .end();
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

        res
          .status(200)
          .set("Access-Control-Allow-Origin", "*")
          .set("X-Cache-Key", debugCacheKey as string)
          .set("Cache-Control", successCacheControl)
          .set("ETag", sourceETag)
          .json(metadata);
        return;
      }

      // Determine output format
      let outputFormat = (type as string) || "jpeg";
      if (!type) {
        if (acceptHeader.includes("image/avif")) outputFormat = "avif";
        else if (acceptHeader.includes("image/webp")) outputFormat = "webp";
      }

      // Prepare image processing options
      const options: ImageProcessingOptions = {
        width: w ? parseInt(w as string, 10) : undefined,
        height: h ? parseInt(h as string, 10) : undefined,
        quality: q ? parseInt(q as string, 10) : 85,
        outputFormat: outputFormat as any,
        fit: "cover",
        allowUpscale: false,
        sharpen: true,
      };

      // Set up response headers
      res
        .status(200)
        .set("Access-Control-Allow-Origin", "*")
        .set("X-Cache-Key", debugCacheKey as string)
        .set("Content-Type", `image/${outputFormat}`)
        .set("Cache-Control", successCacheControl)
        .set("ETag", sourceETag);

      // Process the image stream
      await ImageProcessor.processImageStream(response.Body, res, options);
      return;
    } catch (error: unknown) {
      console.error("Error processing image:", error);
      if ((error as any)?.name === "NoSuchKey") {
        res.status(404).json({ message: "Image not found" });
        return;
      } else {
        throw error; // Re-throw to be caught by the outer try-catch
      }
    }
  } catch (error: unknown) {
    console.error("Error processing image:", error);
    res
      .status(500)
      .set("Access-Control-Allow-Origin", "*")
      .set("Content-Type", "application/json")
      .set("Cache-Control", "no-store")
      .json({ message: "Error processing image" });
    return;
  }
};

router.get("/process", processImage);

// Health check endpoint
router.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});
