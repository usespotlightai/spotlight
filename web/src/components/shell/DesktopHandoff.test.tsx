import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DesktopHandoff } from '@/components/shell/DesktopHandoff';
import { storeOpensInDesktop } from '@/lib/desktop';

const assign = vi.hoisted(() => vi.fn());

vi.mock('@/lib/desktop', async (actual) => ({
  ...(await actual<typeof import('@/lib/desktop')>()),
  openInDesktop: assign,
  handOffOnce: assign,
}));

const at = (path: string) => {
  window.history.replaceState(null, '', path);
};

describe('DesktopHandoff', () => {
  beforeEach(() => {
    assign.mockClear();
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    Reflect.deleteProperty(window, 'spotlightDesktop');
    at('/');
  });

  it('shows the page when this browser does not open links in the app', () => {
    at('/w/acme/inbox/task_1');
    render(<DesktopHandoff>The inbox</DesktopHandoff>);

    expect(screen.getByText('The inbox')).toBeVisible();
    expect(assign).not.toHaveBeenCalled();
  });

  it('opens the same page in the desktop app, and can stay in the browser', async () => {
    storeOpensInDesktop(true);
    at('/w/acme/inbox/task_1?tab=notes');
    render(<DesktopHandoff>The inbox</DesktopHandoff>);

    expect(assign).toHaveBeenCalledWith(
      'spotlight://open/w/acme/inbox/task_1?tab=notes',
    );
    expect(
      screen.getByText('Opened in the Spotlight desktop app.'),
    ).toBeVisible();

    await userEvent.click(
      screen.getByRole('button', { name: 'Open here instead' }),
    );

    expect(screen.getByText('The inbox')).toBeVisible();
  });

  it('leaves pages outside a workspace in the browser', () => {
    storeOpensInDesktop(true);
    at('/login');
    render(<DesktopHandoff>Log in</DesktopHandoff>);

    expect(assign).not.toHaveBeenCalled();
  });

  it('never hands off inside the desktop app itself', () => {
    storeOpensInDesktop(true);
    Object.assign(window, {
      spotlightDesktop: {
        platform: 'darwin',
        setBadge() {},
        show() {},
        authorize() {},
      },
    });
    at('/w/acme/inbox');
    render(<DesktopHandoff>The inbox</DesktopHandoff>);

    expect(assign).not.toHaveBeenCalled();
  });
});
