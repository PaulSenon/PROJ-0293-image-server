import { ZodSchema, type ZodTypeDef } from "zod";

/**
 * Some zod util types for better readability
 * These are meant tu be used in "satifies" method of zod schemas
 * (form type-first approach)
 */
export type ZodSchemaOutput<TOut> = ZodSchema<TOut, ZodTypeDef, unknown>;
export type ZodSchemaInput<TIn> = ZodSchema<TIn>;
export type ZodSchemaIO<TIn, TOut> = ZodSchema<TOut, ZodTypeDef, TIn>;
