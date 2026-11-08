import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { notificationsPath } from '@/lib/notifications';
import { serveMockApi } from '@/mocks/testing';
import { SLUG } from '@/mocks/world';
import { MockApplication } from '@/stories/MockApplication';
import { quietBrowser } from '@/test/signed-in';

vi.mock('@/hooks/api/useSession', async () => ({
  useSession: (await import('@/test/signed-in')).signedInSession,
}));

const WAIT = { timeout: 5000 };

const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc';

const browserWith = (permission: NotificationPermission) => {
  const state = { permission, endpoint: null as string | null };
  const subscription = {
    get endpoint() {
      return ENDPOINT;
    },
    toJSON: () => ({ keys: { p256dh: 'p'.repeat(87), auth: 'a'.repeat(22) } }),
    unsubscribe: async () => {
      state.endpoint = null;
      return true;
    },
  };
  const pushManager = {
    getSubscription: async () => (state.endpoint ? subscription : null),
    subscribe: vi.fn(async () => {
      state.endpoint = ENDPOINT;
      return subscription;
    }),
  };
  const registration = { pushManager };

  const notification = Object.defineProperties(vi.fn(), {
    permission: { get: () => state.permission },
    requestPermission: {
      value: async () => {
        state.permission = 'granted';
        return state.permission;
      },
    },
  });

  vi.stubGlobal('Notification', notification);
  vi.stubGlobal('PushManager', class {});
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      register: async () => registration,
      getRegistration: async () => registration,
    },
  });

  return { pushManager, state };
};

describe('AccountNotifications on the mock API', () => {
  serveMockApi();
  quietBrowser();

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('turns Web Push on for this browser', async () => {
    const browser = browserWith('default');
    render(<MockApplication at={notificationsPath(SLUG)} />);

    expect(await screen.findByText('Off.', undefined, WAIT)).toBeVisible();
    await userEvent.click(
      screen.getByRole('switch', { name: 'New inbox items' }),
    );

    expect(
      await screen.findByText(
        'On. This browser shows new items, also when Spotlight is closed.',
        undefined,
        WAIT,
      ),
    ).toBeVisible();
    expect(browser.pushManager.subscribe).toHaveBeenCalledOnce();
  });

  it('turns Web Push off again', async () => {
    const browser = browserWith('granted');
    browser.state.endpoint = ENDPOINT;
    render(<MockApplication at={notificationsPath(SLUG)} />);

    await userEvent.click(
      await screen.findByRole('switch', { name: 'New inbox items' }, WAIT),
    );

    expect(await screen.findByText('Off.', undefined, WAIT)).toBeVisible();
    expect(browser.state.endpoint).toBeNull();
  });

  it('keeps the choice to open links in the desktop app for this browser', async () => {
    browserWith('default');
    render(<MockApplication at={notificationsPath(SLUG)} />);

    await userEvent.click(
      await screen.findByRole(
        'switch',
        { name: 'Open links in the desktop app' },
        WAIT,
      ),
    );

    expect(localStorage.getItem('spotlight.opens-in-desktop')).toBe('true');
    localStorage.clear();
  });

  it('opens the macOS notification settings from the desktop app, and offers no browser link setting there', async () => {
    browserWith('granted');
    const openNotificationSettings = vi.fn();
    Object.assign(window, {
      spotlightDesktop: {
        platform: 'darwin',
        setBadge() {},
        show() {},
        authorize() {},
        openNotificationSettings,
      },
    });
    const user = userEvent.setup();
    render(<MockApplication at={notificationsPath(SLUG)} />);

    await user.click(
      await screen.findByRole('button', { name: 'Open macOS Settings' }, WAIT),
    );
    expect(openNotificationSettings).toHaveBeenCalledOnce();
    expect(
      screen.queryByRole('switch', { name: 'Open links in the desktop app' }),
    ).toBeNull();
    Reflect.deleteProperty(window, 'spotlightDesktop');
  });

  it('says what to do when the browser blocks notifications', async () => {
    browserWith('denied');
    render(<MockApplication at={notificationsPath(SLUG)} />);

    expect(
      await screen.findByText(
        'The browser blocks notifications from Spotlight. To turn them on, allow notifications for this site in the browser settings.',
        undefined,
        WAIT,
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('switch', { name: 'New inbox items' }),
    ).toHaveAttribute('aria-disabled', 'true');
  });
});
