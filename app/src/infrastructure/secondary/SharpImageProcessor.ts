import sharp, { Metadata } from "sharp";
import exifReader from "exif-reader";
import iptcReader from "iptc-reader";
import { PassThrough } from "stream";
import { pipeline } from "stream/promises";
import type IImageProcessor from "../../domain/ports/secondary/IImageProcessor.js";
import type {
  Input as IImageProcessorInput,
  Output as IImageProcessorOutput,
} from "../../domain/ports/secondary/IImageProcessor.js";
import type IImageMetadataProcessor from "../../domain/ports/secondary/IImageMetadataProcessor.js";
import type {
  Input as IImageMetadataProcessorInput,
  Output as IImageMetadataProcessorOutput,
} from "../../domain/ports/secondary/IImageMetadataProcessor.js";
import { streamToBuffer } from "../../shared/utils/Stream/stream.utils.js";
import { ImageMetadataSchema } from "../../shared/dto/ImageMetadataOutput.dto.js";
import type { Result } from "../../shared/utils/Result/result.types.js";
import { ImageProcessingException } from "../../domain/exceptions/ImageProcessingException.js";
import { Failure, Success } from "../../shared/utils/Result/result.js";

export default class SharpImageProcessor
  implements IImageProcessor, IImageMetadataProcessor
{
  processImage(
    input: IImageProcessorInput
  ): Result<IImageProcessorOutput, ImageProcessingException> {
    try {
      const { stream: inputStream, params } = input;
      const {
        width,
        height,
        quality,
        outputFormat,
        fit,
        allowUpscale,
        sharpen,
      } = params;

      // Create a PassThrough stream to be returned
      const outputStream = new PassThrough();

      let outputChunkCount = 0;
      outputStream.on("data", () => outputChunkCount++);
      outputStream.on("finish", () => {
        console.log(`processed finished with ${outputChunkCount} chunks`);
      });

      let inputChunkCount = 0;
      inputStream.on("data", () => inputChunkCount++);
      inputStream.on("finish", () => {
        console.log(`read finished with ${inputChunkCount} chunks`);
      });

      // Configure Sharp transformer
      // (i) rotate is to handle EXIF orientation
      let transformer = sharp().timeout({ seconds: 5 }).rotate();

      // handle fit and allowUpscale
      transformer = transformer.resize(width, height, {
        fit,
        withoutEnlargement: !allowUpscale,
        kernel: "lanczos3",
        fastShrinkOnLoad: false,
      });

      // handle sharpen
      if (sharpen) {
        transformer = transformer.sharpen({
          sigma: 1.5,
          m1: 0.5,
          m2: 0.5,
        });
      }

      // handle quality and type
      switch (outputFormat) {
        case "avif": {
          const avifQuality = quality - 20;
          transformer.avif({
            quality: Math.max(avifQuality, 1),
            effort: width > 900 ? 2 : 4,
          });
          break;
        }
        case "webp": {
          transformer.webp({ quality });
          break;
        }
        case "png": {
          transformer.png({ quality, progressive: true });
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
      }

      // Set up the pipeline but don't await it
      pipeline(inputStream, transformer, outputStream).catch((err) => {
        console.error("Pipeline error:", err);
        outputStream.destroy(err);
      });

      // Return the output stream immediately
      return Success({ stream: outputStream });
    } catch (error) {
      const exceptions = new ImageProcessingException({
        publicMessage: "Error processing image",
        privateMessage:
          error instanceof Error ? error.message : "Unknown error",
      });
      return Failure(exceptions);
    }
  }

  async processImageMetadata(
    input: IImageMetadataProcessorInput
  ): Promise<Result<IImageMetadataProcessorOutput, ImageProcessingException>> {
    try {
      const { stream } = input;
      const buffer = await streamToBuffer(stream);
      const sharpMetadata = await sharp(buffer).metadata();

      const metadata = await ImageMetadataSchema.parseAsync({
        width: sharpMetadata.width,
        height: sharpMetadata.height,
        format: sharpMetadata.format,
        space: sharpMetadata.space,
        channels: sharpMetadata.channels,
        density: sharpMetadata.density,
        hasProfile: sharpMetadata.hasProfile,
        hasAlpha: sharpMetadata.hasAlpha,
        orientation: sharpMetadata.orientation,
        exif: this.getExif(sharpMetadata),
        iptc: this.getIptc(sharpMetadata),
      });

      return Success({
        metadata,
      });
    } catch (error) {
      console.error("Error processing image metadata:", error);
      const exceptions = new ImageProcessingException({
        publicMessage: "Error processing image metadata",
        privateMessage:
          error instanceof Error ? error.message : "Unknown error",
      });
      return Failure(exceptions);
    }
  }

  private getExif(
    sharpMetadata: Metadata
  ): Record<string, unknown> | undefined {
    try {
      if (!sharpMetadata.exif) return undefined;
      const exif = exifReader(sharpMetadata.exif);
      return exif;
    } catch (error) {
      console.error("Error reading EXIF data:", error);
      return undefined;
    }
  }

  private getIptc(
    sharpMetadata: Metadata
  ): Record<string, unknown> | undefined {
    try {
      if (!sharpMetadata.iptc) return undefined;
      const iptc = iptcReader(sharpMetadata.iptc);
      return iptc;
    } catch (error) {
      console.error("Error reading IPTC data:", error);
      return undefined;
    }
  }
}
