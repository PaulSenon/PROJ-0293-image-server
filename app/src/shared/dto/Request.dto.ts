import { z } from "zod";
import {
  OutputFormatSchema,
  type OutputFormat,
} from "./ImageProcessorParams.dto.js";
import type { ZodSchemaOutput } from "../utils/Zod/ZodUtils.types.js";

const RawImageTypeSchema = z.union([OutputFormatSchema, z.literal("jpg")]);

export type RawRequestParams = Record<string, string | undefined>;
export interface RefinedRequestParams {
  uri: string;
  w: number;
  h?: number;
  q?: number;
  type?: OutputFormat;
  meta?: boolean;
}
export const RawRequestParamsSchema = z.object({
  uri: z.string(),
  w: z.coerce.number().min(0),
  h: z.coerce.number().min(0).optional(),
  q: z.coerce.number().min(0).max(100).optional(),
  meta: z.coerce.boolean().optional(),
  type: RawImageTypeSchema.optional().transform((v) => {
    if (v === "jpg") {
      return "jpeg";
    }
    return v;
  }),
}) satisfies ZodSchemaOutput<RefinedRequestParams>;

export type RawRequestHeaders = Record<string, string | undefined>;
export interface RefinedRequestHeaders {
  ifNoneMatch?: string;
  accept?: string;
  xCacheKey?: string;
}
export const RawRequestHeadersSchema = z
  .object({
    "if-none-match": z.string().optional(),
    accept: z.string().optional(),
    "x-cache-key": z.string().optional(),
  })
  .transform((v) => {
    return {
      accept: v["accept"],
      ifNoneMatch: v["if-none-match"],
      xCacheKey: v["x-cache-key"],
    };
  }) satisfies ZodSchemaOutput<RefinedRequestHeaders>;
