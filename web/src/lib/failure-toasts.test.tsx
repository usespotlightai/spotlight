import { QueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { failuresToasted } from '@/lib/failure-toasts';
import { withSentRequest } from '@/lib/request-failure';

const added = vi.fn();

vi.mock('@/lib/toast', () => ({
  toast: { add: (shown: unknown) => added(shown) },
}));

const failing = async (thrown: unknown, meta?: { quiet?: boolean }) => {
  const client = new QueryClient({ mutationCache: failuresToasted() });

  await client
    .getMutationCache()
    .build(client, {
      mutationFn: () => Promise.reject(thrown),
      meta,
    })
    .execute(undefined)
    .catch(() => undefined);
};

const shown = () => {
  const toast = added.mock.calls[0]?.[0] as {
    type: string;
    title: string;
    description: ReactNode;
  };
  render(<div>{toast.description}</div>);
  return toast;
};

const ACCEPT = new Request(
  'http://localhost/api/teams/team_1/chats/chat_1/proposals/2/accept',
  { method: 'POST' },
);

beforeEach(() => added.mockReset());

describe('failure toasts', () => {
  it('names the status, the reason and the request that failed', async () => {
    await failing(
      withSentRequest(
        {
          statusCode: 409,
          error: 'Conflict',
          message: 'This proposal was already settled.',
        },
        new Response(null, { status: 409 }),
        ACCEPT,
      ),
    );

    const toast = shown();

    expect(toast).toMatchObject({ type: 'error', title: '409 Conflict' });
    expect(
      screen.getByText('This proposal was already settled.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'POST /api/teams/team_1/chats/chat_1/proposals/2/accept',
      ),
    ).toBeInTheDocument();
  });

  it('says no response came back when the request never reached the server', async () => {
    await failing(
      withSentRequest(new TypeError('Failed to fetch'), undefined, ACCEPT),
    );

    const toast = shown();

    expect(toast.title).toBe('Network error. Control plane didn’t respond.');
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
  });

  it('reads the status of a problem body', async () => {
    await failing({ status: 422, title: 'Invalid', detail: 'name is empty' });

    expect(shown().title).toBe('422 Unprocessable Content');
    expect(screen.getByText('name is empty')).toBeInTheDocument();
  });

  it('stays quiet for a change that reports its own failure', async () => {
    await failing(new Error('Not now'), { quiet: true });

    expect(added).not.toHaveBeenCalled();
  });
});
