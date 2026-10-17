import { HookCallbackGrants } from '@integrations/application/services/hook-callback-grants.service';
import type { HookCallbackGrant } from '@integrations/domain/aggregates/hook-callback-grant.aggregate';
import type { HookCallbackGrantRepository } from '@integrations/domain/repositories/hook-callback-grant.repository';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-26T10:00:00.000Z');

const HASH = 'a'.repeat(64);

const setUp = () => {
  const added: HookCallbackGrant[] = [];
  const kept = {
    add: vi.fn(async (grant: HookCallbackGrant) => {
      added.push(grant);
    }),
    withToken: vi.fn(async () => null),
    forgetExpiringBefore: vi.fn(async () => {}),
  } satisfies HookCallbackGrantRepository;
  const grants = new HookCallbackGrants(
    kept,
    { mint: () => ({ token: 'token', hash: HASH }), hash: () => HASH },
    { now: () => NOW, sleep: async () => {} },
  );

  return { grants, kept, added };
};

describe('HookCallbackGrants', () => {
  it('issues a grant from the clock and forgets those expired by then', async () => {
    const { grants, kept, added } = setUp();

    const token = await grants.issued({
      workspaceId: 'workspace_1',
      taskId: 'task_1',
      hook: 'dba-review',
      firing: null,
    });

    expect(token).toBe('token');
    expect(kept.forgetExpiringBefore).toHaveBeenCalledWith(NOW);
    expect(added[0]?.expiresAt).toEqual(new Date(NOW.getTime() + 15 * 60_000));
  });
});
