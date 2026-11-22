import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { HeldBack } from '@memory/domain/services/held-back';
import {
  checkedForUpkeep,
  type UpkeepEvidence,
} from '@memory/domain/services/upkeep-checks';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { UpkeepProposalId } from '@memory/domain/value-objects/upkeep-proposal-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-21T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const TEAM = TeamId.of('team_1');
const API = Repository.of('acme/api');

const memory = (
  handle: number,
  input: {
    repository?: Repository;
    paths?: string[];
    approvedDaysAgo?: number;
  } = {},
) =>
  Memory.write({
    id: MemoryId.of(`memory_${handle}`),
    handle: MemoryHandle.of(handle),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'rationale',
    body: MemoryBody.of('Uploads retry in the request.'),
    scope: MemoryScope.of({
      teamId: TEAM,
      repository: input.repository ?? null,
      paths: (input.paths ?? []).map((each) => MemoryPath.of(each)),
    }),
    provenance: null,
    by: MemoryDecision.of({
      by: UserId.of('user_1'),
      at: new Date(NOW.getTime() - (input.approvedDaysAgo ?? 1) * DAY),
    }),
  });

const evidence = (
  memories: Memory[],
  change: Partial<UpkeepEvidence> & {
    paths?: ReadonlyMap<string, ReadonlySet<string> | null>;
    lastUsed?: ReadonlyMap<string, Date>;
  } = {},
): UpkeepEvidence => {
  const {
    paths = new Map([
      [API.value, new Set(['src/billing.ts', 'src/queue/index.ts'])],
    ]),
    lastUsed = new Map<string, Date>(),
    ...rest
  } = change;

  return {
    now: NOW,
    memories,
    repositories: [API],
    treeOf: (repository) => paths.get(repository.value) ?? null,
    lastUsedOf: (memory) => lastUsed.get(memory.value) ?? null,
    heldBack: HeldBack.none(),
    ...rest,
  };
};

let ids = 0;
const newId = () => {
  ids += 1;
  return UpkeepProposalId.of(`proposal_${ids}`);
};

describe('upkeep checks', () => {
  it('proposes to retire a memory about paths that no longer exist on the default branch', () => {
    const [proposal] = checkedForUpkeep(
      evidence([memory(1, { repository: API, paths: ['src/uploads'] })]),
      newId,
    );

    expect(proposal?.change).toBe('retire');
    expect(proposal?.finding).toBe('path-gone');
    expect(proposal?.reason).toBe(
      '`src/uploads` no longer exists on the default branch of acme/api.',
    );
  });

  it('keeps a memory where one of its paths, or a file under it, still exists', () => {
    expect(
      checkedForUpkeep(
        evidence([
          memory(1, {
            repository: API,
            paths: ['src/uploads', 'src/billing.ts'],
          }),
          memory(2, { repository: API, paths: ['src/queue'] }),
        ]),
        newId,
      ),
    ).toEqual([]);
  });

  it('checks no paths where the repository could not be listed', () => {
    expect(
      checkedForUpkeep(
        evidence([memory(1, { repository: API, paths: ['src/uploads'] })], {
          paths: new Map([[API.value, null]]),
        }),
        newId,
      ),
    ).toEqual([]);
  });

  it('proposes to retire a memory about a repository none of the team’s lines works in', () => {
    const [proposal] = checkedForUpkeep(
      evidence([memory(1, { repository: Repository.of('acme/old') })]),
      newId,
    );

    expect(proposal?.finding).toBe('repository-gone');
    expect(proposal?.reason).toBe(
      "acme/old is no longer a repository of any of the team's lines.",
    );
  });

  it('proposes no repository as gone while the team works in no repository at all', () => {
    expect(
      checkedForUpkeep(
        evidence([memory(1, { repository: Repository.of('acme/old') })], {
          repositories: [],
        }),
        newId,
      ).map((each) => each.finding),
    ).not.toContain('repository-gone');
  });

  it('proposes to retire a memory no run used in 90 days, but not a newer one or one used lately', () => {
    const old = memory(1, { approvedDaysAgo: 120 });
    const used = memory(2, { approvedDaysAgo: 120 });
    const fresh = memory(3, { approvedDaysAgo: 30 });

    const proposals = checkedForUpkeep(
      evidence([old, used, fresh], {
        lastUsed: new Map([
          [used.id.value, new Date(NOW.getTime() - 10 * DAY)],
        ]),
      }),
      newId,
    );

    expect(
      proposals.map((each) => [each.finding, each.memories[0]?.value]),
    ).toEqual([['unused', 'memory_1']]);
  });

  it('leaves a memory a pending proposal already names', () => {
    expect(
      checkedForUpkeep(
        evidence([memory(1, { approvedDaysAgo: 120 })], {
          heldBack: HeldBack.of({
            open: [MemoryId.of('memory_1')],
            rejected: [],
          }),
        }),
        newId,
      ),
    ).toEqual([]);
  });

  it('proposes again only what a person has not turned down for the same finding', () => {
    const turnedDown = (finding: 'unused' | 'overlap') =>
      checkedForUpkeep(
        evidence([memory(1, { approvedDaysAgo: 120 })], {
          heldBack: HeldBack.of({
            open: [],
            rejected: [{ memoryId: MemoryId.of('memory_1'), finding }],
          }),
        }),
        newId,
      ).map((each) => each.finding);

    expect(turnedDown('unused')).toEqual([]);
    expect(turnedDown('overlap')).toEqual(['unused']);
  });
});
