// Common interfaces for image processing
import type { ReadableStream } from "node:stream/web";

// ImageOptions represents all possible parameters for image manipulation
export interface ImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
  outputFormat?: "jpeg" | "webp" | "avif" | "png" | "jxl" | "matchSource";
  allowUpscale?: boolean;
  sharpen?: boolean;
}

// ImageStorageProvider interface defines how we retrieve images
export interface ImageStorageProvider {
  getImageStream: (key: string) => Promise<ReadableStream>;
  getImageMetadata: (key: string) => Promise<ImageMetadata>;
}

// Image metadata returned from storage
export interface ImageMetadata {
  ETag?: string;
  ContentType?: string;
  LastModified?: Date;
  ContentLength?: number;
}

// Represents additional metadata about the image
export interface ExtendedImageMetadata {
  ratio?: number;
  width?: number;
  height?: number;
  format?: string;
  space?: string;
  channels?: number;
  density?: number;
  hasProfile?: boolean;
  hasAlpha?: boolean;
  orientation?: number;
  exif?: any;
  iptc?: any;
}

// Result of image processing operation
export interface ImageProcessingResult {
  stream: ReadableStream;
  contentType: string;
  metadata?: ImageMetadata;
  extendedMetadata?: ExtendedImageMetadata;
}

// Incoming request representation (agnostic of HTTP framework)
export interface ImageRequest {
  imageKey: string;
  options: ImageOptions;
  requestMetadata?: {
    acceptHeader?: string;
    ifNoneMatch?: string;
    [key: string]: string | undefined;
  };
  returnMetadataOnly?: boolean;
}
