import { z } from "zod";

export const jsonSchemaValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.boolean(),
    z.number(),
    z.string(),
    z.null(),
    z.array(jsonSchemaValueSchema),
    z.record(jsonSchemaValueSchema),
  ]),
);

export const isoDateTimeSchema = z.string().datetime({ offset: true });
