import type { z } from 'zod';

const BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

/** An HTTP error with the server's message, or a network/contract failure (status 0). */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/**
 * Fetches JSON and validates it against a shared schema, so a response that does not match
 * the contract fails as an error state instead of crashing a chart while rendering.
 */
export async function request<T extends z.ZodType>(path: string, schema: T, init: RequestInit = {}): Promise<z.infer<T>> {
  const response = await send(path, init);
  const result = schema.safeParse(await response.json().catch(() => undefined));
  if (!result.success) throw new ApiError(0, 'Unexpected response from the server');
  return result.data;
}

/** Sends a request and throws `ApiError` for network failures and non-2xx responses. */
export async function send(path: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/api${path}`, {
      ...init,
      headers: { Accept: 'application/json', ...(init.body ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError(0, 'Network error: the server is unreachable');
  }

  if (!response.ok) throw new ApiError(response.status, await errorMessage(response));
  return response;
}

async function errorMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (body && typeof body === 'object' && 'message' in body) {
    const { message } = body as { message: unknown };
    if (typeof message === 'string') return message;
    if (Array.isArray(message)) return message.join(', ');
  }
  return `Request failed (${response.status})`;
}
