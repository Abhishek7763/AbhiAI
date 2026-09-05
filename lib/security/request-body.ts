export class RequestBodyTooLargeError extends Error {
  constructor(public readonly maxBytes: number) {
    super(`Request body exceeds the ${maxBytes} byte limit.`);
    this.name = 'RequestBodyTooLargeError';
  }
}

export async function readJsonBodyWithLimit<T = unknown>(req: Request, maxBytes: number): Promise<T> {
  const safeMaxBytes = Math.max(1, Math.floor(maxBytes));
  const reader = req.body?.getReader();
  if (!reader) return {} as T;

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > safeMaxBytes) {
        await reader.cancel('request-body-too-large').catch(() => undefined);
        throw new RequestBodyTooLargeError(safeMaxBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) return {} as T;

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const text = new TextDecoder().decode(combined);
  return JSON.parse(text) as T;
}
