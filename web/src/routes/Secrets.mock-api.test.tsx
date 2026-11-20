import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { secretsPath } from '@/lib/settings';
import { serveMockApi } from '@/mocks/testing';
import { SLUG } from '@/mocks/world';
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

describe('Secrets on the mock API', () => {
  serveMockApi();
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
