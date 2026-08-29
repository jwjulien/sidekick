import { describe, it, expect, vi } from 'vitest';
import { createRoot } from 'solid-js';
import { useFocusRevalidation, triggerAppRevalidate } from '../useFocusRevalidation';

describe('useFocusRevalidation', () => {
  it('triggers refetch when window fires focus event after minInterval', async () => {
    const refetch = vi.fn();
    
    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        useFocusRevalidation(refetch, { minIntervalMs: 100 });

        // Allow onMount to fire
        await Promise.resolve();

        // Wait for minIntervalMs
        await new Promise((r) => setTimeout(r, 150));

        window.dispatchEvent(new Event('focus'));
        expect(refetch).toHaveBeenCalledTimes(1);

        // Immediate second focus within minInterval should be throttled
        window.dispatchEvent(new Event('focus'));
        expect(refetch).toHaveBeenCalledTimes(1);

        // Wait for minIntervalMs again
        await new Promise((r) => setTimeout(r, 150));
        window.dispatchEvent(new Event('focus'));
        expect(refetch).toHaveBeenCalledTimes(2);

        dispose();
        resolve();
      });
    });
  });

  it('triggers refetch on app:revalidate custom event', async () => {
    const refetch = vi.fn();

    await new Promise<void>((resolve) => {
      createRoot(async (dispose) => {
        useFocusRevalidation(refetch, { minIntervalMs: 100 });

        // Allow onMount to fire
        await Promise.resolve();

        // Wait for minIntervalMs
        await new Promise((r) => setTimeout(r, 150));

        triggerAppRevalidate();
        expect(refetch).toHaveBeenCalledTimes(1);

        dispose();
        resolve();
      });
    });
  });
});
