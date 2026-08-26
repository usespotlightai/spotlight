import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSidebarWidth } from '@/hooks/useSidebarWidth';

const PANE = {
  storageKey: 'test.pane',
  min: 200,
  max: 480,
  initial: 320,
  label: 'Resize the runner list',
};

const press = (
  handle: ReturnType<typeof useSidebarWidth>['handleProps'],
  key: string,
) =>
  act(() => {
    handle.onKeyDown({
      key,
      preventDefault: () => {},
    } as never);
  });

beforeEach(() => window.localStorage.clear());

describe('useSidebarWidth', () => {
  it('starts at the width the pane asked for', () => {
    const { result } = renderHook(() => useSidebarWidth(PANE));

    expect(result.current.width).toBe(320);
  });

  it('widens and narrows a step at a time from the keyboard', () => {
    const { result } = renderHook(() => useSidebarWidth(PANE));

    press(result.current.handleProps, 'ArrowRight');
    expect(result.current.width).toBe(336);

    press(result.current.handleProps, 'ArrowLeft');
    expect(result.current.width).toBe(320);
  });

  it('stays within the bounds the pane set', () => {
    const { result } = renderHook(() => useSidebarWidth(PANE));

    for (let i = 0; i < 40; i += 1) {
      press(result.current.handleProps, 'ArrowRight');
    }
    expect(result.current.width).toBe(PANE.max);

    for (let i = 0; i < 40; i += 1) {
      press(result.current.handleProps, 'ArrowLeft');
    }
    expect(result.current.width).toBe(PANE.min);
  });

  it('remembers the width under the key the pane gave', () => {
    const first = renderHook(() => useSidebarWidth(PANE));
    press(first.result.current.handleProps, 'ArrowRight');
    first.unmount();

    expect(window.localStorage.getItem(PANE.storageKey)).toBe('336');
    expect(renderHook(() => useSidebarWidth(PANE)).result.current.width).toBe(
      336,
    );
  });

  it('keeps two panes from sharing a width', () => {
    const other = { ...PANE, storageKey: 'test.other', initial: 224 };

    const fleet = renderHook(() => useSidebarWidth(PANE));
    press(fleet.result.current.handleProps, 'ArrowRight');

    expect(renderHook(() => useSidebarWidth(other)).result.current.width).toBe(
      224,
    );
  });

  it('describes itself with the label the pane gave', () => {
    const { result } = renderHook(() => useSidebarWidth(PANE));

    expect(result.current.handleProps['aria-label']).toBe(PANE.label);
    expect(result.current.handleProps['aria-valuemax']).toBe(PANE.max);
  });
});
