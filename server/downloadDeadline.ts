export class SourceDownloadDeadlineError extends Error {
  constructor(timeoutMs: number) {
    super(`The AMC source download timed out after ${Math.round(timeoutMs / 1000)} seconds.`);
    this.name = "SourceDownloadDeadlineError";
  }
}

/**
 * Keep each source request below the upstream gateway deadline. The underlying
 * network work may settle later, but the tRPC mutation is released with a
 * structured result instead of waiting for an HTML gateway timeout.
 */
export function withSourceDownloadDeadline<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new SourceDownloadDeadlineError(timeoutMs)), timeoutMs);
  });

  return Promise.race([operation(), deadline]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}
