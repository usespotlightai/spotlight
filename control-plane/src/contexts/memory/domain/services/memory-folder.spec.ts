import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { filesOf, handlesRead } from '@memory/domain/services/memory-folder';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const kept = (scope: Parameters<typeof MemoryScope.of>[0]) =>
  Memory.written({
    id: MemoryId.of('memory_1'),
    handle: MemoryHandle.of(18),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'rationale',
    body: 'Uploads retry in the request.',
    scope: MemoryScope.of(scope),
    grounds: null,
    supersedes: null,
    by: MemoryDecision.of({
      by: UserId.of('user_1'),
      at: new Date('2026-09-27T10:00:00.000Z'),
    }),
  });

const TEAM = TeamId.of('team_1');
const API = Repository.of('acme/api');

describe('the memory folder', () => {
  it('lays each memory under the most specific folder that fits it', () => {
    expect(filesOf(kept({ teamId: TEAM }))).toEqual([
      '.spotlight/memory/team/M-18.md',
    ]);
    expect(filesOf(kept({ teamId: TEAM, lineId: 'line_1' }))).toEqual([
      '.spotlight/memory/line/M-18.md',
    ]);
    expect(
      filesOf(kept({ teamId: TEAM, lineId: 'line_1', stationId: 'station_1' })),
    ).toEqual(['.spotlight/memory/station/M-18.md']);
    expect(
      filesOf(kept({ teamId: TEAM, lineId: 'line_1', repository: API })),
    ).toEqual(['.spotlight/memory/repositories/acme/api/M-18.md']);
  });

  it('lays a memory about paths beside each of them', () => {
    expect(
      filesOf(
        kept({
          teamId: TEAM,
          repository: API,
          paths: [MemoryPath.of('src/uploads'), MemoryPath.of('src/retry.ts')],
        }),
      ),
    ).toEqual([
      '.spotlight/memory/repositories/acme/api/src/uploads/M-18.md',
      '.spotlight/memory/repositories/acme/api/src/retry.ts/M-18.md',
    ]);
  });

  it('reads back which memories a run referred to, once each, and nothing outside the folder', () => {
    const read = handlesRead([
      '.spotlight/memory/team/M-3.md',
      '/workspace/.spotlight/memory/repositories/acme/api/src/uploads/M-18.md',
      '.spotlight/memory/line/M-3.md',
      '.spotlight/memory/team',
      'notes/M-9.md',
      '.spotlight/memory/team/M-99999999999.md',
    ]);

    expect(read.map((each) => each.value)).toEqual(['M-3', 'M-18']);
  });
});
