import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { inferenceSettingsPath } from '@/lib/settings';
import { api, json } from '@/mocks/http';
import { setScenario } from '@/mocks/scenario';
import { serveMockApi } from '@/mocks/testing';
import { SLUG } from '@/mocks/world';
import { MockApplication } from '@/stories/MockApplication';
import { quietBrowser } from '@/test/signed-in';

vi.mock('@/hooks/api/useSession', async () => ({
  useSession: (await import('@/test/signed-in')).signedInSession,
}));

const WAIT = { timeout: 5000 };

const opened = () =>
  render(<MockApplication at={inferenceSettingsPath(SLUG)} />);

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
    ).toHaveAttribute(
      'href',
      'https://docs.usespotlight.ai/docs/reference/terraform/inference-endpoint',
    );
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
  });
});
