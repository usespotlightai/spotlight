import type { MemberDirectoryPort } from '@identity/application/ports/member-directory.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Happened } from '@work/application/contracts/happenings.contract';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import { heardInMemory } from '@work/application/ports/heard-happenings.fake-spec';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import { ReactToHappenings } from '@work/application/services/react-to-happenings.service';
import type { TaskDispatching } from '@work/application/services/task-dispatch';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { TaskNote } from '@work/domain/entities/task-note.entity';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import type { TaskLetGoOfRun } from '@work/domain/events/task-let-go-of-run.event';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@work/domain/services/built-in-lines';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import { Happening } from '@work/domain/value-objects/happening.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { Reaction } from '@work/domain/value-objects/reaction.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-31T12:00:00.000Z');
const clock: ClockPort = { now: () => NOW, sleep: async () => {} };
const transaction: TransactionPort = { inTransaction: async (work) => work() };
const ids: IdGeneratorPort = { generate: () => 'task_new' };
const members: MemberDirectoryPort = {
  byEmail: async () => null,
};

const kept: Attachment[] = [];
const files = {
  grant: vi.fn(),
  received: vi.fn(async () => []),
  taken: vi.fn(),
  keep: vi.fn(async (_at, file: Attachment) => {
    kept.push(file);
  }),
  link: vi.fn(),
  open: vi.fn(),
} satisfies AttachmentStorePort;

const logger: LoggerPort = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

const MERGED = Happening.of('github.pull_request.merged');
const COMMENTED = Happening.of('github.pull_request.commented');
const CHANGES_REQUESTED = Happening.of('github.pull_request.changes-requested');
const CHECKS_FAILED = Happening.of('github.checks.failed');

const at = (
  id: string,
  name: string,
  position: number,
  kind: 'backlog' | 'work' | 'completed' = 'work',
) =>
  Station.of({
    id: StationId.of(id),
    key: StationKey.of(name.toLowerCase().split(' ').join('-')),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    harness: kind === 'work' ? HarnessId.of('dev') : undefined,
    kind,
  });

const sends = (happening: Happening, to: string, from?: string) =>
  Reaction.of({
    happening,
    from: from ? StationId.of(from) : null,
    to: StationId.of(to),
  });

const line = () =>
  Line.rehydrate({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('default'),
    name: LineName.of('Default'),
    stations: [
      at('station_0', 'Backlog', 0, 'backlog'),
      at('station_1', 'Implementation', 1),
      at('station_2', 'Code Review', 2),
      at('station_3', 'Completed', 3, 'completed'),
    ],
    reactions: [
      sends(CHANGES_REQUESTED, 'station_1'),
      sends(COMMENTED, 'station_2'),
      sends(CHECKS_FAILED, 'station_2'),
      sends(MERGED, 'station_3'),
    ],
  });

const taskAt = (stationId = 'station_2') =>
  Task.add({
    line: line(),
    at: StationId.of(stationId),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  });

let saved: Task | undefined;
const dispatched: Task[] = [];

const tasks = (found: Task | null) =>
  ({
    add: vi.fn(),
    save: vi.fn(async (each: Task) => {
      saved = each;
    }),
    find: vi.fn(async () => found),
    remove: vi.fn(),
    allAtStation: vi.fn(async () => []),
    placementsAt: vi.fn(async () => []),
    findByMarks: vi.fn(async () => found),
    settingUpFor: vi.fn(async () => null),
    settingUpIn: vi.fn(async () => []),
    settingUp: vi.fn(async () => []),
    awaitingConnection: vi.fn(async () => []),
  }) satisfies TaskRepository & TaskPlacementsPort;

const lines = () =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => line()),
    findByStation: vi.fn(async () => line()),
    ofWorkspace: vi.fn(async () => []),
    ofTeam: vi.fn(async () => []),
  }) satisfies LineRepository;

const dispatch: TaskDispatching = {
  runIdFor: async ({ task }) => {
    dispatched.push(task);
    return RunId.of('run_2');
  },
};

