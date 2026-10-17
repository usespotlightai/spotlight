import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useRemembered } from '@/hooks/useRemembered';

const KEY = 'test.remembered';

beforeEach(() => window.localStorage.clear());

describe('useRemembered', () => {
  it('starts at the fallback where nothing was stored', () => {
    const { result } = renderHook(() => useRemembered(KEY, '30d'));

    expect(result.current[0]).toBe('30d');
  });

  it('gives back what it was told to remember, next time round', () => {
    const first = renderHook(() => useRemembered(KEY, '30d'));
    act(() => first.result.current[1]('7d'));

    expect(first.result.current[0]).toBe('7d');
    expect(renderHook(() => useRemembered(KEY, '30d')).result.current[0]).toBe(
      '7d',
    );
  });

  it('keeps what is remembered under one key out of another', () => {
    const first = renderHook(() => useRemembered(KEY, '30d'));
    act(() => first.result.current[1]('7d'));

    expect(
      renderHook(() => useRemembered('test.other', '30d')).result.current[0],
    ).toBe('30d');
  });
});
