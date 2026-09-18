import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useReseeded } from '@/hooks/useReseeded';

describe('useReseeded', () => {
  it('starts from the seed', () => {
    const { result } = renderHook(() => useReseeded('a', () => ['one']));

    expect(result.current[0]).toEqual(['one']);
  });

  it('keeps what was set while the owner stays the same', () => {
    const { result, rerender } = renderHook(
      ({ owner, seed }) => useReseeded(owner, () => seed),
      { initialProps: { owner: 'a', seed: ['one'] } },
    );

    act(() => result.current[1](['two']));
    rerender({ owner: 'a', seed: ['one'] });

    expect(result.current[0]).toEqual(['two']);
  });

  it('seeds again once the owner changes', () => {
    const { result, rerender } = renderHook(
      ({ owner, seed }) => useReseeded(owner, () => seed),
      { initialProps: { owner: 'a', seed: ['one'] } },
    );

    act(() => result.current[1](['two']));
    rerender({ owner: 'b', seed: ['three'] });

    expect(result.current[0]).toEqual(['three']);
  });

  it('seeds once the owner arrives after starting without one', () => {
    const { result, rerender } = renderHook(
      ({ owner, seed }) => useReseeded(owner, () => seed),
      {
        initialProps: {
          owner: undefined as string | undefined,
          seed: [] as string[],
        },
      },
    );

    rerender({ owner: 'a', seed: ['one'] });

    expect(result.current[0]).toEqual(['one']);
  });
});
