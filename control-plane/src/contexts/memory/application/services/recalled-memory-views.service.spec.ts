import type { MemoryUsesPort } from '@memory/application/ports/memory-uses.port';
import type { PeoplePort } from '@memory/application/ports/people.port';
import type { WorkPort } from '@memory/application/ports/work.port';
import { RecalledMemoryViews } from '@memory/application/services/recalled-memory-views.service';
import { TeamMemoryViews } from '@memory/application/services/team-memory-views.service';
import { Memory } from '@memory/domain/aggregates/memory.aggregate';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryHandle } from '@memory/domain/value-objects/memory-handle.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const MAYA = UserId.of('user_maya');

const remembered = (provenance: MemoryProvenance | null) =>
  Memory.write({
    id: MemoryId.of('memory_1'),
    handle: MemoryHandle.of(1),
    workspaceId: WorkspaceId.of('ws_1'),
    kind: 'rationale',
    body: MemoryBody.of('Retry uploads in the request.'),
    scope: MemoryScope.of({ teamId: TeamId.of('team_1') }),
    provenance,
    by: MemoryDecision.of({
      by: MAYA,
      at: new Date('2026-09-27T10:00:00.000Z'),
    }),
  });

const recalling = (memory: Memory) => {
  const lookedUp: string[] = [];
  const people: PeoplePort = {
    viewerOf: async () => null,
    find: async (id) => {
      lookedUp.push(id.value);
      return { name: 'Maya Chen', image: null };
    },
  };
  const work = partial<WorkPort>({
    reasoning: async () => [
      { index: 1, kind: 'thought', text: 'A queue needs a worker.' },
      { index: 2, kind: 'message', text: 'Retrying in the request.' },
    ],
    notesOf: async () => [
      { position: 1, by: 'person', author: MAYA, text: 'Never queue it.' },
      { position: 2, by: 'world', author: null, text: 'FYI.' },
    ],
  });
  const views = new TeamMemoryViews(
    partial<MemoryRepository>({ find: async () => null }),
    people,
    partial<MemoryUsesPort>({ runsUsing: async () => new Map() }),
  );

  return {
    lookedUp,
    recalled: new RecalledMemoryViews(views, work, people).recalled(memory),
  };
};

describe('RecalledMemoryViews', () => {
  it('keeps only the steps and notes the memory cites, naming each note’s author once', async () => {
    const { lookedUp, recalled } = recalling(
      remembered(
        MemoryProvenance.of({
          taskId: TaskId.of('task_1'),
          runId: RunId.of('run_1'),
          steps: [2],
          notes: [1],
        }),
      ),
    );

    expect(await recalled).toMatchObject({
      approvedBy: { id: 'user_maya', name: 'Maya Chen' },
      steps: [{ index: 2, kind: 'message', text: 'Retrying in the request.' }],
      notes: [
        {
          position: 1,
          by: 'person',
          author: { id: 'user_maya', name: 'Maya Chen' },
          text: 'Never queue it.',
        },
      ],
    });
    expect(lookedUp).toEqual(['user_maya']);
  });

  it('cites nothing for a memory a person wrote outside any run', async () => {
    const { recalled } = recalling(remembered(null));

    expect(await recalled).toMatchObject({
      provenance: null,
      steps: [],
      notes: [],
    });
  });
});
