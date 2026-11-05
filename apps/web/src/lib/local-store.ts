"use client";

import * as React from "react";

/**
 * localStorage as an external store. Reads go through useSyncExternalStore so
 * the server render and first client render agree (server snapshot is null),
 * and every component reading a key updates when any writer changes it.
 * Storage can be blocked (private mode, policies), so every access is guarded.
 */
const courseScopes = new Map<string, string>();
/** New enrollments/editions never inherit another enrollment's local completion. */
export function registerEnrollmentScope(courseId: string, enrollmentId: string, allowLegacy: boolean) {
  if (typeof window === 'undefined' || courseScopes.get(courseId) === enrollmentId) return;
  const previous = courseScopes.get(courseId); courseScopes.set(courseId, enrollmentId);
  const marker = `lms-enrollment-scope:v1:${courseId}`;
  try {
    const recorded = localStorage.getItem(marker);
    if (allowLegacy && !recorded) for (const key of Object.keys(localStorage)) {
      if (key.startsWith('lms-') && key.includes(courseId) && !key.includes(':enrollment:') && !key.startsWith('lms-enrollment-scope:') && !key.startsWith('lms-preview')) {
        const next = `${key}:enrollment:${enrollmentId}`;
        if (localStorage.getItem(next) === null) localStorage.setItem(next, localStorage.getItem(key)!);
      }
    }
    localStorage.setItem(marker, enrollmentId);
  } catch { /* Blocked storage keeps the server enrollment authoritative. */ }
  if (previous !== enrollmentId) listeners.forEach(l => l());
}
function scopedKey(key: string) {
  if (!key.startsWith('lms-') || key.startsWith('lms-enrollment-scope:') || key.startsWith('lms-preview') || key.includes(':enrollment:')) return key;
  for (const [courseId, enrollmentId] of courseScopes) if (key.includes(courseId)) return `${key}:enrollment:${enrollmentId}`;
  return key;
}
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(scopedKey(key));
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string | null) {
  try {
    if (value == null) localStorage.removeItem(scopedKey(key));
    else localStorage.setItem(scopedKey(key), value);
  } catch {
    // Blocked storage: the value lives only in memory listeners for this view.
  }
  listeners.forEach((l) => l());
}

export function clearLocal(prefix: string) {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(prefix))
      .forEach((k) => localStorage.removeItem(k));
  } catch {}
  listeners.forEach((l) => l());
}

/** Raw string for a key; null on the server and when unset. */
export function useLocalString(key: string): string | null {
  return React.useSyncExternalStore(
    subscribe,
    () => safeGet(key),
    () => null,
  );
}

function prefixSnapshot(prefix: string): string {
  try {
    const out: Record<string, string> = {};
    for (const k of Object.keys(localStorage).sort()) {
      const bare = k.replace(/:enrollment:[a-f0-9-]+$/, '');
      if (bare.startsWith(prefix) && scopedKey(bare) === k) out[bare] = localStorage.getItem(k) ?? "";
    }
    return JSON.stringify(out);
  } catch {
    return "{}";
  }
}

/**
 * Every key starting with `prefix`, as { key: parsed JSON }. The snapshot is
 * a string so useSyncExternalStore can compare it cheaply.
 */
export function useLocalPrefix<T>(prefix: string): Record<string, T> {
  const raw = React.useSyncExternalStore(
    subscribe,
    () => prefixSnapshot(prefix),
    () => "{}",
  );
  return React.useMemo(() => {
    const out: Record<string, T> = {};
    for (const [k, v] of Object.entries(JSON.parse(raw) as Record<string, string>)) {
      try {
        out[k] = JSON.parse(v) as T;
      } catch {}
    }
    return out;
  }, [raw]);
}

/** Parsed JSON for a key, falling back when unset or unparsable. */
export function useLocalJson<T>(key: string, fallback: T): T {
  const raw = useLocalString(key);
  return React.useMemo(() => {
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
    // fallback is intentionally not a dependency: callers pass literals.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);
}

const noopSubscribe = () => () => {};

/**
 * False during server render and hydration, true afterwards. Pages whose
 * layout depends on localStorage (enrolled or not) show a skeleton until
 * this flips, so they never flash the wrong view.
 */
export function useHydrated(): boolean {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
