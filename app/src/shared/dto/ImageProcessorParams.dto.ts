/**
 * Image processing options
 */

import { z } from "zod";
import type { ZodSchemaOutput } from "../utils/Zod/ZodUtils.types.js";

export const OutputFormatSchema = z.enum([
  "avif",
  "webp",
  "png",
  "jpeg",
  "jxl",
  "matchSource",
]);
export type OutputFormat = z.infer<typeof OutputFormatSchema>;

export const FitSchema = z.enum([
  "cover",
  "contain",
  "fill",
  "inside",
  "outside",
]);
export type Fit = z.infer<typeof FitSchema>;

export interface ImageProcessorParams {
  width: number;
  height?: number;
  quality: number;
  outputFormat: OutputFormat;
  fit: Fit;
  allowUpscale: boolean;
  sharpen: boolean;
}

export const ImageProcessorParamsSchema = z.object({
  width: z.number(),
  height: z.number().optional(),
  quality: z.number(),
  outputFormat: OutputFormatSchema,
  fit: FitSchema,
  allowUpscale: z.boolean(),
  sharpen: z.boolean(),
}) satisfies ZodSchemaOutput<ImageProcessorParams>;
