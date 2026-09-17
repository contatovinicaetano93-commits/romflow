export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export function errorStatus(message: string, fallback = 400): number {
  if (message === "Sessão expirada.") {
    return 401;
  }
  if (message.startsWith("Muitas tentativas")) {
    return 429;
  }
  return fallback;
}

export function jsonOk<T>(data: T, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers });
}

export async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

const SENSITIVE_ERROR =
  /SESSION_SECRET|DATABASE_URL|passwordHash|ECONNREFUSED|neon\.tech|postgres:\/\/|mongodb:\/\/|redis:\/\//i;

export function publicError(caught: unknown, fallback = "Não foi possível concluir a operação."): string {
  if (!(caught instanceof Error)) {
    return fallback;
  }
  const message = caught.message.trim();
  if (!message || SENSITIVE_ERROR.test(message)) {
    return fallback;
  }
  return message;
}
