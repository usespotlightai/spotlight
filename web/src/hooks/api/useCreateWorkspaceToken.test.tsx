import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useCreateWorkspaceToken,
  WorkspaceTokenNameTakenError,
} from '@/hooks/api/useCreateWorkspaceToken';
import { tokenKeys } from '@/hooks/api/useWorkspaceTokens';
import type { TokenTerms } from '@/lib/token';

const createWorkspaceToken = vi.fn();

vi.mock('@/lib/api', () => ({
  createWorkspaceToken: (options: unknown) => createWorkspaceToken(options),
}));

const TERMS: TokenTerms = {
  name: 'terraform',
  description: 'Applies the platform repository',
  scopes: ['configure', 'secrets'],
  expiresAt: '2026-12-29T12:00:00.000Z',
};

const answered = (
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
) => ({
  ...(status < 300 ? { data: body } : { error: body }),
  response: new Response(null, { status, headers }),
});

const creating = () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const invalidated = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return {
    result: renderHook(() => useCreateWorkspaceToken('workspace_acme'), {
      wrapper,
    }).result,
    invalidated,
  };
};

describe('useCreateWorkspaceToken', () => {
  beforeEach(() => {
    createWorkspaceToken.mockReset();
  });

  it('creates a token once, hands back the value Spotlight answered with, and lists the tokens anew', async () => {
    createWorkspaceToken.mockResolvedValue(
      answered(
        201,
        { name: 'terraform' },
        { 'Spotlight-Workspace-Token': 'token_secret' },
      ),
    );
    const { result, invalidated } = creating();

    act(() => result.current.mutate(TERMS));

    await waitFor(() =>
      expect(result.current.data).toEqual({
        name: 'terraform',
        token: 'token_secret',
      }),
    );
    expect(createWorkspaceToken).toHaveBeenCalledWith({
      path: { workspaceId: 'workspace_acme' },
      headers: { 'Idempotency-Key': expect.any(String) },
      body: TERMS,
    });
    expect(invalidated).toHaveBeenCalledWith({
      queryKey: tokenKeys.forWorkspace('workspace_acme'),
    });
  });

  it('says a taken name is taken, naming the token', async () => {
    createWorkspaceToken.mockResolvedValue(
      answered(409, {
        detail:
          'There is already a workspace-token at terraform; import it rather than creating it',
      }),
    );
    const { result } = creating();

    act(() => result.current.mutate(TERMS));

    await waitFor(() =>
      expect(result.current.error).toBeInstanceOf(WorkspaceTokenNameTakenError),
    );
    expect((result.current.error as WorkspaceTokenNameTakenError).token).toBe(
      'terraform',
    );
  });

  it('says what Spotlight found wrong with the token', async () => {
    createWorkspaceToken.mockResolvedValue(
      answered(422, {
        detail: 'scopes: include read, plan or configure',
      }),
    );
    const { result } = creating();

    act(() => result.current.mutate(TERMS));

    await waitFor(() =>
      expect(result.current.error?.message).toBe(
        'scopes: include read, plan or configure',
      ),
    );
  });

  it('fails when Spotlight answers no token', async () => {
    createWorkspaceToken.mockResolvedValue(
      answered(201, { name: 'terraform' }),
    );
    const { result } = creating();

    act(() => result.current.mutate(TERMS));

    await waitFor(() =>
      expect(result.current.error?.message).toBe('Could not create the token'),
    );
  });
});
