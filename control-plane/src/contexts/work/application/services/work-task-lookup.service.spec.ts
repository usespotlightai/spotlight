import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type {
  TaskLookupReaderPort,
  TaskNoteReading,
} from '@work/application/ports/task-lookup-reader.port';
import { WorkTaskLookup } from '@work/application/services/work-task-lookup.service';
import { Task } from '@work/domain/aggregates/task.aggregate';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { HeldMark } from '@work/domain/value-objects/held-mark.vo';
import { deliveryLineOf } from '@work/domain/value-objects/line-map.fake-spec';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { OwnedPullRequest } from '@work/domain/value-objects/owned-pull-request.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/7');
const WORKSPACE = WorkspaceId.of('ws_1');

let next = 0;
const fresh = () => {
  next += 1;
  return `id_${next}`;
};

const line = deliveryLineOf({
  workspaceId: WORKSPACE,
  teamId: TeamId.of('team_1'),
  newId: fresh,
});

const task = () =>
  Task.add({
    line,
    // oxlint-disable-next-line typescript/no-non-null-assertion -- the delivery line has an entry
    at: line.entry!.id,
    title: TaskTitle.of('Retry uploads'),
    rank: TaskRank.of('i'),
    now: new Date('2026-09-18T12:00:00.000Z'),
    newId: fresh,
  });

const owning = (pullRequest: PullRequestUrl) =>
  Task.rehydrate({
    ...task(),
    heldMarks: [HeldMark.of(Mark.pullRequest(pullRequest), new Date(0))],
    ownedPullRequests: [OwnedPullRequest.of(pullRequest, new Date(0))],
  });

const lookingUp = (markedTasks: readonly Task[]) =>
  new WorkTaskLookup(
    {} as TaskLookupReaderPort,
    {
      owningPullRequest: async (
        _at: WorkspaceId,
        pullRequest: PullRequestUrl,
      ) =>
        markedTasks.find((each) =>
          each.pullRequests.some((owned) => owned.equals(pullRequest)),
        ) ?? null,
      reviewingPullRequest: async (
        _at: WorkspaceId,
        pullRequest: PullRequestUrl,
      ) =>
        markedTasks.find(
          (each) => each.reviewedPullRequest?.url.equals(pullRequest) ?? false,
        ) ?? null,
    } as unknown as TaskRepository,
    { findByStation: async () => line } as unknown as LineMapsPort,
  );

describe('WorkTaskLookup, finding the task a pull request belongs to', () => {
  it('finds the task that opened it before one that reviews it', async () => {
    const reviewing = task().reviews(
      PULL,
      { outside: false },
      line,
      new Date(0),
    );
    const opened = owning(PULL);

    const found = await lookingUp([reviewing, opened]).taskWithPullRequest(
      WORKSPACE,
      PULL,
    );

    expect(found?.id.equals(opened.id)).toBe(true);
  });

  it('finds the task that owns it after its mark moved to another task', async () => {
    const owner = owning(PULL).releaseMark(Mark.pullRequest(PULL));
    const marked = task().markedBy(Mark.pullRequest(PULL), new Date(0));

    const found = await lookingUp([marked, owner]).taskWithPullRequest(
      WORKSPACE,
      PULL,
    );

    expect(found?.id.equals(owner.id)).toBe(true);
    expect(found?.openPullRequests).toEqual([PULL]);
  });

  it('finds no task for a pull request only marked on one', async () => {
    const marked = task().markedBy(Mark.pullRequest(PULL), new Date(0));

    expect(
      await lookingUp([marked]).taskWithPullRequest(WORKSPACE, PULL),
    ).toBeNull();
  });

  it('finds the task reviewing it where no task of Spotlight’s opened it', async () => {
    const reviewing = task().reviews(
      PULL,
      { outside: false },
      line,
      new Date(0),
    );

    const found = await lookingUp([reviewing]).taskWithPullRequest(
      WORKSPACE,
      PULL,
    );

    expect(found?.id.equals(reviewing.id)).toBe(true);
    expect(found?.reviewedPullRequest).toEqual(PULL);
    expect(found?.pullRequests).toEqual([]);
  });

  it('says whether the pull request a task reviews came from outside the team', async () => {
    const outside = task().reviews(PULL, { outside: true }, line, new Date(0));

    const found = await lookingUp([outside]).taskWithPullRequest(
      WORKSPACE,
      PULL,
    );

    expect(found?.fromOutside).toBe(true);
  });
});

describe('WorkTaskLookup, reading the notes of people on a task', () => {
  const _AT = new Date('2026-09-21T10:00:00.000Z');

  const note = (
    position: number,
    voice: Voice,
    body: string,
  ): TaskNoteReading => ({ position, voice, body });

  it('reads the notes of people and the world, and who of the team wrote them, and nothing the stations did', async () => {
    const views = await new WorkTaskLookup(
      {
        notesOf: async () => [
          note(0, Voice.station(RunId.of('run_1')), 'Which bucket?'),
          note(1, Voice.person(UserId.of('user_1')), 'The archive one.'),
          note(2, Voice.world(), 'Never retry on a 403.'),
        ],
      } as unknown as TaskLookupReaderPort,
      {} as TaskRepository,
      {} as LineMapsPort,
    ).notesOf(TaskId.of('task_1'));

    expect(views).toEqual([
      {
        position: 1,
        by: 'person',
        author: 'user_1',
        text: 'The archive one.',
      },
      { position: 2, by: 'world', author: null, text: 'Never retry on a 403.' },
    ]);
  });
});
