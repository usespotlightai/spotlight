import { memoryFilesOf } from '@memory/application/rendering/memory-files';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { firstOf } from '@shared-kernel/domain/item-at';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const TEAM = TeamId.of('team_1');
const ADA = UserId.of('user_1');
const AT = new Date('2026-09-21T10:00:00.000Z');

const old = Memory.write({
  id: MemoryId.of('memory_old'),
  handle: MemoryHandle.of(7),
  workspaceId: WorkspaceId.of('ws_1'),
  kind: 'rationale',
  body: MemoryBody.of('Uploads retry from a queue.'),
  scope: MemoryScope.of({ teamId: TEAM }),
  provenance: null,
  by: MemoryDecision.of({ by: ADA, at: AT }),
});

const replacing = Memory.create({
  id: MemoryId.of('memory_new'),
  handle: MemoryHandle.of(18),
  workspaceId: WorkspaceId.of('ws_1'),
  kind: 'rejected-approach',
  body: MemoryBody.of('Uploads retry in the request,\nnot from a queue.'),
  scope: MemoryScope.of({
    teamId: TEAM,
    lineId: LineId.of('line_1'),
    stationId: StationId.of('station_1'),
    repository: Repository.of('acme/api'),
    paths: [MemoryPath.of('src/uploads')],
  }),
  provenance: MemoryProvenance.of({
    taskId: TaskId.of('task_1'),
    runId: RunId.of('run_1'),
    steps: [3],
    notes: [],
  }),
  source: 'run',
  supersedes: old.asPredecessor,
  approval: MemoryDecision.of({ by: ADA, at: AT }),
});

describe('memory files', () => {
  it('say what a memory contains, where it applies, where it came from and what it replaced', () => {
    const file = firstOf(
      memoryFilesOf([replacing], {
        lines: [
          {
            id: LineId.of('line_1'),
            name: 'Delivery',
            stations: [{ id: StationId.of('station_1'), name: 'Build' }],
            repositories: [],
          },
        ],
        replaced: new Map([[old.id.value, old]]),
        names: new Map([[ADA.value, 'Ada']]),
        briefed: new Set(),
      }),
    );

    expect(file?.path).toBe(
      '.spotlight/memory/repositories/acme/api/src/uploads/M-18.md',
    );
    expect(file?.body).toBe(
      [
        '# M-18 · rejected approach',
        '',
        'Uploads retry in the request,\nnot from a queue.',
        '',
        '- Applies to: Delivery › Build · acme/api: src/uploads',
        '- Source: from a run on task task_1, approved by Ada on 2026-09-21',
        '- Replaced M-7, which said: Uploads retry from a queue.',
        '- Read the task it came from with: spotlight trace --task task_1',
        '',
      ].join('\n'),
    );
  });

  it('say a person wrote one that cites no run', () => {
    const file = firstOf(
      memoryFilesOf([old], {
        lines: [],
        replaced: new Map(),
        names: new Map(),
        briefed: new Set(),
      }),
    );

    expect(file?.path).toBe('.spotlight/memory/team/M-7.md');
    expect(file?.body).toContain('- Applies to: the whole team');
    expect(file?.body).toContain('- Source: written by someone on 2026-09-21');
    expect(file?.body).not.toContain('spotlight trace');
  });

  it('name the memory, the repository and paths it is about, and whether the briefing lists it', () => {
    const files = memoryFilesOf([replacing, old], {
      lines: [],
      replaced: new Map(),
      names: new Map(),
      briefed: new Set([old.id.value]),
    });

    expect(
      files.map(({ handle, repository, paths, briefed }) => ({
        handle,
        repository,
        paths,
        briefed,
      })),
    ).toEqual([
      {
        handle: 'M-18',
        repository: { owner: 'acme', name: 'api' },
        paths: ['src/uploads'],
        briefed: false,
      },
      { handle: 'M-7', repository: null, paths: [], briefed: true },
    ]);
  });

  it('lay out what another station learned about the same repository apart, never as briefed', () => {
    const file = firstOf(
      memoryFilesOf(
        [replacing],
        {
          lines: [],
          replaced: new Map(),
          names: new Map(),
          briefed: new Set([replacing.id.value]),
        },
        true,
      ),
    );

    expect(file?.path).toBe(
      '.spotlight/memory/elsewhere/acme/api/src/uploads/M-18.md',
    );
    expect(file?.elsewhere).toBe(true);
    expect(file?.briefed).toBe(false);
    expect(file?.body).toContain(
      '- Learned at another line or station. Check it still fits this work before you follow it.\n',
    );
  });
});
