import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { runnersPath } from '@/lib/runner';
import { secretsPath } from '@/lib/settings';
import { api, json } from '@/mocks/http';
import { setScenario } from '@/mocks/scenario';
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
const UNDELIVERABLE =
  'No runner pool has egress, so no run sends it. Select the icon to see the runners.';
const UNUSED_LABEL = 'No run receives it';
const TO_RUNNERS = 'No run receives it. See runners';

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
      (await rowOf('STAGING_LOGIN_PASSWORD')).queryByText('Awaiting a value'),
    ).not.toBeInTheDocument();
    expect(
      (await rowOf('STAGING_LOGIN_PASSWORD')).getByRole('button', {
        name: 'Set value of STAGING_LOGIN_PASSWORD',
      }),
    ).toHaveAccessibleDescription(
      'Runs that need this secret fail until a person sets its value.',
    );
    expect(
      (await rowOf('STAGING_VIEWER_TOKEN')).getByRole('button', {
        name: 'Replace value of STAGING_VIEWER_TOKEN',
      }),
    ).toBeVisible();
  });

  it('says a secret awaits a value where the person may not set one', async () => {
    server.use(
      api.get('/workspaces/:slug/secrets', () =>
        json(
          settingsWorld().secrets.map((secret) => ({
            ...secret,
            settable: false,
          })),
        ),
      ),
    );
    render(<MockApplication at={secretsPath(SLUG)} />);

    const password = await rowOf('STAGING_LOGIN_PASSWORD');

    expect(password.getByText('Awaiting a value')).toBeVisible();
    expect(password.queryByRole('button')).not.toBeInTheDocument();
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

    const toRunners = (await rowOf('LINEAR_API_KEY')).getByRole('link', {
      name: TO_RUNNERS,
    });

    expect(toRunners).toHaveAttribute('href', runnersPath(SLUG));
    expect(toRunners).toHaveAccessibleDescription(UNDELIVERABLE);
    expect(
      (await rowOf('DEV_GITHUB_APP_KEY')).queryByRole('link', {
        name: TO_RUNNERS,
      }),
    ).not.toBeInTheDocument();
  });

  it('says nothing about egress while a runner pool has it', async () => {
    render(<MockApplication at={secretsPath(SLUG)} />);

    expect(
      (await rowOf('LINEAR_API_KEY')).queryByRole('link', {
        name: TO_RUNNERS,
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

    expect(
      (await rowOf('LINEAR_API_KEY')).getByRole('img', { name: UNUSED_LABEL }),
    ).toHaveAccessibleDescription(UNUSED);
    expect(
      (await rowOf('STAGING_VIEWER_TOKEN')).queryByRole('img', {
        name: UNUSED_LABEL,
      }),
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

    expect(
      linear.getByRole('link', { name: TO_RUNNERS }),
    ).toHaveAccessibleDescription(`${UNUSED} ${UNDELIVERABLE}`);
    expect(
      linear.queryByRole('img', { name: UNUSED_LABEL }),
    ).not.toBeInTheDocument();
    expect(
      (await rowOf('DEV_GITHUB_APP_KEY')).queryByRole('link', {
        name: TO_RUNNERS,
      }),
    ).not.toBeInTheDocument();
  });

  it('links to how to define a secret where there is none', async () => {
    setScenario({ state: 'empty' });
    render(<MockApplication at={secretsPath(SLUG)} />);

    expect(
      await screen.findByRole('link', { name: 'spotlight_secret' }, WAIT),
    ).toHaveAttribute(
      'href',
      'https://docs.usespotlight.ai/docs/reference/terraform/secret',
    );
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
