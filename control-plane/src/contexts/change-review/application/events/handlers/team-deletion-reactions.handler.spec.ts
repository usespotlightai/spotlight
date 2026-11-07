import { TeamDeletionReactions } from '@change-review/application/events/handlers/team-deletion-reactions.handler';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { QuestionAnswerRepository } from '@change-review/domain/repositories/question-answer.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-07T10:00:00.000Z');
const TEAM = TeamId.of('team_1');

const replayCheck = (stack: string) =>
  StackCheck.begin({
    stackId: ChangeStackId.of(stack),
    runId: RunId.of('replay_run_1'),
    taskId: null,
    teamId: TEAM,
    replay: true,
    workspaceId: WorkspaceId.of('ws_1'),
    request: CheckRequest.of('npm test', null),
    entries: [],
    now: NOW,
  });

const owning = <T>(found: readonly T[]) => {
  const removed: T[] = [];

  return {
    removed,
    repository: {
      ofTeam: vi.fn(async () => found),
      remove: vi.fn(async (each: T) => {
        removed.push(each);
      }),
    },
  };
};

const deleting = (found: {
  checks?: readonly StackCheck[];
  answers?: readonly string[];
  stacks?: readonly string[];
}) => {
  const checks = owning(found.checks ?? []);
  const answers = owning(found.answers ?? []);
  const stacks = owning(found.stacks ?? []);

  return {
    checks,
    answers,
    stacks,
    reactions: new TeamDeletionReactions(
      checks.repository as unknown as StackCheckRepository,
      answers.repository as unknown as QuestionAnswerRepository,
      stacks.repository as unknown as ChangeStackRepository,
      { now: () => NOW, sleep: async () => {} },
    ),
  };
};

describe('TeamDeletionReactions', () => {
  it('removes the replay stacks and answers a deleted team owned, one aggregate at a time', async () => {
    const deleted = deleting({
      answers: ['answer_1'],
      stacks: ['stack_1', 'stack_2'],
    });

    await deleted.reactions.removeAnswers(TEAM);
    await deleted.reactions.removeStacks(TEAM);

    expect(deleted.answers.repository.ofTeam).toHaveBeenCalledWith(TEAM);
    expect(deleted.answers.removed).toEqual(['answer_1']);
    expect(deleted.stacks.removed).toEqual(['stack_1', 'stack_2']);
  });

  it('deletes a waiting replay check, so no runner is offered it again, and releases its reserved runner', async () => {
    const reserved = replayCheck('stack_1').reservedFor(
      RunnerId.of('pooled_1'),
      PoolId.of('pool_1'),
      NOW,
    );
    const deleted = deleting({ checks: [reserved, replayCheck('stack_2')] });

    await deleted.reactions.removeChecks(TEAM);

    expect(deleted.checks.removed.map((each) => each.stackId.value)).toEqual([
      'stack_1',
      'stack_2',
    ]);
    expect(deleted.checks.removed[0]?.reservation).toBeNull();
    expect(
      deleted.checks.removed[0]?.pullEvents().map((each) => each.kind),
    ).toEqual(['stack-check.reservation-dropped']);
  });
});
