import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

const localData = new Map<string, string>();
const localStorageForTests = {
  get length() { return localData.size; },
  key(index: number) { return [...localData.keys()][index] ?? null; },
  getItem(key: string) { return localData.get(key) ?? null; },
  setItem(key: string, value: string) { localData.set(key, String(value)); },
  removeItem(key: string) { localData.delete(key); },
  clear() { localData.clear(); },
};
Object.defineProperty(window, 'localStorage', { configurable: true, get: () => localStorageForTests });

afterEach(() => {
  cleanup();
  window.location.hash = '';
  window.sessionStorage.clear();
  localStorageForTests.clear();
});
