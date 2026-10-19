// AbortController works on older mobile browsers that lack AbortSignal.any/timeout.
// Keep the deadline alive until the response body has been consumed, then dispose it.
export function requestDeadline(
  milliseconds: number,
  parent?: AbortSignal | null,
) {
  const controller = new AbortController();
  const abort = () => controller.abort(parent?.reason);
  if (parent?.aborted) abort();
  else parent?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(), milliseconds);
  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timer);
      parent?.removeEventListener("abort", abort);
    },
  };
}
