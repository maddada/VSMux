/**
 * Format a relative time string from an ISO date.
 * Returns `{ value: "20s", suffix: "ago" }` or `{ value: "just now", suffix: null }`.
 *
 * This intentionally mirrors T3 Code's compact sidebar timestamp UX.
 */
export function formatRelativeTime(isoDate: string): { value: string; suffix: string | null } {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  if (diffMs < 0) {
    return { value: "just now", suffix: null };
  }

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 5) {
    return { value: "just now", suffix: null };
  }

  if (seconds < 60) {
    return { value: `${seconds}s`, suffix: "ago" };
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return { value: `${minutes}m`, suffix: "ago" };
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return { value: `${hours}h`, suffix: "ago" };
  }

  const days = Math.floor(hours / 24);
  return { value: `${days}d`, suffix: "ago" };
}

export function formatRelativeTimeLabel(isoDate: string): string {
  const relative = formatRelativeTime(isoDate);
  return relative.suffix ? `${relative.value} ${relative.suffix}` : relative.value;
}
