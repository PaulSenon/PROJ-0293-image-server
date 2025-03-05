import sharp from "sharp";
import { Readable } from "stream";
import exifReader from "exif-reader";
import iptcReader from "iptc-reader";
import { pipeline } from "node:stream/promises";

export interface ImageProcessingOptions {
  width?: number;
  height?: number;
  quality?: number;
  outputFormat?: "avif" | "webp" | "png" | "jpeg" | "jxl" | "matchSource";
  fit?: "cover" | "contain" | "fill" | "inside" | "outside";
  allowUpscale?: boolean;
  sharpen?: boolean;
}

export interface ImageMetadata {
  ratio: number;
  width: number;
  height: number;
  format: string;
  space: string;
  channels: number;
  density: number;
  hasProfile: boolean;
  hasAlpha: boolean;
  orientation: number;
  exif?: any;
  iptc?: any;
}

export class ImageProcessor {
  /**
   * Extracts metadata from an image buffer
   */
  public static async extractMetadata(
    imageBuffer: Buffer
  ): Promise<ImageMetadata> {
    const metadata = await sharp(imageBuffer).metadata();

    let exif = undefined;
    let iptc = undefined;

    if (metadata.exif) {
      try {
        exif = exifReader(metadata.exif);
      } catch (error) {
        console.error("Error reading EXIF data:", error);
      }
    }

    if (metadata.iptc) {
      try {
        iptc = iptcReader(metadata.iptc);
      } catch (error) {
        console.error("Error reading IPTC data:", error);
      }
    }

    return {
      ratio: metadata.width! / metadata.height!,
      width: metadata.width!,
      height: metadata.height!,
      format: metadata.format!,
      space: metadata.space!,
      channels: metadata.channels!,
      density: metadata.density!,
      hasProfile: metadata.hasProfile!,
      hasAlpha: metadata.hasAlpha!,
      orientation: metadata.orientation!,
      exif,
      iptc,
    };
  }

  /**
   * Processes an image stream with the given options
   */
  public static async processImageStream(
    inputStream: Readable,
    outputStream: NodeJS.WritableStream,
    options: ImageProcessingOptions = {}
  ): Promise<void> {
    const {
      width,
      height,
      quality = 85,
      outputFormat = "jpeg",
      fit = "cover",
      allowUpscale = false,
      sharpen = true,
    } = options;

    let transformer = sharp().timeout({ seconds: 5 }).rotate();

    // resize and sharpen image
    transformer = transformer.resize(width, height, {
      fit,
      withoutEnlargement: !allowUpscale,
    });

    if (sharpen) {
      transformer = transformer.sharpen({
        sigma: 1.5,
        m1: 0.5,
        m2: 0.5,
      });
    }

    // transform image based on type
    switch (outputFormat) {
      case "avif": {
        const avifQuality = quality - 20;
        transformer.avif({
          quality: Math.max(avifQuality, 1),
          effort: width && width > 900 ? 2 : 4,
        });
        break;
      }
      case "webp": {
        transformer.webp({ quality });
        break;
      }
      case "png": {
        transformer.png({ quality });
        break;
      }
      case "jpeg": {
        transformer.jpeg({
          quality,
          mozjpeg: true,
          progressive: true,
          optimiseScans: true,
        });
        break;
      }
      case "jxl": {
        transformer.jxl({ quality });
        break;
      }
      case "matchSource":
        // do nothing
        break;
    }

    await pipeline(inputStream, transformer, outputStream);
  }

  /**
   * Processes an image buffer with the given options
   */
  public static async processImageBuffer(
    imageBuffer: Buffer,
    options: ImageProcessingOptions = {}
  ): Promise<Buffer> {
    const {
      width,
      height,
      quality = 85,
      outputFormat = "jpeg",
      fit = "cover",
      allowUpscale = false,
      sharpen = true,
    } = options;

    let transformer = sharp(imageBuffer).timeout({ seconds: 5 }).rotate();

    // resize and sharpen image
    transformer = transformer.resize(width, height, {
      fit,
      withoutEnlargement: !allowUpscale,
    });

    if (sharpen) {
      transformer = transformer.sharpen({
        sigma: 1.5,
        m1: 0.5,
        m2: 0.5,
      });
    }

    // transform image based on type
    switch (outputFormat) {
      case "avif": {
        const avifQuality = quality - 20;
        return transformer
          .avif({
            quality: Math.max(avifQuality, 1),
            effort: width && width > 900 ? 2 : 4,
          })
          .toBuffer();
      }
      case "webp": {
        return transformer.webp({ quality }).toBuffer();
      }
      case "png": {
        return transformer.png({ quality }).toBuffer();
      }
      case "jpeg": {
        return transformer
          .jpeg({
            quality,
            mozjpeg: true,
            progressive: true,
            optimiseScans: true,
          })
          .toBuffer();
      }
      case "jxl": {
        return transformer.jxl({ quality }).toBuffer();
      }
      case "matchSource":
      default:
        return transformer.toBuffer();
    }
  }

  /**
   * Helper function to convert stream to buffer
   */
  public static async streamToBuffer(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
