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
  // 为避免 SSR 与客户端首帧不一致导致的水合报错，这里不要在初始 state 读取 localStorage。
  // 统一以 [] 作为首帧，随后在 useEffect 中再从 storage 同步。
  const [regions, setRegions] = useState<string[]>([]);

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
