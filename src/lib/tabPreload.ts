// Lightweight registry so the bottom navigation can warm up a tab's code chunk
// without importing App.tsx (which would create a circular import).

type PreloadFn = () => Promise<unknown>;

const registry = new Map<string, PreloadFn>();

export function registerTabPreload(path: string, fn: PreloadFn) {
  registry.set(path, fn);
}

export function preloadTab(path: string) {
  const fn = registry.get(path);
  if (!fn) return;
  try {
    void fn();
  } catch {
    // ignore — navigation still works without the warm-up
  }
}

export function preloadAllTabs() {
  registry.forEach((fn) => {
    try {
      void fn();
    } catch {
      // ignore
    }
  });
}
