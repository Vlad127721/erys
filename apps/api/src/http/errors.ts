import { STATUS_CODES } from 'node:http';

/**
 * An error that maps to an HTTP response. Business code throws these; the error handler turns
 * them into JSON. `issues` (zod issues, ingestion details) switches to the detailed body.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'HttpError';
  }
}

export const badRequest = (message: string, issues?: unknown) => new HttpError(400, message, issues);
export const notFound = (message: string) => new HttpError(404, message);
export const unprocessable = (message: string) => new HttpError(422, message);

/** `{ message, error, statusCode }` — the body of plain errors (404, 422, 413, 500, …). */
export function errorBody(status: number, message: string) {
  return { message, error: STATUS_CODES[status] ?? 'Error', statusCode: status };
}

/** `{ statusCode, error, message, issues? }` — the body of validation and import errors. */
export function detailedErrorBody(status: number, message: string, issues?: unknown) {
  return {
    statusCode: status,
    error: STATUS_CODES[status] ?? 'Error',
    message,
    ...(issues === undefined ? {} : { issues }),
  };
}
