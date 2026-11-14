/**
 * Synchronous lock for barcode frames.
 * React state updates after the render, so a burst of scans can pass a state guard.
 */
export function createBarcodeScanGuard() {
  let locked = false;

  return {
    tryAcquire(): boolean {
      if (locked) return false;
      locked = true;
      return true;
    },
    release(): void {
      locked = false;
    },
  };
}
