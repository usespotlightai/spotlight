import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SettingsSidebar } from '@/components/shell/layout/SettingsSidebar';
import type { SettingsPageDto } from '@/lib/api';
import type { Role } from '@/lib/role';

const pages = vi.fn<() => SettingsPageDto[] | undefined>();

vi.mock('@/hooks/api/useRunners', () => ({
  useRunners: () => ({ data: undefined }),
}));

vi.mock('@/hooks/api/useSettingsPages', () => ({
  useSettingsPages: () => ({ data: pages() }),
}));

const page = (
  id: string,
  group: SettingsPageDto['group'],
  roles: SettingsPageDto['roles'],
): SettingsPageDto => ({
  id,
  label: id[0].toUpperCase() + id.slice(1),
  group,
  roles,
  script: `/${id}/element.js`,
  element: `x-${id}-page`,
});

const show = (role: Role) =>
  render(
    <MemoryRouter>
      <SettingsSidebar
        slug="acme"
        back="/w/acme"
        workspace={{ role, teams: [] }}
      />
    </MemoryRouter>,
  );

const group = (heading: string) =>
  screen.getByText(heading).closest('section') as HTMLElement;

describe('SettingsSidebar pages of the deployment', () => {
  beforeEach(() => {
    pages.mockReturnValue([
      page('billing', 'workspace', ['owner']),
      page('runbook', 'workspace', ['owner', 'admin', 'member']),
      page('profile', 'account', ['owner', 'admin', 'member']),
    ]);
  });

  it('shows each page in its group, as a link to the page', () => {
    show('owner');

    expect(screen.getByRole('link', { name: 'Billing' })).toHaveAttribute(
      'href',
      '/w/acme/settings/x/billing',
    );
    expect(screen.getByRole('link', { name: 'Runbook' })).toHaveAttribute(
      'href',
      '/w/acme/settings/x/runbook',
    );
    expect(
      within(group('Account')).getByRole('link', { name: 'Profile' }),
    ).toBeInTheDocument();
    expect(
      within(group('Workspace')).getByRole('link', { name: 'Billing' }),
    ).toBeInTheDocument();
  });

  it('hides a page from a role that it is not for', () => {
    show('member');

    expect(
      screen.queryByRole('link', { name: 'Billing' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Runbook' })).toBeInTheDocument();
  });

  it('shows the usual links while the pages load', () => {
    pages.mockReturnValue(undefined);
    show('owner');

    expect(screen.getByRole('link', { name: 'General' })).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Billing' }),
    ).not.toBeInTheDocument();
  });
});
