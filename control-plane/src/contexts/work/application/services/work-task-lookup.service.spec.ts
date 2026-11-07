import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { WorkTaskLookup } from '@work/application/services/work-task-lookup.service';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskNote } from '@work/domain/entities/task-note.entity';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { CorrelationKeys } from '@work/domain/value-objects/correlation-keys.vo';
import { deliveryLineOf } from '@work/domain/value-objects/line-map.fake-spec';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
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
    // biome-ignore lint/style/noNonNullAssertion: the delivery line has an entry
    at: line.entry!.id,
    title: TaskTitle.of('Retry uploads'),
    rank: TaskRank.of('i'),
    now: new Date('2026-09-18T12:00:00.000Z'),
    newId: fresh,
  });

const lookingUp = (markedTasks: readonly Task[]) =>
  new WorkTaskLookup(
    {
      findByCorrelation: async (
        _at: WorkspaceId,
        correlationKeys: CorrelationKeys,
      ) =>
        markedTasks.filter((each) =>
          correlationKeys.marks.some((mark) =>
            each.marks.some((marked) => marked.equals(mark)),
          ),
        ),
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
    const opened = task().markedBy(Mark.pullRequest(PULL), new Date(0));

    const found = await lookingUp([reviewing, opened]).taskWithPullRequest(
      WORKSPACE,
      PULL,
    );

    expect(found?.id.equals(opened.id)).toBe(true);
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
    expect(found?.reviewing).toBe(true);
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
  const AT = new Date('2026-09-21T10:00:00.000Z');

  const note = (position: number, voice: Voice, body: string) =>
    TaskNote.of({
      position: NotePosition.of(position),
      station: StationName.of('Implementation'),
      stationId: StationId.of('station_implementation'),
      body: TaskNoteBody.of(body),
      at: AT,
      voice,
      kind: 'answered',
    });

  it('reads the notes of people and the world, and who of the team wrote them, and nothing the stations did', async () => {
    const views = await new WorkTaskLookup(
      {
        find: async () => ({
          notes: [
            note(0, Voice.station(RunId.of('run_1')), 'Which bucket?'),
            note(1, Voice.person(UserId.of('user_1')), 'The archive one.'),
            note(2, Voice.world(), 'Never retry on a 403.'),
          ],
        }),
      } as unknown as TaskRepository,
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
