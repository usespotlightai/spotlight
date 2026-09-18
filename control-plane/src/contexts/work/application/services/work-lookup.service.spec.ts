import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkLookup } from '@work/application/services/work-lookup.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { BUILT_IN_LINES } from '@work/domain/services/built-in-lines';
import type { Concerns } from '@work/domain/value-objects/concerns.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it } from 'vitest';

const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/7');
const WORKSPACE = WorkspaceId.of('ws_1');

let next = 0;
const fresh = () => {
  next += 1;
  return `id_${next}`;
};

const [opening] = BUILT_IN_LINES;

const line = Line.open({
  workspaceId: WORKSPACE,
  teamId: TeamId.of('team_1'),
  // biome-ignore lint/style/noNonNullAssertion: Spotlight ships lines
  line: opening!,
  newId: fresh,
});

const task = () =>
  Task.add({
    line,
    // biome-ignore lint/style/noNonNullAssertion: the delivery line has an entry
    at: line.entry!.id,
    title: TaskTitle.of('Retry uploads'),
    rank: TaskRank.of('i'),
    now: new Date('2026-09-18T12:00:00.000Z'),
    newId: fresh,
  });

const lookingUp = (wearers: readonly Task[]) =>
  new WorkLookup(
    {} as RunRepository,
    {
      holding: async (_at: WorkspaceId, concerns: Concerns) =>
        wearers.find((each) =>
          concerns.marks.some((mark) =>
            each.marks.some((worn) => worn.equals(mark)),
          ),
        ) ?? null,
    } as unknown as TaskRepository,
    { holding: async () => line } as unknown as LineRepository,
  );

describe('WorkLookup, finding the task a pull request belongs to', () => {
  it('finds the task that opened it before one that reviews it', async () => {
    const reviewing = task().reviews(PULL);
    const opened = task().markedBy(Mark.pullRequest(PULL));

    const found = await lookingUp([reviewing, opened]).taskWithPullRequest(
      WORKSPACE,
      PULL,
    );

    expect(found?.id.equals(opened.id)).toBe(true);
  });

  it('finds the task reviewing it where no task of Spotlight’s opened it', async () => {
    const reviewing = task().reviews(PULL);

    const found = await lookingUp([reviewing]).taskWithPullRequest(
      WORKSPACE,
      PULL,
    );

    expect(found?.id.equals(reviewing.id)).toBe(true);
    expect(found?.reviewing).toBe(true);
  });
});
