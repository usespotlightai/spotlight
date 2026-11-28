import { QueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { failuresToasted } from '@/lib/failure-toasts';
import { withSentRequest } from '@/lib/request-failure';

type Shown = { type: string; title: string; description: ReactNode };

const added = vi.fn<(shown: Shown) => unknown>();

vi.mock('@/lib/toast', () => ({
  toast: { add: (shown: Shown) => added(shown) },
}));

const failing = async (
  thrown: unknown,
  { meta, debug = false }: { meta?: { quiet?: boolean }; debug?: boolean } = {},
) => {
  const client = new QueryClient({ mutationCache: failuresToasted({ debug }) });

  await client
    .getMutationCache()
    .build(client, {
      // oxlint-disable-next-line typescript/prefer-promise-reject-errors -- the toasts are tested against values that are not errors
      mutationFn: () => Promise.reject(thrown),
      meta,
    })
    .execute(undefined)
    .catch(() => undefined);
};

const shown = () => {
  const [toast] = added.mock.calls[0];
  const { container } = render(<div>{toast.description}</div>);
  return { ...toast, detail: container.textContent };
};

const TAKEN =
  'Tidepool Labs already uses this GitHub installation. Install the App on another account for this workspace.';

const CONNECT = new Request(
  'http://localhost/api/workspaces/evidence-labs/github',
  { method: 'POST' },
);

const taken = () =>
  withSentRequest(
    { statusCode: 409, error: 'Conflict', message: TAKEN },
    new Response(null, { status: 409 }),
    CONNECT,
  );

beforeEach(() => added.mockReset());

describe('failure toasts', () => {
  it('shows a person only what the server said', async () => {
    await failing(taken());

    const toast = shown();

    expect(toast).toMatchObject({ type: 'error', title: TAKEN });
    expect(toast.description).toBeUndefined();
    expect(toast.detail).toBe('');
  });

  it('keeps the status and the request for development builds', async () => {
    await failing(taken(), { debug: true });

    const toast = shown();

    expect(toast.title).toBe(TAKEN);
    expect(
      screen.getByText(
        '409 Conflict · POST /api/workspaces/evidence-labs/github',
      ),
    ).toBeInTheDocument();
  });

  it('says no response came back when the request never reached the server', async () => {
    await failing(
      withSentRequest(new TypeError('Failed to fetch'), undefined, CONNECT),
    );

    const toast = shown();

    expect(toast.title).toBe('Network error. Control plane didn’t respond.');
    expect(toast.description).toBeUndefined();
  });

  it('says no response came back when a gateway answered instead of the server', async () => {
    await failing(
      withSentRequest(
        '<html>Bad Gateway</html>',
        new Response(null, { status: 502 }),
        CONNECT,
      ),
    );

    expect(shown().title).toBe('Network error. Control plane didn’t respond.');
  });

  it('keeps what the control plane said when it answers with a gateway status', async () => {
    await failing(
      withSentRequest(
        {
          status: 502,
          title: 'Bad Gateway',
          detail: 'Client registration for integration Linear failed.',
        },
        new Response(null, { status: 502 }),
        CONNECT,
      ),
    );

    expect(shown().title).toBe(
      'Client registration for integration Linear failed.',
    );
  });

  it('reads the message of a problem body', async () => {
    await failing({ status: 422, title: 'Invalid', detail: 'name is empty' });

    expect(shown()).toMatchObject({
      title: 'name is empty',
      description: undefined,
    });
  });

  it('shows the message a change put in its own error', async () => {
    await failing(new Error('Sorry, the member couldn’t be added.'), {
      debug: true,
    });

    expect(shown()).toMatchObject({
      title: 'Sorry, the member couldn’t be added.',
      description: undefined,
    });
  });

  it('says the request failed where the server gave no message', async () => {
    await failing(
      withSentRequest(
        { statusCode: 500 },
        new Response(null, { status: 500 }),
        CONNECT,
      ),
    );

    expect(shown().title).toBe('Sorry, the request failed.');
  });

  it('stays quiet for a change that reports its own failure', async () => {
    await failing(new Error('Not now'), { meta: { quiet: true } });

    expect(added).not.toHaveBeenCalled();
  });
});
