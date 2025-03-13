/**
 * Final output of image metadata
 */

import { z } from "zod";
import type { ZodSchemaOutput } from "../utils/Zod/ZodUtils.types.js";

export interface ImageMetadata {
  width: number;
  height: number;
  format: string;
  space: string;
  channels: number;
  density: number;
  hasProfile: boolean;
  hasAlpha: boolean;
  orientation?: number;
  exif?: Record<string, unknown>;
  iptc?: Record<string, unknown>;
}

export const ImageMetadataSchema = z.object({
  width: z.number(),
  height: z.number(),
  format: z.string(),
  space: z.string(),
  channels: z.number(),
  density: z.number(),
  hasProfile: z.boolean(),
  hasAlpha: z.boolean(),
  orientation: z.number().optional(),
  exif: z.record(z.string(), z.unknown()).optional(),
  iptc: z.record(z.string(), z.unknown()).optional(),
}) satisfies ZodSchemaOutput<ImageMetadata>;