const news = (
  happening: Happening,
  said: string | null,
  ourOwn = false,
): Happened => ({
  happening: happening.value,
  told: `The pull request was ${happening.value.split('.').pop()}.`,
  spoken: happening.equals(COMMENTED) || happening.equals(CHANGES_REQUESTED),
  state: 'raised',
  concerns: { branch: 'spotlight/task_1', marks: [] },
  said: said
    ? { body: said, path: 'compose.yml', from: 22, remark: 'PRRC_kwDO' }
    : null,
  ourOwn,
  opens: null,
});

const heard = (
  happening: Happening,
  found: Task | null,
  said: string | null = null,
) =>
  new ReactToHappenings(
    tasks(found),
    tasks(found),
    lines(),
    dispatch,
    transaction,
    clock,
    ids,
    members,
    files,
    heardInMemory(),
    logger,
  ).react(WorkspaceId.of('ws_1'), null, [news(happening, said)], 'heard-as');

describe('ReactToHappenings', () => {
  beforeEach(() => {
    saved = undefined;
    dispatched.length = 0;
    kept.length = 0;
  });

  it('takes the task to the station waiting for it', async () => {
    await heard(CHANGES_REQUESTED, taskAt(), 'Handle the empty case.');

    expect(saved?.stationId).toEqual(StationId.of('station_1'));
    expect(saved?.notes[0]?.body.value).toContain('Handle the empty case.');
  });

  it('has no second effect when the same delivery is heard again', async () => {
    const stored = tasks(taskAt());
    const reactions = new ReactToHappenings(
      stored,
      stored,
      lines(),
      dispatch,
      transaction,
      clock,
      ids,
      members,
      files,
      heardInMemory(),
      logger,
    );
    const said = [news(CHANGES_REQUESTED, 'Handle the empty case.')];

    await reactions.react(WorkspaceId.of('ws_1'), null, said, 'delivery_1');
    await reactions.react(WorkspaceId.of('ws_1'), null, said, 'delivery_1');

    expect(stored.save).toHaveBeenCalledTimes(1);
    expect(dispatched).toHaveLength(1);
  });

  it('hears what a poll with no cursor says each time, since only a cursor tells news apart', async () => {
    const stored = tasks(taskAt());
    const reactions = new ReactToHappenings(
      stored,
      stored,
      lines(),
      dispatch,
      transaction,
      clock,
      ids,
      members,
      files,
      heardInMemory(),
      logger,
    );
    const said = [news(COMMENTED, 'Still retries.')];

    await reactions.react(WorkspaceId.of('ws_1'), null, said, null);
    await reactions.react(WorkspaceId.of('ws_1'), null, said, null);

    expect(stored.save).toHaveBeenCalledTimes(2);
  });

  it('hears a later delivery saying the same thing as news of its own', async () => {
    const stored = tasks(taskAt());
    const reactions = new ReactToHappenings(
      stored,
      stored,
      lines(),
      dispatch,
      transaction,
      clock,
      ids,
      members,
      files,
      heardInMemory(),
      logger,
    );
    const said = [news(COMMENTED, 'Still retries.')];

    await reactions.react(WorkspaceId.of('ws_1'), null, said, 'delivery_1');
    await reactions.react(WorkspaceId.of('ws_1'), null, said, 'delivery_2');

    expect(stored.save).toHaveBeenCalledTimes(2);
  });

  it('starts the work at the station it was taken to', async () => {
    await heard(CHANGES_REQUESTED, taskAt(), 'Handle the empty case.');

    expect(dispatched).toHaveLength(1);
    expect(saved?.currentRunId).toEqual(RunId.of('run_2'));
  });

  it('leaves a task where it is when that is where it belongs', async () => {
    await heard(COMMENTED, taskAt(), 'This retries forever.');

    expect(saved?.stationId).toEqual(StationId.of('station_2'));
    expect(saved?.notes.map((each) => each.kind)).toEqual(['said']);
    expect(saved?.notes.map((each) => each.voice.by)).toEqual(['world']);
    expect(dispatched).toHaveLength(1);
  });

  it('keeps what the world said on the note, whole', async () => {
    await heard(COMMENTED, taskAt(), 'pin this to a version.');

    const note = saved?.notes[0];

    expect(note?.said?.body).toBe('pin this to a version.');
    expect(note?.said?.place).toBe('compose.yml:22');
    expect(note?.remark?.value).toBe('PRRC_kwDO');
    expect(note?.open).toBe(true);
  });

  it('waits to be handed to the agent already working the task', async () => {
    await heard(
      COMMENTED,
      taskAt().handedTo(RunId.of('run_1'), line()),
      'Look.',
    );

    expect(saved?.undelivered.map((each) => each.kind)).toEqual(['said']);
  });

  it('takes a reviewer’s word as the answer a person was owed', async () => {
    const asked = taskAt().askedAbout(
      {
        voice: Voice.station(),
        station: StationName.of('Code Review'),
        body: TaskNoteBody.of('Addressed all three comments. Look again?'),
        at: NOW,
      },
      null,
    );

    await heard(COMMENTED, asked, 'The Dockerfile still copies all.');

    expect(saved?.notes.map((each) => each.kind)).toEqual([
      'asked',
      'answered',
    ]);
    expect(saved?.awaitingReview).toBe(false);
    expect(dispatched).toHaveLength(1);
  });

  it('takes an unruled spoken word as the answer a task was owed', async () => {
    const asked = taskAt().askedAbout(
      {
        voice: Voice.station(),
        station: StationName.of('Code Review'),
        body: TaskNoteBody.of('Which repository should this live in?'),
        at: NOW,
      },
      null,
    );

    const reply: Happened = {
      happening: 'slack.app_mention',
      told: 'Somebody mentioned Spotlight in Slack.',
      spoken: true,
      state: 'raised',
      concerns: {
        branch: null,
        marks: [{ kind: 'slack.thread', value: '1789022375.833389' }],
      },
      said: { body: 'In the example repository, please.' },
      ourOwn: false,
      opens: null,
    };

    await new ReactToHappenings(
      tasks(asked),
      tasks(asked),
      lines(),
      dispatch,
      transaction,
      clock,
      ids,
      members,
      files,
      heardInMemory(),
      logger,
    ).react(WorkspaceId.of('ws_1'), null, [reply], 'heard-as');

    expect(saved?.notes.map((each) => each.kind)).toEqual([
      'asked',
      'answered',
    ]);
    expect(saved?.notes[1]?.body.value).toBe(
      'In the example repository, please.',
    );
    expect(saved?.notes[1]?.body.value).not.toContain('mentioned Spotlight');
    expect(saved?.awaitingReview).toBe(false);
    expect(dispatched).toHaveLength(1);
  });

  it('takes a Slack thread reply as the answer a paused run waits for, so that same run is taken up', async () => {
    const paused = taskAt()
      .handedTo(RunId.of('run_1'), line())
      .putToAPerson(RunId.of('run_1'), {
        voice: Voice.station(RunId.of('run_1')),
        station: StationName.of('Code Review'),
        body: TaskNoteBody.of('Which repository should this live in?'),
        at: NOW,
      });
    paused.pullEvents();

    await new ReactToHappenings(
      tasks(paused),
      tasks(paused),
      lines(),
      dispatch,
      transaction,
      clock,
      ids,
      members,
      files,
      heardInMemory(),
      logger,
    ).react(
      WorkspaceId.of('ws_1'),
      null,
      [
        {
          happening: 'slack.app_mention',
          told: 'Somebody mentioned Spotlight in Slack.',
          spoken: true,
          state: 'raised',
          concerns: {
            branch: null,
            marks: [{ kind: 'slack.thread', value: '1789022375.833389' }],
          },
          said: { body: 'In the example repository, please.' },
          ourOwn: false,
          opens: null,
        },
      ],
      'heard-as',
    );

    expect(saved?.hasCurrentRun(RunId.of('run_1'))).toBe(true);
    expect(saved?.pullEvents()).toContainEqual(
      new TaskAnswered(
        saved?.id as TaskId,
        saved?.workspaceId as WorkspaceId,
        RunId.of('run_1'),
      ),
    );
    expect(dispatched).toHaveLength(0);
  });

  describe('a word carrying files', () => {
    const asked = () =>
      taskAt().askedAbout(
        {
          voice: Voice.station(),
          station: StationName.of('Code Review'),
          body: TaskNoteBody.of('What does the queue look like now?'),
          at: NOW,
        },
        null,
      );

    const replying = (
      said: string | null,
      fetch: () => Promise<Uint8Array>,
    ): Happened => ({
      happening: 'slack.message.replied',
      told: 'Replied in a Slack thread.',
      spoken: true,
      state: 'raised',
      concerns: {
        branch: null,
        marks: [{ kind: 'slack.thread', value: '1789022375.833389' }],
      },
      said: said ? { body: said } : null,
      ourOwn: false,
      opens: null,
      attachments: [
        { name: 'queue.png', contentType: 'image/png', size: 4, fetch },
      ],
    });

    const react = (reply: Happened) =>
      new ReactToHappenings(
        tasks(asked()),
        tasks(asked()),
        lines(),
        dispatch,
        transaction,
        clock,
        ids,
        members,
        files,
        heardInMemory(),
        logger,
      ).react(WorkspaceId.of('ws_1'), null, [reply], 'heard-as');

    it('takes a reply that is only a file as the answer, and keeps the file', async () => {
      await react(replying(null, async () => new Uint8Array([1, 2, 3, 4])));

      expect(saved?.notes.map((each) => each.kind)).toEqual([
        'asked',
        'answered',
      ]);
      expect(saved?.notes[1]?.body.value).toBe('Attached queue.png.');
      expect(saved?.notes[1]?.attachments.map((each) => each.name)).toEqual([
        'queue.png',
      ]);
      expect(kept.map((each) => each.size)).toEqual([4]);
    });

    it('leaves behind a file it cannot have, and still hears the words', async () => {
      await react(
        replying('Still stuck.', async () => {
          throw new Error('files.slack.com answered 403');
        }),
      );

      expect(saved?.notes[1]?.body.value).toBe('Still stuck.');
      expect(saved?.notes[1]?.attachments).toEqual([]);
      expect(kept).toEqual([]);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  it('leaves a person owed where the world merely reports itself', async () => {
    const asked = taskAt().askedAbout(
      {
        voice: Voice.station(),
        station: StationName.of('Code Review'),
        body: TaskNoteBody.of('Which queue should I drain?'),
        at: NOW,
      },
      null,
    );

    await heard(CHECKS_FAILED, asked);

    expect(saved?.notes.map((each) => each.kind)).toEqual(['asked', 'said']);
    expect(saved?.awaitingReview).toBe(true);
    expect(dispatched).toHaveLength(0);
  });

  it('says nothing of a review submitted with nothing written on it', async () => {
    await heard(COMMENTED, taskAt(), null);

    expect(saved).toBeUndefined();
    expect(dispatched).toHaveLength(0);
  });

  it('leaves a happening that does not read as one, and says so', async () => {
    vi.mocked(logger.warn).mockClear();

    await new ReactToHappenings(
      tasks(taskAt()),
      tasks(taskAt()),
      lines(),
      dispatch,
      transaction,
      clock,
      ids,
      members,
      files,
      heardInMemory(),
      logger,
    ).react(
      WorkspaceId.of('ws_1'),
      null,
      [
        {
          ...news(MERGED, null),
          concerns: {
            branch: null,
            marks: [{ kind: 'Not A Kind', value: 'x' }],
          },
        },
      ],
      'heard-as',
    );

    expect(saved).toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('says nothing to a station nobody set to wait for it', async () => {
    await heard(Happening.of('github.pull_request.closed-unmerged'), taskAt());

    expect(saved).toBeUndefined();
    expect(dispatched).toHaveLength(0);
  });

  it('leaves a task that has landed at the end of the line alone', async () => {
    await heard(MERGED, taskAt('station_3'));

    expect(saved).toBeUndefined();
  });

  it('takes work back up where the world speaks after a run finished it', async () => {
    const ended = Task.rehydrate({
      ...taskAt(),
      notes: [
        TaskNote.of({
          position: NotePosition.of(0),
          voice: Voice.station(),
          station: StationName.of('Code Review'),
          body: TaskNoteBody.of('The work is done.'),
          at: NOW,
          kind: 'passed',
        }),
      ],
      finishedAt: NOW,
    });

    expect(ended.finished).toBe(true);

    await heard(COMMENTED, ended, 'One more thing.');

    expect(saved?.notes.map((each) => each.kind)).toEqual(['passed', 'said']);
    expect(saved?.finished).toBe(false);
    expect(dispatched).toHaveLength(1);
  });

  it('lets a pull request nobody here opened pass', async () => {
    await heard(MERGED, null);

    expect(saved).toBeUndefined();
  });

  it('starts nothing where the task already has a current run', async () => {
    await heard(
      COMMENTED,
      taskAt().handedTo(RunId.of('run_1'), line()),
      'One more thing.',
    );

    expect(dispatched).toHaveLength(0);
    expect(saved?.currentRunId).toEqual(RunId.of('run_1'));
  });

  describe('a happening that would move a task that has a current run', () => {
    const handed = (stationId: string) => {
      const task = taskAt(stationId).handedTo(RunId.of('run_1'), line());
      task.pullEvents();
      return task;
    };

    const paused = (stationId: string) => {
      const task = taskAt(stationId)
        .handedTo(RunId.of('run_1'), line())
        .putToAPerson(RunId.of('run_1'), {
          station: StationName.of('Implementation'),
          body: TaskNoteBody.of('Which queue should I drain?'),
          at: NOW,
          voice: Voice.station(RunId.of('run_1')),
        });
      task.pullEvents();
      return task;
    };

    it('leaves the task where it is and its current run', async () => {
      await heard(COMMENTED, handed('station_1'), 'This retries forever.');

      expect(saved?.stationId).toEqual(StationId.of('station_1'));
      expect(saved?.currentRunId).toEqual(RunId.of('run_1'));
      expect(saved?.pullEvents().map((each) => each.kind)).toEqual([]);
      expect(dispatched).toHaveLength(0);
    });

    it('defers the move on a note, for the run to be told', async () => {
      await heard(COMMENTED, handed('station_1'), 'This retries forever.');

      expect(saved?.notes.map((each) => each.body.value)).toEqual([
        'Heard while a run worked on the task. If the run does not pass the task on, the task moves to Code Review when the run ends.\n\ncompose.yml:22\nThis retries forever.',
      ]);
      expect(saved?.notes[0]?.station).toEqual(
        StationName.of('Implementation'),
      );
      expect(saved?.notes[0]?.remark?.value).toBe('PRRC_kwDO');
      expect(saved?.undelivered).toHaveLength(1);
      expect(saved?.deferredMoveTo).toEqual(StationId.of('station_2'));
    });

    it('defers a spoken word with nothing said as what happened', async () => {
      await heard(COMMENTED, handed('station_1'), null);

      expect(saved?.stationId).toEqual(StationId.of('station_1'));
      expect(saved?.notes[0]?.body.value).toContain(
        'moves to Code Review when the run ends.\n\nThe pull request was commented.',
      );
      expect(saved?.deferredMoveTo).toEqual(StationId.of('station_2'));
      expect(dispatched).toHaveLength(0);
    });

    it('defers the move while the current run of the task waits on a person', async () => {
      await heard(COMMENTED, paused('station_1'), 'This retries forever.');

      expect(saved?.stationId).toEqual(StationId.of('station_1'));
      expect(saved?.currentRunId).toEqual(RunId.of('run_1'));
      expect(saved?.awaitingReview).toBe(true);
      expect(saved?.notes.map((each) => each.kind)).toEqual(['asked', 'said']);
      expect(saved?.deferredMoveTo).toEqual(StationId.of('station_2'));
      expect(saved?.pullEvents()).toEqual([]);
      expect(dispatched).toHaveLength(0);
    });

    it('keeps a stored-back move when a later happening leaves the task where it is', async () => {
      await heard(COMMENTED, handed('station_1'), 'This retries forever.');
      const noted = saved as Task;

      await heard(CHANGES_REQUESTED, noted, 'Handle the empty case.');

      expect(saved?.stationId).toEqual(StationId.of('station_1'));
      expect(saved?.notes.map((each) => each.kind)).toEqual(['said', 'said']);
      expect(saved?.deferredMoveTo).toEqual(StationId.of('station_2'));
    });

    it('moves the same task once it has no current run', async () => {
      await heard(COMMENTED, taskAt('station_1'), 'This retries forever.');

      expect(saved?.stationId).toEqual(StationId.of('station_2'));
      expect(saved?.notes[0]?.body.value).toBe(
        'compose.yml:22\nThis retries forever.',
      );
      expect(saved?.deferredMoveTo).toBeNull();
      expect(dispatched).toHaveLength(1);
    });

    describe('when the pull request merges', () => {
      it('stops the run and keeps the task where it is', async () => {
        await heard(MERGED, handed('station_2'));

        expect(saved?.stationId).toEqual(StationId.of('station_2'));
        expect(saved?.currentRunId).toBeNull();
        expect(saved?.finished).toBe(false);
        expect(
          saved
            ?.pullEvents()
            .filter((each) => each.kind === 'task.let-go-of-run')
            .map((each) => (each as TaskLetGoOfRun).runId),
        ).toEqual([RunId.of('run_1')]);
        expect(dispatched).toHaveLength(0);
      });

      it('asks whoever raised the task whether to close it or carry on', async () => {
        await heard(MERGED, handed('station_2'));

        expect(saved?.awaitingReview).toBe(true);
        expect(saved?.assignee).toEqual(UserId.of('user_1'));
        expect(
          saved?.notes.map((each) => [each.kind, each.body.value]),
        ).toEqual([
          [
            'asked',
            'The pull request was merged while Code Review was working. Close the task, or reply to carry on.',
          ],
        ]);
      });

      it('adds to the question the paused run put to a person, asking nothing again and leaving the run alone', async () => {
        await heard(MERGED, paused('station_2'));

        expect(saved?.stationId).toEqual(StationId.of('station_2'));
        expect(saved?.currentRunId).toEqual(RunId.of('run_1'));
        expect(saved?.awaitingReview).toBe(true);
        expect(
          saved?.notes.map((each) => [each.kind, each.body.value]),
        ).toEqual([
          ['asked', 'Which queue should I drain?'],
          [
            'said',
            'The pull request was merged while Code Review was waiting for an answer. Close the task, or reply to carry on.',
          ],
        ]);
        expect(saved?.pullEvents()).toEqual([]);
        expect(dispatched).toHaveLength(0);
      });

      it('drops the moves stored back before it once the paused run’s question is open, leaving the person to decide', async () => {
        await heard(COMMENTED, paused('station_1'), 'This retries forever.');
        expect(saved?.deferredMoveTo).toEqual(StationId.of('station_2'));

        await heard(MERGED, saved as Task);

        expect(saved?.deferredMoveTo).toBeNull();
        expect(saved?.currentRunId).toEqual(RunId.of('run_1'));
        expect(saved?.awaitingReview).toBe(true);
      });

      it('finishes a task that has no current run, as before', async () => {
        await heard(MERGED, taskAt('station_1'));

        expect(saved?.stationId).toEqual(StationId.of('station_3'));
        expect(saved?.finished).toBe(true);
      });
    });
  });

  it('looks for the task only in the workspace the word came from', async () => {
    const stored = tasks(taskAt());

    await new ReactToHappenings(
      stored,
      stored,
      lines(),
      dispatch,
      transaction,
      clock,
      ids,
      members,
      files,
      heardInMemory(),
      logger,
    ).react(WorkspaceId.of('ws_1'), null, [news(MERGED, null)], 'heard-as');

    expect(stored.findByMarks).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      expect.anything(),
    );
  });

  it('opens a task on a line the word opens onto', async () => {
    const ISSUE_CREATED = Happening.of('linear.issue.created');
    const issueMark = Mark.of('linear.issue', 'ISS-1');

    let next = 0;
    const opening = Line.open({
      by: attributedIn(),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      line: BUILT_IN_LINES[0] as LineOpening,
      newId: () => `id_${++next}`,
    });
    const entry = opening.entry as Station;

    let added: Task | undefined;
    const stored = {
      add: vi.fn(async (each: Task) => {
        added = each;
      }),
      save: vi.fn(),
      find: vi.fn(async () => null),
      remove: vi.fn(),
      allAtStation: vi.fn(async () => []),
      placementsAt: vi.fn(async () => []),
      findByMarks: vi.fn(async () => null),
      settingUpFor: vi.fn(async () => null),
      settingUpIn: vi.fn(async () => []),
      settingUp: vi.fn(async () => []),
      awaitingConnection: vi.fn(async () => []),
    } satisfies TaskRepository & TaskPlacementsPort;

    const running = {
      add: vi.fn(),
      save: vi.fn(),
      find: vi.fn(async () => opening),
      findByStation: vi.fn(async () => opening),
      ofWorkspace: vi.fn(async () => [opening]),
      ofTeam: vi.fn(async () => []),
    } satisfies LineRepository;

    const filed: Happened = {
      happening: ISSUE_CREATED.value,
      told: 'An issue was filed.',
      spoken: false,
      state: 'raised',
      concerns: { branch: null, marks: [issueMark] },
      said: null,
      ourOwn: false,
      opens: {
        onto: 'delivery',
        at: null,
        title: 'Drain the retry queue',
        description: 'It loops forever.',
        assignEmail: null,
        marks: [issueMark],
      },
    };

    await new ReactToHappenings(
      stored,
      stored,
      running,
      dispatch,
      transaction,
      clock,
      ids,
      members,
      files,
      heardInMemory(),
      logger,
    ).react(WorkspaceId.of('ws_1'), null, [filed], 'heard-as');

    expect(stored.add).toHaveBeenCalledTimes(1);
    expect(added?.stationId).toEqual(entry.id);
    expect(added?.marks.some((each) => each.equals(issueMark))).toBe(true);
    expect(added?.title.value).toBe('Drain the retry queue');
    expect(added?.description?.value).toBe('It loops forever.');
    expect(added?.pullEvents()).toContainEqual(
      expect.objectContaining({ kind: 'task.opened', heard: true }),
    );
  });

  it('assigns an opened task to the member matched by email', async () => {
    const ISSUE_CREATED = Happening.of('linear.issue.created');
    const issueMark = Mark.of('linear.issue', 'ISS-1');

    let next = 0;
    const opening = Line.open({
      by: attributedIn(),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      line: BUILT_IN_LINES[0] as LineOpening,
      newId: () => `id_${++next}`,
    });

    let added: Task | undefined;
    const stored = {
      add: vi.fn(async (each: Task) => {
        added = each;
      }),
      save: vi.fn(),
      find: vi.fn(async () => null),
      remove: vi.fn(),
      allAtStation: vi.fn(async () => []),
      placementsAt: vi.fn(async () => []),
      findByMarks: vi.fn(async () => null),
      settingUpFor: vi.fn(async () => null),
      settingUpIn: vi.fn(async () => []),
      settingUp: vi.fn(async () => []),
      awaitingConnection: vi.fn(async () => []),
    } satisfies TaskRepository & TaskPlacementsPort;

    const running = {
      add: vi.fn(),
      save: vi.fn(),
      find: vi.fn(async () => opening),
      findByStation: vi.fn(async () => opening),
      ofWorkspace: vi.fn(async () => [opening]),
      ofTeam: vi.fn(async () => []),
    } satisfies LineRepository;

    const byEmail = vi.fn(async () => UserId.of('user_9'));

    const filed: Happened = {
      happening: ISSUE_CREATED.value,
      told: 'An issue was filed.',
      spoken: false,
      state: 'raised',
      concerns: { branch: null, marks: [issueMark] },
      said: null,
      ourOwn: false,
      opens: {
        onto: 'delivery',
        at: null,
        title: 'Drain the retry queue',
        description: null,
        assignEmail: 'dev@acme.test',
        marks: [issueMark],
      },
    };

    await new ReactToHappenings(
      stored,
      stored,
      running,
      dispatch,
      transaction,
      clock,
      ids,
      { byEmail },
      files,
      heardInMemory(),
      logger,
    ).react(WorkspaceId.of('ws_1'), null, [filed], 'heard-as');

    expect(byEmail).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      'dev@acme.test',
    );
    expect(added?.assignee?.value).toBe('user_9');
  });

  it('leaves an opened task unassigned where no member has the email', async () => {
    const ISSUE_CREATED = Happening.of('linear.issue.created');
    const issueMark = Mark.of('linear.issue', 'ISS-1');

    let next = 0;
    const opening = Line.open({
      by: attributedIn(),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      line: BUILT_IN_LINES[0] as LineOpening,
      newId: () => `id_${++next}`,
    });

    let added: Task | undefined;
    const stored = {
      add: vi.fn(async (each: Task) => {
        added = each;
      }),
      save: vi.fn(),
      find: vi.fn(async () => null),
      remove: vi.fn(),
      allAtStation: vi.fn(async () => []),
      placementsAt: vi.fn(async () => []),
      findByMarks: vi.fn(async () => null),
      settingUpFor: vi.fn(async () => null),
      settingUpIn: vi.fn(async () => []),
      settingUp: vi.fn(async () => []),
      awaitingConnection: vi.fn(async () => []),
    } satisfies TaskRepository & TaskPlacementsPort;

    const running = {
      add: vi.fn(),
      save: vi.fn(),
      find: vi.fn(async () => opening),
      findByStation: vi.fn(async () => opening),
      ofWorkspace: vi.fn(async () => [opening]),
      ofTeam: vi.fn(async () => []),
    } satisfies LineRepository;

    const filed: Happened = {
      happening: ISSUE_CREATED.value,
      told: 'An issue was filed.',
      spoken: false,
      state: 'raised',
      concerns: { branch: null, marks: [issueMark] },
      said: null,
      ourOwn: false,
      opens: {
        onto: 'delivery',
        at: null,
        title: 'Drain the retry queue',
        description: null,
        assignEmail: 'stranger@acme.test',
        marks: [issueMark],
      },
    };

    await new ReactToHappenings(
      stored,
      stored,
      running,
      dispatch,
      transaction,
      clock,
      ids,
      { byEmail: async () => null },
      files,
      heardInMemory(),
      logger,
    ).react(WorkspaceId.of('ws_1'), null, [filed], 'heard-as');

    expect(added?.assignee).toBeNull();
  });

  it('opens one task where two lines share the role it opens onto', async () => {
    const ISSUE_CREATED = Happening.of('linear.issue.created');
    const issueMark = Mark.of('linear.issue', 'ISS-1');

    const delivery = (key: string) => {
      let next = 0;
      return Line.open({
        by: attributedIn(),
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        line: {
          ...(BUILT_IN_LINES[0] as LineOpening),
          key: LineKey.of(key),
          name: LineName.of(key),
        },
        newId: () => `${key}_${++next}`,
      });
    };

    const second = delivery('delivery-b');
    const first = delivery('delivery-a');

    const added: Task[] = [];
    const stored = {
      add: vi.fn(async (each: Task) => {
        added.push(each);
      }),
      save: vi.fn(),
      find: vi.fn(async () => null),
      remove: vi.fn(),
      allAtStation: vi.fn(async () => []),
      placementsAt: vi.fn(async () => []),
      findByMarks: vi.fn(async () => null),
      settingUpFor: vi.fn(async () => null),
      settingUpIn: vi.fn(async () => []),
      settingUp: vi.fn(async () => []),
      awaitingConnection: vi.fn(async () => []),
    } satisfies TaskRepository & TaskPlacementsPort;

    const running = {
      add: vi.fn(),
      save: vi.fn(),
      find: vi.fn(async () => first),
      findByStation: vi.fn(async () => first),
      ofWorkspace: vi.fn(async () => [second, first]),
      ofTeam: vi.fn(async () => []),
    } satisfies LineRepository;

    const filed: Happened = {
      happening: ISSUE_CREATED.value,
      told: 'An issue was filed.',
      spoken: false,
      state: 'raised',
      concerns: { branch: null, marks: [issueMark] },
      said: null,
      ourOwn: false,
      opens: {
        onto: 'delivery',
        at: null,
        title: 'Drain the retry queue',
        description: null,
        assignEmail: null,
        marks: [issueMark],
      },
    };

    await new ReactToHappenings(
      stored,
      stored,
      running,
      dispatch,
      transaction,
      clock,
      ids,
      members,
      files,
      heardInMemory(),
      logger,
    ).react(WorkspaceId.of('ws_1'), null, [filed], 'heard-as');

    expect(stored.add).toHaveBeenCalledTimes(1);
    expect(added[0]?.stationId).toEqual((first.entry as Station).id);
  });
});
