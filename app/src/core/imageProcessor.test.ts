import { describe, it, expect, vi } from "vitest";
import { ImageProcessor } from "./imageProcessor.js";
import type { ImageProcessingOptions } from "./imageProcessor.js";
import sharp from "sharp";
import { Readable } from "stream";

// Mock sharp
vi.mock("sharp", () => {
  const mockSharp = vi.fn().mockReturnValue({
    timeout: vi.fn().mockReturnThis(),
    rotate: vi.fn().mockReturnThis(),
    resize: vi.fn().mockReturnThis(),
    sharpen: vi.fn().mockReturnThis(),
    avif: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    jxl: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from("test")),
    metadata: vi.fn().mockResolvedValue({
      width: 100,
      height: 100,
      format: "jpeg",
      space: "srgb",
      channels: 3,
      density: 72,
      hasProfile: true,
      hasAlpha: false,
      orientation: 1,
    }),
  });
  return { default: mockSharp };
});

// Mock exif-reader and iptc-reader
vi.mock("exif-reader", () => {
  return { default: vi.fn().mockReturnValue({ exif: "data" }) };
});

vi.mock("iptc-reader", () => {
  return { default: vi.fn().mockReturnValue({ iptc: "data" }) };
});

// Mock node:stream/promises
vi.mock("node:stream/promises", () => {
  return { pipeline: vi.fn().mockResolvedValue(undefined) };
});

describe("ImageProcessor", () => {
  describe("extractMetadata", () => {
    it("should extract metadata from an image buffer", async () => {
      const buffer = Buffer.from("test");
      const metadata = await ImageProcessor.extractMetadata(buffer);

      expect(metadata).toEqual({
        ratio: 1,
        width: 100,
        height: 100,
        format: "jpeg",
        space: "srgb",
        channels: 3,
        density: 72,
        hasProfile: true,
        hasAlpha: false,
        orientation: 1,
        exif: undefined,
        iptc: undefined,
      });
    });
  });

  describe("processImageBuffer", () => {
    it("should process an image buffer with default options", async () => {
      const buffer = Buffer.from("test");
      const result = await ImageProcessor.processImageBuffer(buffer);

      expect(result).toEqual(Buffer.from("test"));
    });

    it("should process an image buffer with custom options", async () => {
      const buffer = Buffer.from("test");
      const options: ImageProcessingOptions = {
        width: 200,
        height: 200,
        quality: 90,
        outputFormat: "webp",
        fit: "contain",
        allowUpscale: true,
        sharpen: false,
      };

      const result = await ImageProcessor.processImageBuffer(buffer, options);

      expect(result).toEqual(Buffer.from("test"));
    });
  });

  describe("streamToBuffer", () => {
    it("should convert a stream to a buffer", async () => {
      const stream = new Readable();
      stream.push(Buffer.from("test"));
      stream.push(null);

      const buffer = await ImageProcessor.streamToBuffer(stream);

      expect(buffer).toEqual(Buffer.from("test"));
    });
  });
});
