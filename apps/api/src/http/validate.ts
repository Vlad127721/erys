import { z } from 'zod';
import { HttpError, badRequest } from './errors.js';

/** Parses a request part with a shared zod schema; 400 with the issues when it does not match. */
export function parseWith<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw badRequest(z.prettifyError(result.error), result.error.issues);
  return result.data;
}

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Widget ids are UUID v4; anything else is a 400 before touching the database. */
export function uuidParam(value: string | undefined): string {
  if (value === undefined || !UUID_V4.test(value)) {
    throw new HttpError(400, 'Validation failed (uuid v 4 is expected)');
  }
  return value;
}
