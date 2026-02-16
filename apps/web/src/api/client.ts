import { env } from '../config/env';

type TokenProvider = () => Promise<string | null>;
type UnauthorizedHandler = () => Promise<void> | void;

let tokenProvider: TokenProvider = async () => null;
let unauthorizedHandler: UnauthorizedHandler = () => undefined;

export function setApiTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler): void {
  unauthorizedHandler = handler;
}

export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly payload?: unknown;

  public constructor(message: string, statusCode: number, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.payload = payload;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
  headers?: Record<string, string>;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = await tokenProvider();

  if (!token) {
    throw new ApiError('No active token available', 401);
  }

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ApiError(
        `Cannot reach API at ${env.apiBaseUrl}. Ensure backend is running.`,
        0,
      );
    }
    throw error;
  }

  const payload = (await response.json().catch(() => undefined)) as
    | { error?: { message?: string } }
    | undefined;

  if (!response.ok) {
    if (response.status === 401) {
      await unauthorizedHandler();
    }

    throw new ApiError(
      payload?.error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      payload,
    );
  }

  return payload as T;
}

export async function apiDownload(path: string, options: RequestOptions = {}): Promise<Blob> {
  const token = await tokenProvider();

  if (!token) {
    throw new ApiError('No active token available', 401);
  }

  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ApiError(`Cannot reach API at ${env.apiBaseUrl}. Ensure backend is running.`, 0);
    }
    throw error;
  }

  if (!response.ok) {
    if (response.status === 401) {
      await unauthorizedHandler();
    }

    const payload = (await response.json().catch(() => undefined)) as
      | { error?: { message?: string } }
      | undefined;

    throw new ApiError(
      payload?.error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      payload,
    );
  }

  return response.blob();
}

export async function publicApiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${env.apiBaseUrl}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ApiError(
        `Cannot reach API at ${env.apiBaseUrl}. Ensure backend is running.`,
        0,
      );
    }
    throw error;
  }

  const payload = (await response.json().catch(() => undefined)) as
    | { error?: { message?: string } }
    | undefined;

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message ?? `Request failed with status ${response.status}`,
      response.status,
      payload,
    );
  }

  return payload as T;
}
