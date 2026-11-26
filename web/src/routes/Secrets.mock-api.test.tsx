import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { runnersPath } from '@/lib/runner';
import { secretsPath } from '@/lib/settings';
import { api, json } from '@/mocks/http';
import { serveMockApi } from '@/mocks/testing';
import { SLUG } from '@/mocks/world';
import { settingsWorld } from '@/mocks/world/settings';
import { MockApplication } from '@/stories/MockApplication';
import { quietBrowser } from '@/test/signed-in';

vi.mock('@/hooks/api/useSession', async () => ({
  useSession: (await import('@/test/signed-in')).signedInSession,
}));

const WAIT = { timeout: 5000 };

const secrets = async () =>
  within(await screen.findByRole('list', { name: 'Secrets' }, WAIT));

const rowOf = async (name: string) => {
  const row = (
    await (await secrets()).findByText(name, undefined, WAIT)
  ).closest('li');

  if (!row) {
    throw new Error(`no row for ${name}`);
  }

  return within(row);
};

const UNUSED =
  'No harness profile or integration uses this secret, so no run receives it.';

describe('Secrets on the mock API', () => {
  const server = serveMockApi();
  quietBrowser();

  it('says where each value comes from, and offers a value only where a person may set one', async () => {
    render(<MockApplication at={secretsPath(SLUG)} />);

    expect(
      (await rowOf('LINEAR_API_KEY')).getByText('Set by Terraform'),
    ).toBeVisible();
    expect(
      (await rowOf('LINEAR_API_KEY')).queryByRole('button'),
    ).not.toBeInTheDocument();
    expect(
      (await rowOf('STAGING_LOGIN_PASSWORD')).getByText('Awaiting a value'),
    ).toBeVisible();
    expect(
      (await rowOf('STAGING_VIEWER_TOKEN')).getByRole('button', {
        name: 'Replace value of STAGING_VIEWER_TOKEN',
      }),
    ).toBeVisible();
  });

  it('says no run sends a secret while no runner pool has egress, and links to the runners', async () => {
    server.use(
      api.get('/workspaces/:slug/secrets', () =>
        json(
          settingsWorld().secrets.map((secret) => ({
            ...secret,
            reach: { usedByRuns: true, deliverable: secret.hosts.length === 0 },
          })),
        ),
      ),
    );
    render(<MockApplication at={secretsPath(SLUG)} />);

    const linear = await rowOf('LINEAR_API_KEY');

    expect(
      linear.getByText('No runner pool has egress, so no run sends it.', {
        exact: false,
      }),
    ).toBeVisible();
    expect(linear.getByRole('link', { name: 'See runners' })).toHaveAttribute(
      'href',
      runnersPath(SLUG),
    );
    expect(
      (await rowOf('DEV_GITHUB_APP_KEY')).queryByText(
        'No runner pool has egress',
        { exact: false },
      ),
    ).not.toBeInTheDocument();
  });

  it('says nothing about egress while a runner pool has it', async () => {
    render(<MockApplication at={secretsPath(SLUG)} />);

    expect(
      (await rowOf('LINEAR_API_KEY')).queryByText('No runner pool has egress', {
        exact: false,
      }),
    ).not.toBeInTheDocument();
  });

  it('says no run receives a secret that no harness profile or integration uses', async () => {
    server.use(
      api.get('/workspaces/:slug/secrets', () =>
        json(
          settingsWorld().secrets.map((secret) => ({
            ...secret,
            reach: {
              usedByRuns: secret.name !== 'LINEAR_API_KEY',
              deliverable: true,
            },
          })),
        ),
      ),
    );
    render(<MockApplication at={secretsPath(SLUG)} />);

    expect((await rowOf('LINEAR_API_KEY')).getByText(UNUSED)).toBeVisible();
    expect(
      (await rowOf('STAGING_VIEWER_TOKEN')).queryByText(UNUSED),
    ).not.toBeInTheDocument();
  });

  it('says both when nothing uses a secret and no runner pool could send it', async () => {
    server.use(
      api.get('/workspaces/:slug/secrets', () =>
        json(
          settingsWorld().secrets.map((secret) => ({
            ...secret,
            reach: {
              usedByRuns: secret.name !== 'LINEAR_API_KEY',
              deliverable: secret.hosts.length === 0,
            },
          })),
        ),
      ),
    );
    render(<MockApplication at={secretsPath(SLUG)} />);

    const linear = await rowOf('LINEAR_API_KEY');

    expect(linear.getByText(UNUSED)).toBeVisible();
    expect(
      linear.getByText('No runner pool has egress, so no run sends it.', {
        exact: false,
      }),
    ).toBeVisible();
    expect(
      (await rowOf('DEV_GITHUB_APP_KEY')).queryByText(UNUSED),
    ).not.toBeInTheDocument();
  });

  it('sets the value of a secret that awaits one, and never shows it', async () => {
    render(<MockApplication at={secretsPath(SLUG)} />);

    await userEvent.click(
      (await rowOf('STAGING_LOGIN_PASSWORD')).getByRole('button', {
        name: 'Set value of STAGING_LOGIN_PASSWORD',
      }),
    );
    const field = await screen.findByLabelText('Value');
    expect(field).toHaveAttribute('type', 'password');
    await userEvent.type(field, 'hunter2{Enter}');

    expect(
      await (
        await rowOf('STAGING_LOGIN_PASSWORD')
      ).findByText('Set just now', undefined, WAIT),
    ).toBeVisible();
    expect(screen.queryByText('hunter2')).not.toBeInTheDocument();
  });
});
