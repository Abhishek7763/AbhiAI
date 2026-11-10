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

export async function* withStreamTimeout<T>(
  source: AsyncIterable<T>,
  options: {
    firstChunkMs: number;
    idleChunkMs: number;
    totalMs: number;
    label?: string;
  },
): AsyncGenerator<T, void, unknown> {
  const iterator = source[Symbol.asyncIterator]();
  const startedAt = Date.now();
  const label = options.label || 'Provider stream';
  let chunkIndex = 0;

  try {
    while (true) {
      const elapsed = Date.now() - startedAt;
      const remainingTotal = options.totalMs - elapsed;
      if (remainingTotal <= 0) {
        throw new Error(`${label} total timeout after ${options.totalMs}ms`);
      }

      const phaseTimeout = chunkIndex === 0 ? options.firstChunkMs : options.idleChunkMs;
      const nextTimeout = Math.max(1, Math.min(phaseTimeout, remainingTotal));
      const phaseLabel = chunkIndex === 0 ? `${label} first response` : `${label} idle stream`;
      const next = await withTimeout(iterator.next(), nextTimeout, phaseLabel);

      if (next.done) return;
      yield next.value;
      chunkIndex += 1;
    }
  } finally {
    if (typeof iterator.return === 'function') {
      try {
        await withTimeout(Promise.resolve(iterator.return()), 1_500, `${label} cleanup`);
      } catch {
        // Best-effort cleanup only. Some upstream SDK iterators do not cancel promptly.
      }
    }
  }
}

export async function* withFirstChunkTimeout<T>(
  source: AsyncIterable<T>,
  timeoutMs: number,
  label = 'Provider stream',
): AsyncGenerator<T, void, unknown> {
  yield* withStreamTimeout(source, {
    firstChunkMs: timeoutMs,
    idleChunkMs: 60_000,
    totalMs: 5 * 60_000,
    label,
  });
}
