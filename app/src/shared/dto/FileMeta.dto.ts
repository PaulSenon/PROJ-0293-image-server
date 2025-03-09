/**
 * Returned from the file meta loader (e.g. S3)
 */

import type { ETag } from "../domainObjects.types.js";
import { z } from "zod";
import type { ZodSchemaOutput } from "../utils/Zod/ZodUtils.types.js";

export interface FileMeta {
  byteLength: number;
  eTag: ETag;
  lastModified: Date;
  contentType: string;
}

export const FileMetaSchema = z.object({
  byteLength: z.number(),
  eTag: z.string(),
  lastModified: z.date(),
  contentType: z.string(),
}) satisfies ZodSchemaOutput<FileMeta>;
