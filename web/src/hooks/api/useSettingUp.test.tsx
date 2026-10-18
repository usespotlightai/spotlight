import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { inboxKeys } from '@/hooks/api/useInbox';
import { lineKeys } from '@/hooks/api/useLines';
import { useSettingUp } from '@/hooks/api/useSettingUp';
import { workspaceKeys } from '@/hooks/api/useWorkspaces';
import type { WorkspaceResponseDto } from '@/lib/api';
import {
  clearCreatedHere,
  markCreatedHere,
  wasCreatedHere,
} from '@/lib/setup-status';

const readOnboarding = vi.fn();

vi.mock('@/lib/api', () => ({
  readOnboarding: (options: unknown) => readOnboarding(options),
}));

type SetupStatus = WorkspaceResponseDto['setupStatus'];

const PLATFORM = { id: 'team_1', name: 'Platform' };

const ACME: WorkspaceResponseDto = {
  id: 'ws_1',
  name: 'Acme',
  slug: 'acme',
  role: 'owner',
  teams: [PLATFORM],
  setupStatus: 'done',
};

const CREATING: WorkspaceResponseDto = {
  ...ACME,
  teams: [],
  setupStatus: 'pending',
};

const onboarding = (provisioning: SetupStatus) => ({
  data: { provisioning, steps: [], canSetUp: false, setupChat: null },
});

const answering = () => {
  let answer: (provisioning: SetupStatus) => void = () => undefined;

  readOnboarding.mockReturnValue(
    new Promise((resolve) => {
      answer = (provisioning) => resolve(onboarding(provisioning));
    }),
  );

  return (provisioning: SetupStatus) => answer(provisioning);
};

type Props = {
  readonly slug: string;
  readonly workspace: WorkspaceResponseDto;
};

const watching = (workspace: WorkspaceResponseDto, opened = false) => {
  if (opened) {
    markCreatedHere('acme');
  }

  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const invalidated = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(
    ({ slug, workspace }: Props) => useSettingUp(slug, workspace),
    { wrapper, initialProps: { slug: 'acme', workspace } },
  );
  const loaded = () =>
    waitFor(() =>
      expect(
        client.getQueryState(['onboarding', PLATFORM.id])?.status,
      ).not.toBe('pending'),
    );

  return { ...hook, client, invalidated, loaded };
};

const refreshed = (invalidated: ReturnType<typeof vi.spyOn>) => {
  expect(invalidated).toHaveBeenCalledWith({
    queryKey: workspaceKeys.detail('acme'),
  });
  expect(invalidated).toHaveBeenCalledWith({
    queryKey: inboxKeys.forWorkspace('acme'),
  });
  expect(invalidated).toHaveBeenCalledWith({
    queryKey: lineKeys.forTeam(PLATFORM.id),
  });
};

describe('useSettingUp', () => {
  beforeEach(() => {
    readOnboarding.mockReset();
  });

  afterEach(() => {
    clearCreatedHere('acme');
  });

  it('reads as setting up while Spotlight still provisions the team of a workspace created here', async () => {
    readOnboarding.mockResolvedValue(onboarding('pending'));

    const { result, loaded } = watching(ACME, true);

    await loaded();
    expect(result.current).toBe(true);
  });

  it('reads as set up once the team is provisioned, fetches the workspace, inbox and lines anew, and clears the mark of a workspace created here', async () => {
    readOnboarding.mockResolvedValue(onboarding('pending'));

    const { result, client, invalidated, loaded } = watching(ACME, true);

    await loaded();
    expect(result.current).toBe(true);

    readOnboarding.mockResolvedValue(onboarding('done'));
    await client.refetchQueries({ queryKey: ['onboarding', PLATFORM.id] });

    await waitFor(() => expect(result.current).toBe(false));
    refreshed(invalidated);
    expect(wasCreatedHere('acme')).toBe(false);
  });

  it('waits for the first team while Spotlight creates it, and then for that team', async () => {
    const answer = answering();

    const { result, rerender } = watching(CREATING);

    expect(result.current).toBe(true);

    rerender({ slug: 'acme', workspace: ACME });

    expect(result.current).toBe(true);

    answer('done');

    await waitFor(() => expect(result.current).toBe(false));
  });

  it('waits while the team of a workspace created here still loads', async () => {
    const answer = answering();

    const { result } = watching(ACME, true);

    expect(result.current).toBe(true);

    answer('done');

    await waitFor(() => expect(result.current).toBe(false));
  });

  it('reads no team onboarding on an ordinary visit', () => {
    const { result } = watching(ACME);

    expect(result.current).toBe(false);
    expect(readOnboarding).not.toHaveBeenCalled();
  });

  it('stops waiting when the person moves to another workspace', () => {
    answering();

    const { result, rerender } = watching(ACME, true);

    rerender({ slug: 'globex', workspace: { ...ACME, slug: 'globex' } });

    expect(result.current).toBe(false);
  });

  it('stops setting up when the setup failed', async () => {
    readOnboarding.mockResolvedValue(onboarding('failed'));

    const { result, loaded } = watching(ACME, true);

    await loaded();
    expect(result.current).toBe(false);
  });

  it('does not block the workspace when the onboarding cannot be read', async () => {
    readOnboarding.mockRejectedValue(new Error('offline'));

    const { result, loaded } = watching(ACME, true);

    await loaded();
    expect(result.current).toBe(false);
  });
});
