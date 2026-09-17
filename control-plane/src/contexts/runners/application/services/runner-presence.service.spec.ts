import { RunnerPresence } from '@runners/application/services/runner-presence.service';
import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { RunnerMovedOnError } from '@runners/domain/exceptions/runner-moved-on.error';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const ID = RunnerId.of('runner_1');
const NOW = new Date('2026-01-02T03:04:05.000Z');

const stored = (...harnesses: string[]) =>
  Runner.rehydrate({
    id: ID,
    workspaceId: WorkspaceId.of('ws_1'),
    name: RunnerName.of('Laptop'),
    tokenHash: TokenHash.of('a'.repeat(64)),
    installed: harnesses.map((each) => InstalledHarness.reported(each, [])),
    revokedAt: null,
    lastSeenAt: null,
    version: 0,
  });

describe('RunnerPresence', () => {
  it('answers where the runner works and what it can run', async () => {
    const presence = new RunnerPresence({
      find: vi.fn(async () => stored('claude-code')),
      save: vi.fn(async () => {}),
    } as unknown as RunnerRepository);

    const seen = await presence.seen(ID, NOW);

    expect(seen?.workspaceId.value).toBe('ws_1');
    expect(seen?.harnesses.map((each) => each.value)).toEqual(['claude-code']);
  });

  it('keeps harnesses reported while it was reading, rather than writing over them', async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce(stored())
      .mockResolvedValueOnce(stored('claude-code'));
    const save = vi
      .fn()
      .mockRejectedValueOnce(new RunnerMovedOnError(ID.value))
      .mockResolvedValueOnce(undefined);

    const seen = await new RunnerPresence({
      find,
      save,
    } as unknown as RunnerRepository).seen(ID, NOW);

    expect(save.mock.calls[1]?.[0]).toMatchObject({ lastSeenAt: NOW });
    expect(seen?.harnesses.map((each) => each.value)).toEqual(['claude-code']);
  });

  it('knows nothing of a runner never enrolled', async () => {
    const presence = new RunnerPresence({
      find: vi.fn(async () => null),
    } as unknown as RunnerRepository);

    await expect(presence.seen(ID, NOW)).resolves.toBeNull();
  });
});
