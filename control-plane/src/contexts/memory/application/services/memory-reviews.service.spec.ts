import type { PeoplePort } from '@memory/application/ports/people.port';
import type {
  ReasonedStep,
  WorkPort,
} from '@memory/application/ports/work.port';
import { MemoryReviews } from '@memory/application/services/memory-reviews.service';
import { MemoryProposalSet } from '@memory/domain/aggregates/memory-proposal-set.aggregate';
import { MemoryProposal } from '@memory/domain/entities/memory-proposal.entity';
import type { MemoryRepository } from '@memory/domain/repositories/memory.repository';
import { MemoryBody } from '@memory/domain/value-objects/memory-body';
import { MemoryDecision } from '@memory/domain/value-objects/memory-decision.vo';
import { MemoryId } from '@memory/domain/value-objects/memory-id.vo';
import { MemoryProposalSetId } from '@memory/domain/value-objects/memory-proposal-set-id.vo';
import { MemoryProvenance } from '@memory/domain/value-objects/memory-provenance.vo';
import { MemoryScope } from '@memory/domain/value-objects/memory-scope.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-27T10:00:00.000Z');
const RUN = RunId.of('run_1');
const TASK = TaskId.of('task_1');

const FIRST = 'spotlight remember --kind environment --body "npm ci fails."';
const SECOND =
  'spotlight remember --kind environment --body "Vitest globals are off."';

const STEP: ReasonedStep = {
  index: 4,
  kind: 'remember',
  text: FIRST,
  commands: [
    { proposes: 'memory', carrying: 'npm ci fails.', text: FIRST },
    { proposes: 'memory', carrying: 'Vitest globals are off.', text: SECOND },
  ],
};

const proposal = (id: string, body: string, command: number | null) =>
  MemoryProposal.of({
    id: MemoryId.of(id),
    kind: 'environment',
    body: MemoryBody.of(body),
    scope: MemoryScope.of({ teamId: TeamId.of('team_1') }),
    provenance: MemoryProvenance.of({
      taskId: TASK,
      runId: RUN,
      steps: [4],
      notes: [],
      command,
    }),
    source: 'run',
    supersedes: null,
    recordedAt: NOW,
  });

const reviewed = (proposals: readonly MemoryProposal[]) =>
  new MemoryReviews(
    {
      reasoning: async () => [STEP],
      notesOf: async () => [],
      harnessOf: async () => 'claude-code',
    } as unknown as WorkPort,
    {
      find: async () => ({ name: 'Ada', image: null }),
    } as unknown as PeoplePort,
    { findAll: async () => [] } as unknown as MemoryRepository,
  ).of(
    MemoryProposalSet.rehydrate({
      id: MemoryProposalSetId.of('set_1'),
      taskId: TASK,
      workspaceId: WorkspaceId.of('ws_1'),
      proposals,
      version: 1,
    }),
    RUN,
  );

const sourcesOf = async (proposals: readonly MemoryProposal[]) =>
  (await reviewed(proposals)).memories.map((each) =>
    each.steps.map((step) => step.text),
  );

describe('MemoryReviews', () => {
  it('shows as each proposal’s source the command of its step that proposed it, where the step proposed several', async () => {
    expect(
      await sourcesOf([
        proposal('memory_1', 'npm ci fails.', 0),
        proposal('memory_2', 'Vitest globals are off.', 1),
      ]),
    ).toEqual([[FIRST], [SECOND]]);
  });

  it('keeps the command that proposed it once a person approved it with another body', async () => {
    const approved = proposal('memory_2', 'Vitest globals are off.', 1).approve(
      MemoryDecision.of({ by: UserId.of('user_ada'), at: NOW }),
      'npm ci fails.',
    );

    expect(await sourcesOf([approved])).toEqual([[SECOND]]);
  });

  it('shows the step as it reads for a proposal that names none of its commands', async () => {
    expect(
      await sourcesOf([proposal('memory_2', 'Vitest globals are off.', null)]),
    ).toEqual([[FIRST]]);
  });
});
