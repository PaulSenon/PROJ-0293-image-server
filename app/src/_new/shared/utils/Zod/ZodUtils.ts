import z from "zod";

const splitCSV = (str: string) => str.split(",").map((s) => s.trim());

export const CsvStrings = z.string().transform(splitCSV);
export const CsvNumbers = z
  .string()
  .transform((str) => splitCSV(str).map(parseFloat))
  .refine((arr) => arr.every((n) => !isNaN(n)), {
    message: "All values must be valid numbers",
  });
export const StringNumber = z.coerce.number();
export const StringBoolean = z.coerce.boolean();

export function zodErrorToReadableString(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return `${path ? `${path}: ` : ""}${issue.message}`;
    })
    .join("; ");
}
