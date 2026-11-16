import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PASSED_CHECK_FRESH_FOR_MS,
  useInferenceEndpointHealth,
} from '@/hooks/api/useInferenceEndpointHealth';
import type { ConnectionTest, InferenceEndpoint } from '@/lib/inference';

const answers: ConnectionTest[] = [];

const tested = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({ testInferenceEndpoint: tested }));

const ENDPOINT = {
  baseUrl: 'https://openrouter.ai/api/v1',
  model: 'anthropic/claude-sonnet-4.5',
  version: 1,
} as InferenceEndpoint;

const PASSED = { ok: true, message: 'The endpoint answered.' };

const FAILED = {
  ok: false,
  message:
    'The endpoint has no credits left (402). Please add credits at your provider.',
};

let client = new QueryClient();

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

const mounted = async () => {
  const { result, unmount } = renderHook(
    () => useInferenceEndpointHealth('ws_1', ENDPOINT, true),
    { wrapper },
  );
  await waitFor(() => expect(result.current.isFetching).toBe(false));
  unmount();

  return result.current.data;
};

describe('checking the inference endpoint when the page opens', () => {
  beforeEach(() => {
    client = new QueryClient();
    answers.length = 0;
    tested.mockReset();
    tested.mockImplementation(async () => ({ data: answers.shift() }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reuses a passing check for five minutes', async () => {
    answers.push(PASSED, PASSED);

    expect(await mounted()).toEqual(PASSED);
    expect(await mounted()).toEqual(PASSED);
    expect(tested).toHaveBeenCalledTimes(1);
  });

  it('checks again once a passing check is five minutes old', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    answers.push(PASSED, FAILED);

    await mounted();
    vi.setSystemTime(Date.now() + PASSED_CHECK_FRESH_FOR_MS + 1);

    expect(await mounted()).toEqual(FAILED);
    expect(tested).toHaveBeenCalledTimes(2);
  });

  it('checks a failing endpoint again each time the page opens', async () => {
    answers.push(FAILED, PASSED);

    expect(await mounted()).toEqual(FAILED);
    expect(await mounted()).toEqual(PASSED);
    expect(tested).toHaveBeenCalledTimes(2);
  });
});
