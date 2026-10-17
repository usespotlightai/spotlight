import { memoryFilesOf } from '@memory/application/rendering/memory-files';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryGrounds } from '@memory/domain/value-objects/memory-grounds.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryPath } from '@memory/domain/value-objects/memory-path.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
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
  grounds: null,
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
    lineId: 'line_1',
    stationId: 'station_1',
    repository: Repository.of('acme/api'),
    paths: [MemoryPath.of('src/uploads')],
  }),
  grounds: MemoryGrounds.of({
    taskId: TaskId.of('task_1'),
    runId: RunId.of('run_1'),
    steps: [3],
    notes: [],
  }),
  source: 'run',
  supersedes: old,
  approval: MemoryDecision.of({ by: ADA, at: AT }),
});

describe('memory files', () => {
  it('say what a memory contains, where it applies, where it came from and what it replaced', () => {
    const [file] = memoryFilesOf([replacing], {
      lines: [
        {
          id: 'line_1',
          name: 'Delivery',
          stations: [{ id: 'station_1', name: 'Build' }],
          repositories: [],
        },
      ],
      replaced: new Map([[old.id.value, old]]),
      names: new Map([[ADA.value, 'Ada']]),
    });

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

  it('say a person wrote one that rests on no run', () => {
    const [file] = memoryFilesOf([old], {
      lines: [],
      replaced: new Map(),
      names: new Map(),
    });

    expect(file?.path).toBe('.spotlight/memory/team/M-7.md');
    expect(file?.body).toContain('- Applies to: the whole team');
    expect(file?.body).toContain('- Source: written by someone on 2026-09-21');
    expect(file?.body).not.toContain('spotlight trace');
  });
});
