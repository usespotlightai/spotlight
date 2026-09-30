import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRevokeWorkspaceToken } from '@/hooks/api/useRevokeWorkspaceToken';
import { tokenKeys } from '@/hooks/api/useWorkspaceTokens';

const deleteWorkspaceToken = vi.fn();

vi.mock('@/lib/api', () => ({
  deleteWorkspaceToken: (options: unknown) => deleteWorkspaceToken(options),
}));

const revoking = () => {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  const invalidated = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return {
    result: renderHook(() => useRevokeWorkspaceToken('workspace_acme'), {
      wrapper,
    }).result,
    invalidated,
  };
};

describe('useRevokeWorkspaceToken', () => {
  beforeEach(() => {
    deleteWorkspaceToken.mockReset();
  });

  it('revokes the version of the token it was shown, and lists the tokens anew', async () => {
    deleteWorkspaceToken.mockResolvedValue({});
    const { result, invalidated } = revoking();

    act(() => result.current.mutate({ id: 'token_1', version: 3 }));

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(deleteWorkspaceToken).toHaveBeenCalledWith({
      path: { id: 'token_1' },
      headers: { 'If-Match': '"3"' },
      throwOnError: true,
    });
    expect(invalidated).toHaveBeenCalledWith({
      queryKey: tokenKeys.forWorkspace('workspace_acme'),
    });
  });

  it('lists the tokens anew when the token had changed or gone', async () => {
    deleteWorkspaceToken.mockRejectedValue(
      new Error('The workspace-token is at version 4'),
    );
    const { result, invalidated } = revoking();

    act(() => result.current.mutate({ id: 'token_1', version: 3 }));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidated).toHaveBeenCalled();
  });
});
