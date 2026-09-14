import { ReactToHappeningHandler } from '@application/commands/handlers/react-to-happening.handler';
import { ReactToHappeningCommand } from '@application/commands/react-to-happening.command';
import type { AttachmentStorePort } from '@application/ports/attachment-store.port';
import type { ClockPort } from '@application/ports/clock.port';
import type { StoredDelivery } from '@application/ports/delivery-inbox.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { LoggerPort } from '@application/ports/logger.port';
import type { MemberReaderPort } from '@application/ports/member-reader.port';
import { SilentTaskNotifier } from '@application/ports/outbound-task-notifier.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type {
  Happened,
  WebhookSourcePort,
} from '@application/ports/webhook-source.port';
import { AnnounceTaskEvents } from '@application/services/announce-task-events';
import type { AttendToNotices } from '@application/services/attend-to-notices.service';
import { SourceForDelivery } from '@application/services/source-for-delivery.service';
import type { TaskDispatching } from '@application/services/task-dispatch';
import { WebhookSources } from '@application/services/webhook-sources.service';
import { Line } from '@domain/aggregates/line.aggregate';
import { Task } from '@domain/aggregates/task.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { LineRepository } from '@domain/repositories/line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@domain/services/built-in-lines';
import type { Attachment } from '@domain/value-objects/attachment.vo';
import { Concerns } from '@domain/value-objects/concerns.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { Happening } from '@domain/value-objects/happening.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { LineId } from '@domain/value-objects/line-id.vo';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { LineName } from '@domain/value-objects/line-name.vo';
import { LineRole } from '@domain/value-objects/line-role.vo';
import { Mark } from '@domain/value-objects/mark.vo';
import { Reaction } from '@domain/value-objects/reaction.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { Said } from '@domain/value-objects/said.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@domain/value-objects/task-note-body.vo';
import { TaskRank } from '@domain/value-objects/task-rank.vo';
import { TaskTitle } from '@domain/value-objects/task-title.vo';
import { UserId } from '@domain/value-objects/user-id.vo';
import { Voice } from '@domain/value-objects/voice.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
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
  Line.of({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
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
    workspaceId: WorkspaceId.of('ws_1'),
    stationId: StationId.of(stationId),
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
    countsAt: vi.fn(async () => new Map()),
  }) satisfies TaskRepository;

const lines = () =>
  ({
    add: vi.fn(),
    save: vi.fn(),
    find: vi.fn(async () => line()),
    holding: vi.fn(async () => line()),
    ofWorkspace: vi.fn(async () => []),
    ofTeam: vi.fn(async () => []),
    withRole: vi.fn(async () => null),
  }) satisfies LineRepository;

const attending = {
  attend: async () => {},
} as unknown as AttendToNotices;

const dispatch: TaskDispatching = {
  dispatch: async ({ task }) => {
    dispatched.push(task);
    return RunId.of('run_2');
  },
};

const silentAnnounce = new AnnounceTaskEvents(
  new SilentTaskNotifier(),
  tasks(null),
);

const sourced = (
  carried: readonly Happened[],
  over: { workspaceId?: string | null; delivery?: string } = {},
) =>
  new SourceForDelivery(
    WebhookSources.of([
      {
        key: 'github',
        happenings: [],
        verifies: async () => true,
        delivery: () => over.delivery ?? 'delivery_1',
        routes: async () =>
          over.workspaceId === null
            ? null
            : WorkspaceId.of(over.workspaceId ?? 'ws_1'),
        read: async () => carried,
      } satisfies WebhookSourcePort,
    ]),
    { find: async () => null, all: async () => [] },
  );

const taken: StoredDelivery = {
  source: 'github',
  workspaceId: '',
  teamId: '',
  teamKey: '',
  id: 'delivery_1',
  headers: {},
  body: {},
  attempts: 0,
};

const news = (
  happening: Happening,
  said: string | null,
  ourOwn = false,
): Happened => ({
  happening,
  told: `The pull request was ${happening.value.split('.').pop()}.`,
  spoken: happening.equals(COMMENTED) || happening.equals(CHANGES_REQUESTED),
  state: 'raised',
  concerns: Concerns.of({ branch: 'spotlight/task_1' }) as Concerns,
  said: Said.of({
    body: said,
    path: said ? 'compose.yml' : null,
    from: said ? 22 : null,
    remark: said ? 'PRRC_kwDO' : null,
  }),
  ourOwn,
  opens: null,
});

