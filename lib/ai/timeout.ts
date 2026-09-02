import 'server-only';

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = 'Provider request',
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`${label} timeout after ${timeoutMs}ms`));
      }, timeoutMs);

      promise.then(resolve, reject);
    });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function* withFirstChunkTimeout<T>(
  source: AsyncIterable<T>,
  timeoutMs: number,
  label = 'Provider stream',
): AsyncGenerator<T, void, unknown> {
  const iterator = source[Symbol.asyncIterator]();

  try {
    const first = await withTimeout(iterator.next(), timeoutMs, `${label} first response`);
    if (first.done) return;
    yield first.value;

    while (true) {
      const next = await iterator.next();
      if (next.done) return;
      yield next.value;
    }
  } finally {
    if (typeof iterator.return === 'function') {
      try {
        await iterator.return();
      } catch {
        // Best-effort cleanup only.
      }
    }
  }
}
