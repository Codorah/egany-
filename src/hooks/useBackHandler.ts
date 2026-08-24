import { useEffect } from 'react';

// A back action can be "consumed" by a nested UI level (a drill-down menu, an
// open sheet, a chat panel) before falling back to top-level view navigation.
// Handlers are tried most-recently-registered first — the innermost screen
// gets first refusal, exactly like a native navigation stack popping one
// level at a time instead of jumping straight to the app's home screen.
type BackHandler = () => boolean;

const stack: BackHandler[] = [];

export function registerBackHandler(handler: BackHandler) {
  stack.push(handler);
  return () => {
    const idx = stack.lastIndexOf(handler);
    if (idx !== -1) stack.splice(idx, 1);
  };
}

export function runBackHandlers(): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i]()) return true;
  }
  return false;
}

/**
 * Registers a hardware/system back handler while `active` is true.
 * Return `true` from `handler` to consume the back action (stop it from
 * falling through to the app's default view-level back / exit behavior).
 * Pass a `useCallback`-memoized `handler` to avoid re-registering on every
 * render — the effect re-subscribes whenever `handler` changes identity.
 */
export function useBackHandler(handler: BackHandler, active: boolean) {
  useEffect(() => {
    if (!active) return;
    return registerBackHandler(handler);
  }, [active, handler]);
}
