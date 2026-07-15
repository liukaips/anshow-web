export function routeProgress(now: number, start: number, duration = 1_800) {
  const raw = Math.max(0, Math.min(1, (now - start) / duration));
  return { raw, eased: 1 - Math.pow(1 - raw, 3) };
}
