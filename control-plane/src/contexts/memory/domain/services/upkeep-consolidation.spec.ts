import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { HeldBack } from '@memory/domain/services/held-back';
import {
  consolidatedForUpkeep,
  consolidationGroupsOf,
} from '@memory/domain/services/upkeep-consolidation';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import type { MemoryKind } from '@memory/domain/value-objects/memory-kind';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { UpkeepProposalId } from '@memory/domain/value-objects/upkeep-proposal-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');
const AT_STATION = MemoryScope.of({
  teamId: TEAM,
  lineId: LineId.of('line_1'),
  stationId: StationId.of('station_1'),
});

const memory = (
  handle: number,
  scope = MemoryScope.of({ teamId: TEAM }),
  kind: MemoryKind = 'preference',
) =>
  Memory.write({
    id: MemoryId.of(`memory_${handle}`),
    handle: MemoryHandle.of(handle),
    workspaceId: WorkspaceId.of('ws_1'),
    kind,
    body: MemoryBody.of(`Memory ${handle}.`),
    scope,
    provenance: null,
    by: MemoryDecision.of({ by: UserId.of('user_1'), at: new Date() }),
  });

const MEMORIES = [
  memory(1),
  memory(2),
  memory(3, AT_STATION),
  memory(4),
  memory(5, MemoryScope.of({ teamId: TEAM }), 'environment'),
];

const consolidated = (
  suggestions: Parameters<typeof consolidatedForUpkeep>[0]['suggestions'],
  heldBack: HeldBack = HeldBack.none(),
) => {
  let ids = 0;
  return consolidatedForUpkeep({
    suggestions,
    memories: MEMORIES,
    heldBack,
    newId: () => {
      ids += 1;
      return UpkeepProposalId.of(`proposal_${ids}`);
    },
  });
};

describe('consolidating what the team remembers', () => {
  it('merges memories that apply in the same place into one', () => {
    const [merge] = consolidated([
      {
        change: 'merge',
        handles: ['M-1', 'm-2'],
        body: 'One rule.',
        reason: 'M-1 and M-2 say the same.',
      },
    ]);

    expect(merge?.change).toBe('merge');
    expect(merge?.memories.map((each) => each.value)).toEqual([
      'memory_1',
      'memory_2',
    ]);
    expect(merge?.body?.value).toBe('One rule.');
  });

  it('drops a merge across places or kinds, without a body, or naming one memory', () => {
    expect(
      consolidated([
        {
          change: 'merge',
          handles: ['M-1', 'M-5'],
          body: 'One rule.',
          reason: 'Same.',
        },
        {
          change: 'merge',
          handles: ['M-1', 'M-3'],
          body: 'One rule.',
          reason: 'Same.',
        },
        {
          change: 'merge',
          handles: ['M-1', 'M-2'],
          body: null,
          reason: 'Same.',
        },
        {
          change: 'merge',
          handles: ['M-4'],
          body: 'One rule.',
          reason: 'Same.',
        },
      ]),
    ).toEqual([]);
  });

  it('drops a change naming an unknown, taken or already changed memory', () => {
    const proposals = consolidated(
      [
        { change: 'retire', handles: ['M-9'], body: null, reason: 'Gone.' },
        { change: 'retire', handles: ['M-4'], body: null, reason: 'Taken.' },
        {
          change: 'retire',
          handles: ['M-1'],
          body: null,
          reason: 'M-2 says otherwise.',
        },
        {
          change: 'merge',
          handles: ['M-1', 'M-2'],
          body: 'One rule.',
          reason: 'Same.',
        },
      ],
      HeldBack.none().taking([MemoryId.of('memory_4')]),
    );

    expect(proposals.map((each) => [each.change, each.finding])).toEqual([
      ['retire', 'wrong'],
    ]);
  });

  it('drops a merge a person turned down, but not a retirement of the same memory', () => {
    const heldBack = HeldBack.of({
      open: [],
      rejected: [{ memoryId: MemoryId.of('memory_1'), finding: 'overlap' }],
    });

    expect(
      consolidated(
        [
          {
            change: 'merge',
            handles: ['M-1', 'M-2'],
            body: 'One rule.',
            reason: 'Same.',
          },
          {
            change: 'retire',
            handles: ['M-1'],
            body: null,
            reason: 'M-2 says otherwise.',
          },
        ],
        heldBack,
      ).map((each) => each.change),
    ).toEqual(['retire']);
  });

  it('groups only memories a merge could join: same kind and same scope', () => {
    expect(
      consolidationGroupsOf(MEMORIES, HeldBack.none()).map((group) =>
        group.map((each) => each.handle.value),
      ),
    ).toEqual([['M-1', 'M-2', 'M-4'], ['M-3'], ['M-5']]);
  });
});
