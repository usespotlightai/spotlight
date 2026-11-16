import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { teamSettingsPath, workspaceGeneralPath } from '@/lib/settings';
import { api, json } from '@/mocks/http';
import { setScenario } from '@/mocks/scenario';
import { serveMockApi } from '@/mocks/testing';
import { PLATFORM_ID, SLUG } from '@/mocks/world';
import { MockApplication } from '@/stories/MockApplication';
import { quietBrowser } from '@/test/signed-in';

vi.mock('@/hooks/api/useSession', async () => ({
  useSession: (await import('@/test/signed-in')).signedInSession,
}));

vi.mock('@/lib/avatar-image', () => ({
  avatarUploadOf: () =>
    Promise.resolve({ contentType: 'image/webp', data: 'UklGRg==' }),
}));

const WAIT = { timeout: 5000 };

const IMAGE = new File(['image'], 'logo.png', { type: 'image/png' });

describe('Avatars on the mock API', () => {
  serveMockApi();
  quietBrowser();

  it('uploads the workspace’s avatar and removes it again', async () => {
    render(<MockApplication at={workspaceGeneralPath(SLUG)} />);

    await userEvent.upload(
      await screen.findByLabelText('Avatar image for Acme', undefined, WAIT),
      IMAGE,
    );
    await waitFor(
      () =>
        expect(
          screen.getByRole('button', { name: 'Change the avatar of Acme' }),
        ).toHaveAttribute('aria-haspopup', 'menu'),
      WAIT,
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Change the avatar of Acme' }),
    );
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Remove' }, WAIT),
    );

    await waitFor(
      () =>
        expect(
          screen.getByRole('button', { name: 'Change the avatar of Acme' }),
        ).not.toHaveAttribute('aria-haspopup'),
      WAIT,
    );
  });

  it('uploads a team’s avatar', async () => {
    render(
      <MockApplication at={teamSettingsPath(SLUG, PLATFORM_ID, 'general')} />,
    );

    await userEvent.upload(
      await screen.findByLabelText(
        'Avatar image for Platform',
        undefined,
        WAIT,
      ),
      IMAGE,
    );

    await waitFor(
      () =>
        expect(
          screen.getByRole('button', { name: 'Change the avatar of Platform' }),
        ).toHaveAttribute('aria-haspopup', 'menu'),
      WAIT,
    );
  });
});

const opened = () =>
  render(<MockApplication at={workspaceGeneralPath(SLUG)} />);

const TEST_ROUTE =
  '/v1/resources/workspaces/:workspaceId/inference-endpoint/test';

const testsTo = (bodies: unknown[], answer: object) =>
  api.post(TEST_ROUTE, async ({ request }) => {
    bodies.push(await request.clone().json());
    return json(answer);
  });

const ANSWERED = { ok: true, message: 'The endpoint answered.' };

const NO_CREDITS = {
  ok: false,
  message:
    'The endpoint has no credits left (402). Please add credits at your provider.',
};

const PROBLEM = { name: 'The endpoint check failed' };

const TERRAFORM_DOCS =
  'https://docs.usespotlight.ai/docs/reference/terraform/inference-endpoint';

describe('Inference settings on the mock API', () => {
  const server = serveMockApi();
  quietBrowser();

  it('shows the model and the host, checks the endpoint, and offers nothing to change', async () => {
    const bodies: unknown[] = [];
    server.use(testsTo(bodies, ANSWERED));
    opened();

    expect(
      await screen.findByText('anthropic/claude-sonnet-4.5', undefined, WAIT),
    ).toBeVisible();
    expect(screen.getByText('openrouter.ai')).toBeVisible();
    await vi.waitFor(() => expect(bodies).toHaveLength(1), WAIT);
    expect(bodies).toEqual([
      {
        baseUrl: 'https://openrouter.ai/api/v1',
        model: 'anthropic/claude-sonnet-4.5',
      },
    ]);
    expect(screen.queryByRole('img', PROBLEM)).toBeNull();
    expect(
      screen.queryByRole('button', { name: /edit|add|remove/i }),
    ).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Edit in Terraform' }),
    ).toHaveAttribute('href', TERRAFORM_DOCS);
  });

  it('marks the endpoint when the check fails', async () => {
    server.use(testsTo([], NO_CREDITS));
    opened();

    expect(await screen.findByRole('img', PROBLEM, WAIT)).toHaveAttribute(
      'data-slot',
      'inference-endpoint-problem',
    );
  });

  it('links to the Terraform docs when nothing is set up', async () => {
    setScenario({ state: 'empty' });
    opened();

    expect(
      await screen.findByText('No inference endpoint', undefined, WAIT),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Set up in Terraform' }),
    ).toHaveAttribute('href', TERRAFORM_DOCS);
    expect(screen.queryByRole('button', { name: /add/i })).toBeNull();
  });

  it('shows a member the endpoint without checking it', async () => {
    const bodies: unknown[] = [];
    server.use(testsTo(bodies, NO_CREDITS));
    setScenario({ account: 'member' });
    opened();

    expect(
      await screen.findByText('anthropic/claude-sonnet-4.5', undefined, WAIT),
    ).toBeVisible();
    expect(bodies).toEqual([]);
    expect(screen.queryByRole('img', PROBLEM)).toBeNull();
    expect(
      screen.queryByRole('link', { name: 'Edit in Terraform' }),
    ).toBeNull();
  });
});
