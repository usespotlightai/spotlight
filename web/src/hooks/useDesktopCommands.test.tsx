import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { tabFor, useDesktopCommands } from '@/hooks/useDesktopCommands';

const TABS = ['a', 'b', 'c'].map((id) => ({
  id,
  path: `/w/acme/${id}`,
  title: id,
  back: [],
  forward: [],
}));

describe('tabFor', () => {
  const ids = (command: string, activeId = 'b') =>
    tabFor(command, TABS, activeId)?.id ?? null;

  it('picks the next and previous tab, around the ends', () => {
    expect(ids('next-tab')).toBe('c');
    expect(ids('next-tab', 'c')).toBe('a');
    expect(ids('previous-tab', 'a')).toBe('c');
  });

  it('picks a tab by its number, and the last tab', () => {
    expect(ids('tab-1')).toBe('a');
    expect(ids('tab-5')).toBeNull();
    expect(ids('last-tab')).toBe('c');
  });
});

describe('useDesktopCommands', () => {
  afterEach(() => {
    Reflect.deleteProperty(window, 'spotlightDesktop');
  });

  const listen = (tabs = TABS) => {
    let send: (command: string) => void = () => {};
    const close = vi.fn();
    Object.assign(window, {
      spotlightDesktop: {
        platform: 'darwin',
        setBadge() {},
        show() {},
        authorize() {},
        close,
        onCommand: (listener: (command: string) => void) => {
          send = listener;
          return () => {};
        },
      },
    });
    const actions = {
      select: vi.fn(),
      close: vi.fn(),
      open: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
    };
    renderHook(
      () => useDesktopCommands('acme', { tabs, activeId: 'b', ...actions }),
      {
        wrapper: ({ children }: { children: ReactNode }) => (
          <MemoryRouter>{children}</MemoryRouter>
        ),
      },
    );

    return { send: (command: string) => send(command), actions, close };
  };

  it('opens, switches and closes tabs from the menu', () => {
    const { send, actions } = listen();

    send('new-tab');
    send('tab-3');
    send('close-tab');

    expect(actions.open).toHaveBeenCalledOnce();
    expect(actions.select).toHaveBeenCalledWith('c');
    expect(actions.close).toHaveBeenCalledWith('b');
  });

  it('moves the active tab back and forward from the menu', () => {
    const { send, actions } = listen();

    send('back');
    send('forward');

    expect(actions.back).toHaveBeenCalledOnce();
    expect(actions.forward).toHaveBeenCalledOnce();
  });

  it('closes the window when the last tab is closed', () => {
    const { send, actions, close } = listen([TABS[1]]);

    send('close-tab');

    expect(actions.close).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalledOnce();
  });
});
