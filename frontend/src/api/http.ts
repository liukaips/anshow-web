type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function parseJson(response: Response): Promise<UnknownRecord | null> {
  try {
    const body: unknown = await response.json();
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(options: {
    status: number;
    code: string;
    message: string;
    requestId?: string;
  }) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
  }
}

export async function getEnvelope<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, init);
  const body = await parseJson(response);
  const error = body && isRecord(body.error) ? body.error : null;
  const requestId =
    typeof body?.requestId === "string"
      ? body.requestId
      : response.headers.get("x-request-id") ?? undefined;

  if (
    !response.ok ||
    error ||
    body === null ||
    !("data" in body) ||
    body.data === null ||
    body.error !== null
  ) {
    throw new ApiError({
      status: response.status,
      code:
        error && typeof error.code === "string"
          ? error.code
          : "API_REQUEST_FAILED",
      message:
        error && typeof error.message === "string"
          ? error.message
          : "API request failed.",
      requestId,
    });
  }

  return body.data as T;
}
