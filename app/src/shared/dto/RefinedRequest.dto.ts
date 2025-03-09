/**
 * The entry raw request for use case
 * (url params)
 */

import { z } from "zod";
import type { ZodSchemaOutput } from "../utils/Zod/ZodUtils.types.js";
import {
  OutputFormatSchema,
  type OutputFormat,
} from "./ImageProcessorParams.dto.js";

export interface RefinedRequestParams {
  uri: string;
  w: number;
  h?: number;
  q?: number;
  type?: OutputFormat;
  meta?: boolean;
}
export const RefinedRequestParamsSchema = z.object({
  uri: z.string(),
  w: z.number(),
  h: z.number().optional(),
  q: z.number().optional(),
  type: OutputFormatSchema.optional(),
  meta: z.boolean().optional(),
}) satisfies ZodSchemaOutput<RefinedRequestParams>;

export interface RefinedRequestHeaders {
  ifNoneMatch?: string;
  accept?: string;
  xCacheKey?: string;
}
export const RefinedRequestHeadersSchema = z
  .object({
    ifNoneMatch: z.string().optional(),
    accept: z.string().optional(),
    xCacheKey: z.string().optional(),
  })
  .strict() satisfies ZodSchemaOutput<RefinedRequestHeaders>;
