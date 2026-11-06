import { describe, expect, it, vi } from 'vitest';
import { reloadOnStaleBuild } from '@/lib/stale-build';

const fakeWindow = () => {
  const target = new EventTarget();
  const stored = new Map<string, string>();
  const reload = vi.fn();

  return Object.assign(target, {
    sessionStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    },
    location: { reload },
  }) as unknown as Window & { location: { reload: typeof reload } };
};

const preloadError = () => new Event('vite:preloadError', { cancelable: true });

describe('reloadOnStaleBuild', () => {
  it('reloads the page when a page file of an older build fails to load', () => {
    const target = fakeWindow();
    reloadOnStaleBuild(target, () => 50_000);
    const event = preloadError();

    target.dispatchEvent(event);

    expect(target.location.reload).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);
  });

  it('lets the error through when the page reloaded for it a moment ago', () => {
    const target = fakeWindow();
    let now = 50_000;
    reloadOnStaleBuild(target, () => now);
    target.dispatchEvent(preloadError());
    now += 2_000;
    const again = preloadError();

    target.dispatchEvent(again);

    expect(target.location.reload).toHaveBeenCalledOnce();
    expect(again.defaultPrevented).toBe(false);
  });

  it('lets the error through when the page cannot remember its last reload', () => {
    const target = fakeWindow();
    Object.assign(target, {
      sessionStorage: {
        getItem: () => {
          throw new Error('storage blocked');
        },
      },
    });
    reloadOnStaleBuild(target, () => 50_000);
    const event = preloadError();

    target.dispatchEvent(event);

    expect(target.location.reload).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
