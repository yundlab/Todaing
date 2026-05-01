import { useEffect, useMemo, useState } from "react";

export function useLocalStorageState<T>(
  key: string,
  initialValue: T,
  opts?: {
    // eslint-disable-next-line no-unused-vars
    parse?: (_raw: string) => T;
    // eslint-disable-next-line no-unused-vars
    serialize?: (_value: T) => string;
  }
) {
  const parse = useMemo(() => opts?.parse ?? ((raw: string) => JSON.parse(raw) as T), [opts?.parse]);
  const serialize = useMemo(
    () => opts?.serialize ?? ((value: T) => JSON.stringify(value)),
    [opts?.serialize]
  );

  const [value, setValue] = useState<T>(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw == null) return initialValue;
      return parse(raw);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, serialize(value));
    } catch {
      // ignore
    }
  }, [key, serialize, value]);

  return [value, setValue] as const;
}

