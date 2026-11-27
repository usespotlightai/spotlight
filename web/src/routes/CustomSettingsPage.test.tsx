import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CustomSettingsPageDto } from '@/lib/api';
import { CustomSettingsPage } from '@/routes/CustomSettingsPage';
import { htmlElement } from '@/test/elements';

const ELEMENT = 'x-custom-test-page';

customElements.define(ELEMENT, class extends HTMLElement {});

const handbook: CustomSettingsPageDto = {
  id: 'handbook',
  label: 'Handbook',
  group: 'workspace',
  roles: ['owner'],
  script: '/handbook/element.js',
  element: ELEMENT,
};

const pages = vi.fn<() => unknown>();
const role = vi.fn<() => string>();
const refetch = vi.fn();
const load = vi.fn<(page: unknown, attempt: number) => Promise<void>>();

vi.mock('@/hooks/api/useCustomSettingsPages', () => ({
  useCustomSettingsPages: () => {
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

const workspaceFails = vi.fn<() => boolean>();
const refetchWorkspace = vi.fn();

vi.mock('@/hooks/api/useWorkspace', () => ({
  useWorkspace: () =>
    workspaceFails()
      ? {
          data: undefined,
          isPending: false,
          errorUpdateCount: 1,
          isFetching: false,
          refetch: refetchWorkspace,
        }
      : {
          data: { slug: 'acme', role: role() },
          isPending: false,
          errorUpdateCount: 0,
          isFetching: false,
          refetch: refetchWorkspace,
        },
}));

vi.mock('@/lib/custom-settings-page-element', async (actual) => ({
  ...(await actual<typeof import('@/lib/custom-settings-page-element')>()),
  loadCustomSettingsPageElement: (page: unknown, attempt: number) =>
    load(page, attempt),
}));

const show = (at = '/w/acme/settings/custom/handbook') =>
  render(
    <MemoryRouter initialEntries={[at]}>
      <Routes>
        <Route
          path="/w/:slug/settings/custom/:pageId"
          element={<CustomSettingsPage />}
        />
        <Route path="/w/:slug/settings/general" element={<p>General page</p>} />
        <Route path="/w/:slug/settings/members" element={<p>Members page</p>} />
      </Routes>
    </MemoryRouter>,
  );

const shownElement = (): HTMLElement =>
  htmlElement(document.querySelector(ELEMENT));

describe('CustomSettingsPage', () => {
  beforeEach(() => {
    pages.mockReturnValue([handbook]);
    role.mockReturnValue('owner');
    load.mockReset().mockResolvedValue(undefined);
    refetch.mockReset();
    refetchWorkspace.mockReset();
    workspaceFails.mockReturnValue(false);
    document.documentElement.classList.remove('dark');
  });

  it('shows the element of the page under its title, with the workspace, the role and the theme', async () => {
    show();

    expect(
      await screen.findByRole('heading', { name: 'Handbook' }),
    ).toBeInTheDocument();
    const element = shownElement();
    expect(element.getAttribute('workspace')).toBe('acme');
    expect(element.getAttribute('workspace-role')).toBe('owner');
    expect(element.hasAttribute('role')).toBe(false);
    expect(element.getAttribute('theme')).toBe('light');
    expect(element.getAttribute('contract-version')).toBe('1');
  });

  it('tells the element when the theme changes', async () => {
    show();
    await screen.findByRole('heading', { name: 'Handbook' });

    await act(() => {
      document.documentElement.classList.add('dark');
      return Promise.resolve();
    });

    expect(shownElement().getAttribute('theme')).toBe('dark');
  });

  it('opens a path of the app that the element asks for', async () => {
    show();
    await screen.findByRole('heading', { name: 'Handbook' });

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
    await screen.findByRole('heading', { name: 'Handbook' });

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
    show('/w/acme/settings/custom/runbook');

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
      await screen.findByText('The Handbook page could not be loaded.'),
    ).toBeInTheDocument();

    load.mockResolvedValueOnce(undefined);
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await vi.waitFor(() => expect(shownElement()).toBeInTheDocument());
    expect(load.mock.calls.map(([, attempt]) => attempt)).toEqual([0, 1]);
  });

  it('says when the workspace does not load, and loads it again', async () => {
    const user = userEvent.setup();
    workspaceFails.mockReturnValue(true);
    show();

    expect(
      await screen.findByText('This page could not be loaded.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(refetchWorkspace).toHaveBeenCalledOnce();
    expect(refetch).not.toHaveBeenCalled();
  });

  it('says when the pages of the deployment do not load', async () => {
    pages.mockReturnValue('failed');
    show();

    expect(
      await screen.findByText('This page could not be loaded.'),
    ).toBeInTheDocument();
  });
});
