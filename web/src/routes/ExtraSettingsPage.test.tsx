import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SettingsPageDto } from '@/lib/api';
import { ExtraSettingsPage } from '@/routes/ExtraSettingsPage';

const ELEMENT = 'x-extra-test-page';

customElements.define(ELEMENT, class extends HTMLElement {});

const billing: SettingsPageDto = {
  id: 'billing',
  label: 'Billing',
  group: 'workspace',
  roles: ['owner'],
  script: '/billing/element.js',
  element: ELEMENT,
};

const pages = vi.fn<() => unknown>();
const role = vi.fn<() => string>();
const refetch = vi.fn();
const load = vi.fn<(page: unknown, attempt: number) => Promise<void>>();

vi.mock('@/hooks/api/useSettingsPages', () => ({
  useSettingsPages: () => {
    const data = pages();
    return {
      data,
      isPending: data === undefined,
      errorUpdateCount: data === 'failed' ? 1 : 0,
      isFetching: false,
      refetch,
      ...(data === 'failed' ? { data: undefined } : {}),
    };
  },
}));

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () => ({ data: { slug: 'acme', role: role() } }),
}));

vi.mock('@/lib/settings-page-element', async (actual) => ({
  ...(await actual<typeof import('@/lib/settings-page-element')>()),
  loadSettingsPageElement: (page: unknown, attempt: number) =>
    load(page, attempt),
}));

const show = (at = '/w/acme/settings/x/billing') =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route
          path="/w/:slug/settings/x/:pageId"
          element={<ExtraSettingsPage />}
        />
        <Route path="/w/:slug/settings/general" element={<p>General page</p>} />
        <Route path="/w/:slug/settings/members" element={<p>Members page</p>} />
      </Routes>
    </MemoryRouter>,
  );

const shownElement = () => document.querySelector(ELEMENT) as HTMLElement;

describe('ExtraSettingsPage', () => {
  beforeEach(() => {
    pages.mockReturnValue([billing]);
    role.mockReturnValue('owner');
    load.mockReset().mockResolvedValue(undefined);
    refetch.mockReset();
    document.documentElement.classList.remove('dark');
  });

  it('shows the element of the page under its title, with the workspace, the role and the theme', async () => {
    show();

    expect(
      await screen.findByRole('heading', { name: 'Billing' }),
    ).toBeInTheDocument();
    const element = shownElement();
    expect(element.getAttribute('workspace')).toBe('acme');
    expect(element.getAttribute('role')).toBe('owner');
    expect(element.getAttribute('theme')).toBe('light');
    expect(element.getAttribute('contract-version')).toBe('1');
  });

  it('tells the element when the theme changes', async () => {
    show();
    await screen.findByRole('heading', { name: 'Billing' });

    await act(async () => {
      document.documentElement.classList.add('dark');
    });

    expect(shownElement().getAttribute('theme')).toBe('dark');
  });

  it('opens a path of the app that the element asks for', async () => {
    show();
    await screen.findByRole('heading', { name: 'Billing' });

    act(() => {
      shownElement().dispatchEvent(
        new CustomEvent('spotlight-navigate', {
          bubbles: true,
          composed: true,
          detail: { to: '/w/acme/settings/members' },
        }),
      );
    });

    expect(await screen.findByText('Members page')).toBeInTheDocument();
  });

  it('does not open a URL on another origin that the element asks for', async () => {
    show();
    await screen.findByRole('heading', { name: 'Billing' });

    act(() => {
      shownElement().dispatchEvent(
        new CustomEvent('spotlight-navigate', {
          detail: { to: '//example.com/w/acme' },
        }),
      );
    });

    expect(shownElement()).toBeInTheDocument();
  });

  it('opens the general settings for a page that the deployment does not add', async () => {
    show('/w/acme/settings/x/runbook');

    expect(await screen.findByText('General page')).toBeInTheDocument();
  });

  it('opens the general settings for a role that the page is not for', async () => {
    role.mockReturnValue('member');
    show();

    expect(await screen.findByText('General page')).toBeInTheDocument();
  });

  it('says when the script does not load, and tries again with a new attempt', async () => {
    const user = userEvent.setup();
    load.mockReset().mockRejectedValueOnce(new Error('not defined in time'));
    show();

    expect(
      await screen.findByText('The Billing page could not be loaded.'),
    ).toBeInTheDocument();

    load.mockResolvedValueOnce(undefined);
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await vi.waitFor(() => expect(shownElement()).toBeInTheDocument());
    expect(load.mock.calls.map(([, attempt]) => attempt)).toEqual([0, 1]);
  });

  it('says when the pages of the deployment do not load', async () => {
    pages.mockReturnValue('failed');
    show();

    expect(
      await screen.findByText('This page could not be loaded.'),
    ).toBeInTheDocument();
  });
});
