export function jsonError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export function jsonOk<T>(data: T, status = 200, headers?: HeadersInit): Response {
  return Response.json(data, { status, headers });
}

export async function readJson<T>(request: Request): Promise<T> {
  return (await request.json()) as T;
}

export function publicError(caught: unknown, fallback = "Não foi possível concluir a operação."): string {
  return caught instanceof Error ? caught.message : fallback;
}
