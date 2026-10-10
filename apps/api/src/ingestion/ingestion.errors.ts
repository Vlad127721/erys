/**
 * The file or the mapping cannot be turned into widgets. The message is safe to show to
 * the user and should say what to fix (missing column, bad value at row N, etc.).
 */
export class IngestionError extends Error {
  constructor(
    message: string,
    readonly details?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'IngestionError';
  }
}

export class UnsupportedFileTypeError extends IngestionError {
  constructor(fileName: string, supported: readonly string[]) {
    super(`Unsupported file type: "${fileName}". Supported extensions: ${supported.join(', ')}`);
    this.name = 'UnsupportedFileTypeError';
  }
}
