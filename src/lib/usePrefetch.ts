export function usePrefetch<T>(importer: () => Promise<T>) {
  const onMouseEnter = () => {
    try { importer(); } catch {}
  };
  const onFocus = () => {
    try { importer(); } catch {}
  };
  return { onMouseEnter, onFocus } as const;
}
