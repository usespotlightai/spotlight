import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useStoredState } from '@/hooks/useStoredState';

const KEY = 'test.stored';

beforeEach(() => window.localStorage.clear());

describe('useStoredState', () => {
  it('starts at the fallback where nothing was stored', () => {
    const { result } = renderHook(() => useStoredState(KEY, '30d'));

    expect(result.current[0]).toBe('30d');
  });

  it('gives back the stored value, next time round', () => {
    const first = renderHook(() => useStoredState(KEY, '30d'));
    act(() => first.result.current[1]('7d'));

    expect(first.result.current[0]).toBe('7d');
    expect(renderHook(() => useStoredState(KEY, '30d')).result.current[0]).toBe(
      '7d',
    );
  });

  it('keeps the value stored under one key out of another', () => {
    const first = renderHook(() => useStoredState(KEY, '30d'));
    act(() => first.result.current[1]('7d'));

    expect(
      renderHook(() => useStoredState('test.other', '30d')).result.current[0],
    ).toBe('30d');
  });
});
