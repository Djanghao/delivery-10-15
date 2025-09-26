'use client';

import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'selectedRegions';

function readFromStorage(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function useSharedRegions(): [string[], (next: string[]) => void] {
  const [regions, setRegions] = useState<string[]>(() => readFromStorage());

  useEffect(() => {
    // 初始化时尝试同步一次（处理其他页面刚刚写入的情况）
    setRegions(readFromStorage());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setRegions(readFromStorage());
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const update = useCallback((next: string[]) => {
    setRegions(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage failures
    }
  }, []);

  return [regions, update];
}

