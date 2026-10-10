import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import { IngestionError, UnsupportedFileTypeError } from '../ingestion/ingestion.errors.js';
import { HttpError, detailedErrorBody, errorBody } from './errors.js';

export interface Logger {
  error(message: string, ...details: unknown[]): void;
}

/** Unknown routes: a JSON 404 instead of Express's HTML page. */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json(errorBody(404, `Cannot ${req.method} ${req.originalUrl}`));
};

/** The single place that turns errors into HTTP responses. Unknown errors never leak details. */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _req, res, _next) => {
    if (error instanceof HttpError) {
      const body =
        error.issues === undefined
          ? errorBody(error.status, error.message)
          : detailedErrorBody(error.status, error.message, error.issues);
      res.status(error.status).json(body);
      return;
    }

    // Import code is framework-free (the seed command uses it too); the status is decided here.
    if (error instanceof IngestionError) {
      const status = error instanceof UnsupportedFileTypeError ? 415 : 400;
      res.status(status).json(detailedErrorBody(status, error.message, error.details));
      return;
    }

    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      res.status(status).json(errorBody(status, error.message));
      return;
    }

    // body-parser: malformed JSON (400), body too large (413), … Its messages are safe to show.
    if (isClientError(error)) {
      res.status(error.status).json(errorBody(error.status, error.message));
      return;
    }

    logger.error('Unhandled error', error);
    res.status(500).json({ statusCode: 500, message: 'Internal server error' });
  };
}

function isClientError(error: unknown): error is { status: number; message: string } {
  return (
    error instanceof Error &&
    'status' in error &&
    typeof error.status === 'number' &&
    error.status >= 400 &&
    error.status < 500 &&
    'expose' in error &&
    error.expose === true
  );
}
