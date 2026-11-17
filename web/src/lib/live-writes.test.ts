import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setLive } from '@/lib/live';
import { LIVE_SEQUENCES_HEADER, liveSequences } from '@/lib/live-sequences';
import { refreshAfterWrite, WRITE_WAIT_MS } from '@/lib/live-writes';

const responded = (header?: string) =>
  new Response(null, {
    headers: header ? { [LIVE_SEQUENCES_HEADER]: header } : {},
  });

const cached = () => {
  const client = new QueryClient();
  client.setQueryData(['tasks', 'team_1'], [], { updatedAt: 50 });
  client.setQueryData(['inbox', 'acme'], [], { updatedAt: 300 });
  const invalidated = vi.spyOn(client, 'invalidateQueries');

  return { client, invalidated };
};

describe('refreshAfterWrite', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    liveSequences.reset({ 'workspace:ws_1': 4 });
  });

  afterEach(() => {
    setLive(false);
    vi.useRealTimers();
  });

  it('refreshes what the write touched when the stream is down', async () => {
    const { client, invalidated } = cached();

    await refreshAfterWrite(client, responded('workspace:ws_1@5'), [['tasks']]);

    expect(invalidated).toHaveBeenCalledWith({ queryKey: ['tasks'] });
  });

  it('refreshes what the write touched when it made no numbered change', async () => {
    const { client, invalidated } = cached();
    setLive(true);

    await refreshAfterWrite(client, responded(), [['tasks']]);

    expect(invalidated).toHaveBeenCalledWith({ queryKey: ['tasks'] });
  });

  it('waits for the stream to refresh the change, then refreshes only what that refresh kept', async () => {
    const { client, invalidated } = cached();
    setLive(true);

    const refreshing = refreshAfterWrite(
      client,
      responded('workspace:ws_1@5'),
      [['tasks'], ['inbox']],
    );
    liveSequences.settle(
      { 'workspace:ws_1': 5 },
      new Set([
        client.getQueryCache().find({ queryKey: ['tasks', 'team_1'] })
          ?.queryHash ?? '',
      ]),
    );
    await refreshing;

    expect(invalidated.mock.calls).toEqual([
      [{ queryKey: ['tasks', 'team_1'], exact: true }],
    ]);
  });

  it('does not wait for a change on a channel this person does not watch', async () => {
    const { client, invalidated } = cached();
    setLive(true);

    await refreshAfterWrite(client, responded('workspace:ws_9@5'), [['tasks']]);

    expect(invalidated).toHaveBeenCalledWith({ queryKey: ['tasks'] });
  });

  it('refreshes what the write touched when the stream does not answer in time', async () => {
    const { client, invalidated } = cached();
    setLive(true);

    const refreshing = refreshAfterWrite(
      client,
      responded('workspace:ws_1@5'),
      [['tasks']],
    );
    await vi.advanceTimersByTimeAsync(WRITE_WAIT_MS);
    await refreshing;

    expect(invalidated).toHaveBeenCalledWith({ queryKey: ['tasks'] });
  });
});
