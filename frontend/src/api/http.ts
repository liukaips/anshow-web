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
  readonly fields?: Readonly<Record<string, readonly string[]>>;

  constructor(options: {
    status: number;
    code: string;
    message: string;
    requestId?: string;
    fields?: Readonly<Record<string, readonly string[]>>;
  }) {
    super(options.message);
    this.name = "ApiError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.fields = options.fields;
  }
}

function safeFields(
  value: unknown,
): Readonly<Record<string, readonly string[]>> | undefined {
  if (!isRecord(value)) return undefined;
  const fields = Object.fromEntries(
    Object.entries(value).flatMap(([field, messages]) => {
      if (!Array.isArray(messages)) return [];
      const safeMessages = messages.filter(
        (message): message is string => typeof message === "string",
      );
      return safeMessages.length > 0 ? [[field, safeMessages]] : [];
    }),
  );
  return Object.keys(fields).length > 0 ? fields : undefined;
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
      fields: safeFields(error?.fields),
    });
  }

  return body.data as T;
}
