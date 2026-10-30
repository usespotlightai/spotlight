import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStoredState } from '@/hooks/useStoredState';

const KEY = 'test.stored';

beforeEach(() => window.localStorage.clear());

afterEach(() => vi.restoreAllMocks());

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

  it('gives the stored value to every holder of the key at once', () => {
    const first = renderHook(() => useStoredState(KEY, '30d'));
    const second = renderHook(() => useStoredState(KEY, '30d'));
    act(() => first.result.current[1]('7d'));

    expect(second.result.current[0]).toBe('7d');
  });

  it('keeps the value for this page when the browser refuses storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const first = renderHook(() => useStoredState('test.refused', '30d'));
    expect(first.result.current[0]).toBe('30d');

    act(() => first.result.current[1]('7d'));

    expect(first.result.current[0]).toBe('7d');
  });
});
