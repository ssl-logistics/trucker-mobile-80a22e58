// Small per-page cache (memory + sessionStorage) so revisiting a page or
// pressing back renders the last data instantly while a silent refresh runs.
const memory = new Map<string, unknown>();

export function readPageCache<T>(key: string): T | null {
  if (memory.has(key)) return memory.get(key) as T;
  try {
    const raw = sessionStorage.getItem(`pageCache:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writePageCache<T>(key: string, data: T): void {
  memory.set(key, data);
  try {
    sessionStorage.setItem(`pageCache:${key}`, JSON.stringify(data));
  } catch {
    /* quota exceeded — memory cache still works */
  }
}
