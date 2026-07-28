import { useCallback, useEffect, useRef, useState } from "react";

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Local-state-plus-autosave for a single field. The caller renders `value` and
 * calls `setValue` on every keystroke; the `save` callback fires once the user
 * has been idle for `delay` ms and the value actually changed.
 *
 * `saving` is true while the save promise is in flight; `saved` flips true after
 * the first successful save and stays true, so a field the user never touched
 * does not claim to have been saved.
 */
export function useDebouncedSave<T>(
  initial: T,
  save: (v: T) => Promise<void>,
  delay = 800,
): { value: T; setValue: (v: T) => void; saving: boolean; saved: boolean } {
  const [value, setValueState] = useState<T>(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef<T>(initial);
  const dirty = useRef(false);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  // Adopt a value that changed on the server (query invalidation, another tab),
  // but never clobber an edit the user has in flight or not yet saved.
  useEffect(() => {
    if (dirty.current) return;
    if (deepEqual(initial, lastSaved.current)) return;
    lastSaved.current = initial;
    setValueState(initial);
  }, [initial]);

  const setValue = useCallback((next: T) => {
    setValueState(next);
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      if (deepEqual(next, lastSaved.current)) {
        dirty.current = false;
        return;
      }
      if (mounted.current) setSaving(true);
      saveRef.current(next).then(
        () => {
          lastSaved.current = next;
          dirty.current = false;
          if (mounted.current) {
            setSaved(true);
            setSaving(false);
          }
        },
        () => {
          // The mutation hook owns the error surface; staying dirty keeps the
          // failed edit on screen instead of reverting it to the server value.
          if (mounted.current) setSaving(false);
        },
      );
    }, delay);
  }, [delay]);

  return { value, setValue, saving, saved };
}