const heard = (
  happening: Happening,
  found: Task | null,
  said: string | null = null,
) =>
  new ReactToHappeningHandler(
    sourced([news(happening, said)]),
    tasks(found),
    lines(),
    dispatch,
    transaction,
    clock,
    attending,
    ids,
    members,
    silentAnnounce,
    files,
    logger,
  ).execute(new ReactToHappeningCommand(taken));

describe('ReactToHappening', () => {
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
    await heard(COMMENTED, standing().handedTo(RunId.of('run_1')), 'Look.');

    expect(saved?.undelivered.map((each) => each.kind)).toEqual(['said']);
  });

  it('takes a reviewer’s word as the answer a person was owed', async () => {
    const asked = standing().askedAbout({
      voice: Voice.station(),
      station: StationName.of('Code Review'),
      body: TaskNoteBody.of('Addressed all three comments. Look again?'),
      at: NOW,
    });

    await heard(COMMENTED, asked, 'The Dockerfile still copies all.');

    expect(saved?.notes.map((each) => each.kind)).toEqual([
      'asked',
      'answered',
    ]);
    expect(saved?.awaitingReview).toBe(false);
    expect(dispatched).toHaveLength(1);
  });

  it('takes an unruled spoken word as the answer a task was owed', async () => {
    const asked = standing().askedAbout({
      voice: Voice.station(),
      station: StationName.of('Code Review'),
      body: TaskNoteBody.of('Which repository should this live in?'),
      at: NOW,
    });

    const reply: Happened = {
      happening: Happening.of('slack.app_mention'),
      told: 'Somebody mentioned Spotlight in Slack.',
      spoken: true,
      state: 'raised',
      concerns: Concerns.of({
        marks: [Mark.of('slack.thread', '1789022375.833389')],
      }) as Concerns,
      said: Said.of({ body: 'In the example repository, please.' }),
      ourOwn: false,
      opens: null,
    };

    await new ReactToHappeningHandler(
      sourced([reply]),
      tasks(asked),
      lines(),
      dispatch,
      transaction,
      clock,
      attending,
      ids,
      members,
      silentAnnounce,
      files,
      logger,
    ).execute(new ReactToHappeningCommand(taken));

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
      standing().askedAbout({
        voice: Voice.station(),
        station: StationName.of('Code Review'),
        body: TaskNoteBody.of('What does the queue look like now?'),
        at: NOW,
      });

    const replying = (
      said: string | null,
      fetch: () => Promise<Uint8Array>,
    ): Happened => ({
      happening: Happening.of('slack.message.replied'),
      told: 'Replied in a Slack thread.',
      spoken: true,
      state: 'raised',
      concerns: Concerns.of({
        marks: [Mark.of('slack.thread', '1789022375.833389')],
      }) as Concerns,
      said: said ? Said.of({ body: said }) : null,
      ourOwn: false,
      opens: null,
      attachments: [
        { name: 'queue.png', contentType: 'image/png', size: 4, fetch },
      ],
    });

    const react = (reply: Happened) =>
      new ReactToHappeningHandler(
        sourced([reply]),
        tasks(asked()),
        lines(),
        dispatch,
        transaction,
        clock,
        attending,
        ids,
        members,
        silentAnnounce,
        files,
        logger,
      ).execute(new ReactToHappeningCommand(taken));

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
    const asked = standing().askedAbout({
      voice: Voice.station(),
      station: StationName.of('Code Review'),
      body: TaskNoteBody.of('Which queue should I drain?'),
      at: NOW,
    });

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
    const ended = standing().finishedHere({
      voice: Voice.station(),
      station: StationName.of('Code Review'),
      body: TaskNoteBody.of('The work is done.'),
      at: NOW,
    });

    expect(ended.finished).toBe(true);

    await heard(COMMENTED, ended, 'One more thing.');

    expect(saved?.notes.map((each) => each.kind)).toEqual(['passed', 'said']);
    expect(saved?.finished).toBe(false);
    expect(dispatched).toHaveLength(1);
  });

  it('says nothing about what Spotlight itself did', async () => {
    await new ReactToHappeningHandler(
      sourced([news(COMMENTED, 'Opened by the agent.', true)], {
        delivery: 'delivery_2',
      }),
      tasks(standing()),
      lines(),
      dispatch,
      transaction,
      clock,
      attending,
      ids,
      members,
      silentAnnounce,
      files,
      logger,
    ).execute(new ReactToHappeningCommand(taken));

    expect(saved).toBeUndefined();
    expect(dispatched).toHaveLength(0);
  });

  it('lets a pull request nobody here opened pass', async () => {
    await heard(MERGED, null);

    expect(saved).toBeUndefined();
  });

  it('starts nothing where a run already holds the task', async () => {
    await heard(
      COMMENTED,
      standing().handedTo(RunId.of('run_1')),
      'One more thing.',
    );

    expect(dispatched).toHaveLength(0);
    expect(saved?.currentRunId).toEqual(RunId.of('run_1'));
  });

  it('says nothing for an installation no workspace has claimed', async () => {
    const held = tasks(standing());

    await new ReactToHappeningHandler(
      sourced([news(MERGED, null)], {
        workspaceId: null,
        delivery: 'delivery_3',
      }),
      held,
      lines(),
      dispatch,
      transaction,
      clock,
      attending,
      ids,
      members,
      silentAnnounce,
      files,
      logger,
    ).execute(new ReactToHappeningCommand(taken));

    expect(held.holding).not.toHaveBeenCalled();
    expect(saved).toBeUndefined();
    expect(dispatched).toHaveLength(0);
  });

  it('looks for the task only in the workspace the word came from', async () => {
    const held = tasks(standing());

    await new ReactToHappeningHandler(
      sourced([news(MERGED, null)], {
        workspaceId: 'ws_1',
        delivery: 'delivery_4',
      }),
      held,
      lines(),
      dispatch,
      transaction,
      clock,
      attending,
      ids,
      members,
      silentAnnounce,
      files,
      logger,
    ).execute(new ReactToHappeningCommand(taken));

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
      workspaceId: WorkspaceId.of('ws_1'),
      factoryId: FactoryId.of('factory_1'),
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
      countsAt: vi.fn(async () => new Map()),
    } satisfies TaskRepository;

    const running = {
      add: vi.fn(),
      save: vi.fn(),
      find: vi.fn(async () => opening),
      holding: vi.fn(async () => opening),
      ofWorkspace: vi.fn(async () => [opening]),
      ofTeam: vi.fn(async () => []),
      withRole: vi.fn(async () => null),
    } satisfies LineRepository;

    const filed: Happened = {
      happening: ISSUE_CREATED,
      told: 'An issue was filed.',
      spoken: false,
      state: 'raised',
      concerns: Concerns.of({ marks: [issueMark] }) as Concerns,
      said: Said.of({ body: null, path: null, from: null, remark: null }),
      ourOwn: false,
      opens: {
        onto: LineRole.DELIVERY,
        at: null,
        title: 'Drain the retry queue',
        description: 'It loops forever.',
        assignEmail: null,
        marks: [issueMark],
      },
    };

    const notifier = { notify: vi.fn(async () => []) };

    await new ReactToHappeningHandler(
      sourced([filed]),
      held,
      running,
      dispatch,
      transaction,
      clock,
      attending,
      ids,
      members,
      new AnnounceTaskEvents(notifier, held),
      files,
      logger,
    ).execute(new ReactToHappeningCommand(taken));

    expect(held.add).toHaveBeenCalledTimes(1);
    expect(added?.stationId).toEqual(entry.id);
    expect(added?.marks.some((each) => each.equals(issueMark))).toBe(true);
    expect(added?.title.value).toBe('Drain the retry queue');
    expect(added?.description?.value).toBe('It loops forever.');
    expect(notifier.notify).toHaveBeenCalledWith(added, 'task.opened');
  });

  it('assigns an opened task to the member matched by email', async () => {
    const ISSUE_CREATED = Happening.of('linear.issue.created');
    const issueMark = Mark.of('linear.issue', 'ISS-1');

    let next = 0;
    const opening = Line.open({
      workspaceId: WorkspaceId.of('ws_1'),
      factoryId: FactoryId.of('factory_1'),
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
      countsAt: vi.fn(async () => new Map()),
    } satisfies TaskRepository;

    const running = {
      add: vi.fn(),
      save: vi.fn(),
      find: vi.fn(async () => opening),
      holding: vi.fn(async () => opening),
      ofWorkspace: vi.fn(async () => [opening]),
      ofTeam: vi.fn(async () => []),
      withRole: vi.fn(async () => null),
    } satisfies LineRepository;

    const byEmail = vi.fn(async () => UserId.of('user_9'));

    const filed: Happened = {
      happening: ISSUE_CREATED,
      told: 'An issue was filed.',
      spoken: false,
      state: 'raised',
      concerns: Concerns.of({ marks: [issueMark] }) as Concerns,
      said: Said.of({ body: null, path: null, from: null, remark: null }),
      ourOwn: false,
      opens: {
        onto: LineRole.DELIVERY,
        at: null,
        title: 'Drain the retry queue',
        description: null,
        assignEmail: 'dev@acme.test',
        marks: [issueMark],
      },
    };

    await new ReactToHappeningHandler(
      sourced([filed]),
      held,
      running,
      dispatch,
      transaction,
      clock,
      attending,
      ids,
      { listForTeam: async () => null, byEmail, onTeam: async () => false },
      silentAnnounce,
      files,
      logger,
    ).execute(new ReactToHappeningCommand(taken));

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
      workspaceId: WorkspaceId.of('ws_1'),
      factoryId: FactoryId.of('factory_1'),
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
      countsAt: vi.fn(async () => new Map()),
    } satisfies TaskRepository;

    const running = {
      add: vi.fn(),
      save: vi.fn(),
      find: vi.fn(async () => opening),
      holding: vi.fn(async () => opening),
      ofWorkspace: vi.fn(async () => [opening]),
      ofTeam: vi.fn(async () => []),
      withRole: vi.fn(async () => null),
    } satisfies LineRepository;

    const filed: Happened = {
      happening: ISSUE_CREATED,
      told: 'An issue was filed.',
      spoken: false,
      state: 'raised',
      concerns: Concerns.of({ marks: [issueMark] }) as Concerns,
      said: Said.of({ body: null, path: null, from: null, remark: null }),
      ourOwn: false,
      opens: {
        onto: LineRole.DELIVERY,
        at: null,
        title: 'Drain the retry queue',
        description: null,
        assignEmail: 'stranger@acme.test',
        marks: [issueMark],
      },
    };

    await new ReactToHappeningHandler(
      sourced([filed]),
      held,
      running,
      dispatch,
      transaction,
      clock,
      attending,
      ids,
      {
        listForTeam: async () => null,
        byEmail: async () => null,
        onTeam: async () => false,
      },
      silentAnnounce,
      files,
      logger,
    ).execute(new ReactToHappeningCommand(taken));

    expect(added?.assignee).toBeNull();
  });

  it('opens one task where two lines share the role it opens onto', async () => {
    const ISSUE_CREATED = Happening.of('linear.issue.created');
    const issueMark = Mark.of('linear.issue', 'ISS-1');

    const delivery = (key: string) => {
      let next = 0;
      return Line.open({
        workspaceId: WorkspaceId.of('ws_1'),
        factoryId: FactoryId.of('factory_1'),
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
      countsAt: vi.fn(async () => new Map()),
    } satisfies TaskRepository;

    const running = {
      add: vi.fn(),
      save: vi.fn(),
      find: vi.fn(async () => first),
      holding: vi.fn(async () => first),
      ofWorkspace: vi.fn(async () => [second, first]),
      ofTeam: vi.fn(async () => []),
      withRole: vi.fn(async () => null),
    } satisfies LineRepository;

    const filed: Happened = {
      happening: ISSUE_CREATED,
      told: 'An issue was filed.',
      spoken: false,
      state: 'raised',
      concerns: Concerns.of({ marks: [issueMark] }) as Concerns,
      said: Said.of({ body: null, path: null, from: null, remark: null }),
      ourOwn: false,
      opens: {
        onto: LineRole.DELIVERY,
        at: null,
        title: 'Drain the retry queue',
        description: null,
        assignEmail: null,
        marks: [issueMark],
      },
    };

    await new ReactToHappeningHandler(
      sourced([filed]),
      held,
      running,
      dispatch,
      transaction,
      clock,
      attending,
      ids,
      members,
      silentAnnounce,
      files,
      logger,
    ).execute(new ReactToHappeningCommand(taken));

    expect(held.add).toHaveBeenCalledTimes(1);
    expect(added[0]?.stationId).toEqual((first.entry as Station).id);
  });
});
