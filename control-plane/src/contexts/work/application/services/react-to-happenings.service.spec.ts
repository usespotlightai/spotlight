import type { MemberReaderPort } from '@identity/application/ports/member-reader.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { attributedIn } from '@shared-kernel/domain/value-objects/attribution.fake-spec';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
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
const transaction: TransactionPort = { run: async (work) => work() };
const ids: IdGeneratorPort = { generate: () => 'task_new' };
const members: MemberReaderPort = {
  listForTeam: async () => null,
  byEmail: async () => null,
  onTeam: async () => false,
};

const kept: Attachment[] = [];
const files = {
  grant: vi.fn(),
  received: vi.fn(async () => []),
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

const standing = (stationId = 'station_2') =>
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
    standingAt: vi.fn(async () => []),
    placementsAt: vi.fn(async () => []),
    holding: vi.fn(async () => found),
    settingUpFor: vi.fn(async () => null),
    settingUpIn: vi.fn(async () => []),
    settingUp: vi.fn(async () => []),
  }) satisfies TaskRepository & TaskPlacementsPort;

const lines = () =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => line()),
    holding: vi.fn(async () => line()),
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
    await heard(CHANGES_REQUESTED, standing(), 'Handle the empty case.');

    expect(saved?.stationId).toEqual(StationId.of('station_1'));
    expect(saved?.notes[0]?.body.value).toContain('Handle the empty case.');
  });

  it('has no second effect when the same delivery is heard again', async () => {
    const held = tasks(standing());
    const reactions = new ReactToHappenings(
      held,
      held,
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

    expect(held.save).toHaveBeenCalledTimes(1);
    expect(dispatched).toHaveLength(1);
  });

  it('hears what a poll with no cursor says each time, since only a cursor tells news apart', async () => {
    const held = tasks(standing());
    const reactions = new ReactToHappenings(
      held,
      held,
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

    expect(held.save).toHaveBeenCalledTimes(2);
  });

  it('hears a later delivery saying the same thing as news of its own', async () => {
    const held = tasks(standing());
    const reactions = new ReactToHappenings(
      held,
      held,
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

    expect(held.save).toHaveBeenCalledTimes(2);
  });

  it('starts the work at the station it was taken to', async () => {
    await heard(CHANGES_REQUESTED, standing(), 'Handle the empty case.');

    expect(dispatched).toHaveLength(1);
    expect(saved?.currentRunId).toEqual(RunId.of('run_2'));
  });

  it('leaves a task where it stands when that is where it belongs', async () => {
    await heard(COMMENTED, standing(), 'This retries forever.');

    expect(saved?.stationId).toEqual(StationId.of('station_2'));
    expect(saved?.notes.map((each) => each.kind)).toEqual(['said']);
    expect(saved?.notes.map((each) => each.voice.by)).toEqual(['world']);
    expect(dispatched).toHaveLength(1);
  });

  it('keeps what the world said on the note, whole', async () => {
    await heard(COMMENTED, standing(), 'pin this to a version.');

    const note = saved?.notes[0];

    expect(note?.said?.body).toBe('pin this to a version.');
    expect(note?.said?.place).toBe('compose.yml:22');
    expect(note?.remark?.value).toBe('PRRC_kwDO');
    expect(note?.open).toBe(true);
  });

  it('waits to be handed to the agent already working the task', async () => {
    await heard(
      COMMENTED,
      standing().handedTo(RunId.of('run_1'), line()),
      'Look.',
    );

    expect(saved?.undelivered.map((each) => each.kind)).toEqual(['said']);
  });

  it('takes a reviewer’s word as the answer a person was owed', async () => {
    const asked = standing().askedAbout(
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
    const asked = standing().askedAbout(
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

  describe('a word carrying files', () => {
    const asked = () =>
      standing().askedAbout(
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
    const asked = standing().askedAbout(
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
    await heard(COMMENTED, standing(), null);

    expect(saved).toBeUndefined();
    expect(dispatched).toHaveLength(0);
  });

  it('leaves a happening that does not read as one, and says so', async () => {
    vi.mocked(logger.warn).mockClear();

    await new ReactToHappenings(
      tasks(standing()),
      tasks(standing()),
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
    await heard(
      Happening.of('github.pull_request.closed-unmerged'),
      standing(),
    );

    expect(saved).toBeUndefined();
    expect(dispatched).toHaveLength(0);
  });

  it('leaves a task that has landed at the end of the line alone', async () => {
    await heard(MERGED, standing('station_3'));

    expect(saved).toBeUndefined();
  });

  it('takes work back up where the world speaks after a run finished it', async () => {
    const ended = Task.rehydrate({
      ...standing(),
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

  it('starts nothing where a run already holds the task', async () => {
    await heard(
      COMMENTED,
      standing().handedTo(RunId.of('run_1'), line()),
      'One more thing.',
    );

    expect(dispatched).toHaveLength(0);
    expect(saved?.currentRunId).toEqual(RunId.of('run_1'));
  });

  it('looks for the task only in the workspace the word came from', async () => {
    const held = tasks(standing());

    await new ReactToHappenings(
      held,
      held,
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

    expect(held.holding).toHaveBeenCalledWith(
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
    const held = {
      add: vi.fn(async (each: Task) => {
        added = each;
      }),
      save: vi.fn(),
      find: vi.fn(async () => null),
      remove: vi.fn(),
      standingAt: vi.fn(async () => []),
      placementsAt: vi.fn(async () => []),
      holding: vi.fn(async () => null),
      settingUpFor: vi.fn(async () => null),
      settingUpIn: vi.fn(async () => []),
      settingUp: vi.fn(async () => []),
    } satisfies TaskRepository & TaskPlacementsPort;

    const running = {
      add: vi.fn(),
      save: vi.fn(),
      find: vi.fn(async () => opening),
      holding: vi.fn(async () => opening),
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
      held,
      held,
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

    expect(held.add).toHaveBeenCalledTimes(1);
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
    const held = {
      add: vi.fn(async (each: Task) => {
        added = each;
      }),
      save: vi.fn(),
      find: vi.fn(async () => null),
      remove: vi.fn(),
      standingAt: vi.fn(async () => []),
      placementsAt: vi.fn(async () => []),
      holding: vi.fn(async () => null),
      settingUpFor: vi.fn(async () => null),
      settingUpIn: vi.fn(async () => []),
      settingUp: vi.fn(async () => []),
    } satisfies TaskRepository & TaskPlacementsPort;

    const running = {
      add: vi.fn(),
      save: vi.fn(),
      find: vi.fn(async () => opening),
      holding: vi.fn(async () => opening),
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
      held,
      held,
      running,
      dispatch,
      transaction,
      clock,
      ids,
      { listForTeam: async () => null, byEmail, onTeam: async () => false },
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
    const held = {
      add: vi.fn(async (each: Task) => {
        added = each;
      }),
      save: vi.fn(),
      find: vi.fn(async () => null),
      remove: vi.fn(),
      standingAt: vi.fn(async () => []),
      placementsAt: vi.fn(async () => []),
      holding: vi.fn(async () => null),
      settingUpFor: vi.fn(async () => null),
      settingUpIn: vi.fn(async () => []),
      settingUp: vi.fn(async () => []),
    } satisfies TaskRepository & TaskPlacementsPort;

    const running = {
      add: vi.fn(),
      save: vi.fn(),
      find: vi.fn(async () => opening),
      holding: vi.fn(async () => opening),
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
      held,
      held,
      running,
      dispatch,
      transaction,
      clock,
      ids,
      {
        listForTeam: async () => null,
        byEmail: async () => null,
        onTeam: async () => false,
      },
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
    const held = {
      add: vi.fn(async (each: Task) => {
        added.push(each);
      }),
      save: vi.fn(),
      find: vi.fn(async () => null),
      remove: vi.fn(),
      standingAt: vi.fn(async () => []),
      placementsAt: vi.fn(async () => []),
      holding: vi.fn(async () => null),
      settingUpFor: vi.fn(async () => null),
      settingUpIn: vi.fn(async () => []),
      settingUp: vi.fn(async () => []),
    } satisfies TaskRepository & TaskPlacementsPort;

    const running = {
      add: vi.fn(),
      save: vi.fn(),
      find: vi.fn(async () => first),
      holding: vi.fn(async () => first),
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
      held,
      held,
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

    expect(held.add).toHaveBeenCalledTimes(1);
    expect(added[0]?.stationId).toEqual((first.entry as Station).id);
  });
});
