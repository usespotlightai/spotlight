import type { MemberDirectoryPort } from '@identity/application/ports/member-directory.port';
import type { RunFactsPort } from '@runs/application/ports/run-facts.port';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { Happened } from '@work/application/contracts/happenings.contract';
import type { AttachmentStorePort } from '@work/application/ports/attachment-store.port';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { processedEventsInMemory } from '@work/application/ports/processed-events.fake-spec';
import type { TaskPlacementsPort } from '@work/application/ports/task-placements.port';
import { ChannelReplies } from '@work/application/rendering/channel-replies';
import type { ChannelChats } from '@work/application/services/channel-chats.service';
import type { TaskDispatching } from '@work/application/services/dispatch-task.service';
import { ReactToHappenings } from '@work/application/services/react-to-happenings.service';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskNote } from '@work/domain/entities/task-note.entity';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import type { TaskRunDetached } from '@work/domain/events/task-run-detached.event';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { Approval } from '@work/domain/value-objects/approval.vo';
import type { Attachment } from '@work/domain/value-objects/attachment.vo';
import {
  deliveryLineOf,
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { Mark } from '@work/domain/value-objects/mark.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { OwnedPullRequest } from '@work/domain/value-objects/owned-pull-request.vo';
import { Reaction } from '@work/domain/value-objects/reaction.vo';
import type { Station } from '@work/domain/value-objects/station.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const TEAMMATES = {
  membersOf: async () => TeamMembers.of([UserId.of('user_9')]),
};

const NO_RUNS = { of: async () => [] } as unknown as RunFactsPort;

const channels = {
  reached: async () => null,
  answer: async () => {},
} as unknown as ChannelChats;

const NOW = new Date('2026-08-31T12:00:00.000Z');
const clock: ClockPort = { now: () => NOW, sleep: async () => {} };
const transaction: TransactionPort = { inTransaction: async (work) => work() };
const ids: IdGeneratorPort = { generate: () => 'task_new' };
const members: MemberDirectoryPort = {
  byEmail: async () => null,
};

const stored: Attachment[] = [];
const files = {
  grant: vi.fn(),
  received: vi.fn(async () => []),
  stored: vi.fn(async () => true),
  taken: vi.fn(),
  save: vi.fn(async (_at, file: Attachment) => {
    stored.push(file);
  }),
  copy: vi.fn(),
  link: vi.fn(),
  linkPending: vi.fn(),
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
  stationOf({
    id: StationId.of(id),
    key: StationKey.of(name.toLowerCase().split(' ').join('-')),
    name: StationName.of(name),
    position,
    color: '#a3a8b0',
    harness: kind === 'work' ? HarnessId.of('dev') : undefined,
    kind,
  });

const sends = (happening: Happening, to: string, from?: string) =>
  Reaction.of({
    happening,
    from: from ? StationId.of(from) : null,
    to: StationId.of(to),
  });

const line = (more: readonly Reaction[] = []) =>
  lineMapOf({
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
      ...more,
    ],
  });

const taskAt = (stationId = 'station_2') =>
  Task.add({
    line: line(),
    at: StationId.of(stationId),
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    createdBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  });

const landedAt = (stationId: string) =>
  Task.rehydrate({
    ...taskAt('station_2'),
    stationId: StationId.of(stationId),
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
    placementsAt: vi.fn(async () => []),
    findByCorrelation: vi.fn(async () => (found ? [found] : [])),
    owningPullRequest: vi.fn(async () => null),
    reviewingPullRequest: vi.fn(async () => null),
    holdingMark: vi.fn(async () => []),
    settingUpFor: vi.fn(async () => null),
    settingUpIn: vi.fn(async () => []),
    settingUp: vi.fn(async () => []),
    withTurnAnsweredBetween: vi.fn(async () => []),
    awaitingConnection: vi.fn(async () => []),
  }) satisfies TaskRepository & TaskPlacementsPort;

const lines = () =>
  ({
    find: vi.fn(async () => line()),
    findByStation: vi.fn(async () => line()),
    ofWorkspace: vi.fn(async () => []),
    ofTeam: vi.fn(async () => []),
    candidate: vi.fn(),
  }) satisfies LineMapsPort;

const dispatch: TaskDispatching = {
  runIdFor: async ({ task }) => {
    dispatched.push(task);
    return RunId.of('run_2');
  },
};

const news = (
  happening: Happening,
  message: string | null,
  ourOwn = false,
): Happened => ({
  happening: happening.value,
  summary: `The pull request was ${happening.value.split('.').pop()}.`,
  answers: happening.equals(COMMENTED) || happening.equals(CHANGES_REQUESTED),
  state: 'raised',
  correlationKeys: { branch: 'spotlight/task_1', marks: [] },
  message: message
    ? {
        body: message,
        path: 'compose.yml',
        from: 22,
        reviewComment: 'PRRC_kwDO',
      }
    : null,
  ourOwn,
  opens: null,
});

const receive = (
  happening: Happening,
  found: Task | null,
  message: string | null = null,
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
    processedEventsInMemory(),
    logger,
    channels,
    NO_RUNS,
    TEAMMATES,
  ).react(
    WorkspaceId.of('ws_1'),
    null,
    [news(happening, message)],
    'received-as',
  );

describe('ReactToHappenings', () => {
  beforeEach(() => {
    saved = undefined;
    dispatched.length = 0;
    stored.length = 0;
  });

  it('takes the task to the station waiting for it', async () => {
    await receive(CHANGES_REQUESTED, taskAt(), 'Handle the empty case.');

    expect(saved?.stationId).toEqual(StationId.of('station_1'));
    expect(saved?.notes[0]?.body.value).toContain('Handle the empty case.');
  });

  it('has no second effect when the same delivery is received again', async () => {
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
      processedEventsInMemory(),
      logger,
      channels,
      NO_RUNS,
      TEAMMATES,
    );
    const happenings = [news(CHANGES_REQUESTED, 'Handle the empty case.')];

    await reactions.react(
      WorkspaceId.of('ws_1'),
      null,
      happenings,
      'delivery_1',
    );
    await reactions.react(
      WorkspaceId.of('ws_1'),
      null,
      happenings,
      'delivery_1',
    );

    expect(stored.save).toHaveBeenCalledTimes(1);
    expect(dispatched).toHaveLength(1);
  });

  it('receives what a poll with no cursor says each time, since only a cursor tells news apart', async () => {
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
      processedEventsInMemory(),
      logger,
      channels,
      NO_RUNS,
      TEAMMATES,
    );
    const happenings = [news(COMMENTED, 'Still retries.')];

    await reactions.react(WorkspaceId.of('ws_1'), null, happenings, null);
    await reactions.react(WorkspaceId.of('ws_1'), null, happenings, null);

    expect(stored.save).toHaveBeenCalledTimes(2);
  });

  it('receives a later delivery saying the same thing as news of its own', async () => {
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
      processedEventsInMemory(),
      logger,
      channels,
      NO_RUNS,
      TEAMMATES,
    );
    const happenings = [news(COMMENTED, 'Still retries.')];

    await reactions.react(
      WorkspaceId.of('ws_1'),
      null,
      happenings,
      'delivery_1',
    );
    await reactions.react(
      WorkspaceId.of('ws_1'),
      null,
      happenings,
      'delivery_2',
    );

    expect(stored.save).toHaveBeenCalledTimes(2);
  });

  it('starts the work at the station it was taken to', async () => {
    await receive(CHANGES_REQUESTED, taskAt(), 'Handle the empty case.');

    expect(dispatched).toHaveLength(1);
    expect(saved?.currentRunId).toEqual(RunId.of('run_2'));
  });

  it('leaves a task where it is when that is where it belongs', async () => {
    await receive(COMMENTED, taskAt(), 'This retries forever.');

    expect(saved?.stationId).toEqual(StationId.of('station_2'));
    expect(saved?.notes.map((each) => each.kind)).toEqual(['message']);
    expect(saved?.notes.map((each) => each.voice.kind)).toEqual(['world']);
    expect(dispatched).toHaveLength(1);
  });

  it('keeps the anchor from the world on the note, whole', async () => {
    await receive(COMMENTED, taskAt(), 'pin this to a version.');

    const note = saved?.notes[0];

    expect(note?.anchor?.body).toBe('pin this to a version.');
    expect(note?.anchor?.place).toBe('compose.yml:22');
    expect(note?.reviewComment?.value).toBe('PRRC_kwDO');
    expect(note?.open).toBe(true);
  });

  it('waits to be handed to the agent already working the task', async () => {
    await receive(
      COMMENTED,
      taskAt().assignRun(RunId.of('run_1'), line()),
      'Look.',
    );

    expect(saved?.unacknowledged.map((each) => each.kind)).toEqual(['message']);
  });

  it('takes a reviewer’s word as the pending answer', async () => {
    const asked = taskAt().askedAbout(
      {
        voice: Voice.station(),
        line: null,
        body: TaskNoteBody.of('Addressed all three comments. Look again?'),
        at: NOW,
      },
      null,
    );

    await receive(COMMENTED, asked, 'The Dockerfile still copies all.');

    expect(saved?.notes.map((each) => each.kind)).toEqual([
      'asked',
      'answered',
    ]);
    expect(saved?.awaitingReview).toBe(false);
    expect(dispatched).toHaveLength(1);
  });

  it('takes an unruled message as the pending answer of the task', async () => {
    const asked = taskAt().askedAbout(
      {
        voice: Voice.station(),
        line: null,
        body: TaskNoteBody.of('Which repository should this live in?'),
        at: NOW,
      },
      null,
    );

    const reply: Happened = {
      happening: 'slack.app_mention',
      summary: 'Somebody mentioned Spotlight in Slack.',
      answers: true,
      state: 'raised',
      correlationKeys: {
        branch: null,
        marks: [{ kind: 'slack.thread', value: '1789022375.833389' }],
      },
      message: { body: 'In the example repository, please.' },
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
      processedEventsInMemory(),
      logger,
      channels,
      NO_RUNS,
      TEAMMATES,
    ).react(WorkspaceId.of('ws_1'), null, [reply], 'received-as');

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

  it('signs a reply with the member who has the email of its author', async () => {
    const asked = taskAt().askedAbout(
      {
        voice: Voice.station(),
        line: null,
        body: TaskNoteBody.of('Which repository should this live in?'),
        at: NOW,
      },
      null,
    );
    const byEmail = vi.fn(async () => UserId.of('user_9'));

    await new ReactToHappenings(
      tasks(asked),
      tasks(asked),
      lines(),
      dispatch,
      transaction,
      clock,
      ids,
      { byEmail },
      files,
      processedEventsInMemory(),
      logger,
      channels,
      NO_RUNS,
      TEAMMATES,
    ).react(
      WorkspaceId.of('ws_1'),
      null,
      [
        {
          happening: 'slack.message.replied',
          summary: 'Replied in a Slack thread.',
          answers: true,
          state: 'raised',
          correlationKeys: {
            branch: null,
            marks: [{ kind: 'slack.thread', value: '1789022375.833389' }],
          },
          message: { body: 'In the example repository, please.' },
          authorEmail: 'ada@example.com',
          ourOwn: false,
          opens: null,
        },
      ],
      'received-as',
    );

    expect(byEmail).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      'ada@example.com',
    );
    expect(saved?.notes[1]?.voice.isWorld).toBe(true);
    expect(saved?.notes[1]?.voice.author?.value).toBe('user_9');
  });

  it('assigns a task without an assignee to the member of the team whose Slack reply answers it', async () => {
    const asked = Task.add({
      line: line(),
      at: StationId.of('station_2'),
      title: TaskTitle.of('Alert fired'),
      rank: TaskRank.of('i'),
      now: NOW,
      newId: () => 'task_1',
    }).askedAbout(
      {
        voice: Voice.station(),
        line: null,
        body: TaskNoteBody.of('Which region does the alert come from?'),
        at: NOW,
      },
      null,
    );

    await new ReactToHappenings(
      tasks(asked),
      tasks(asked),
      lines(),
      dispatch,
      transaction,
      clock,
      ids,
      { byEmail: async () => UserId.of('user_9') },
      files,
      processedEventsInMemory(),
      logger,
      channels,
      NO_RUNS,
      TEAMMATES,
    ).react(
      WorkspaceId.of('ws_1'),
      null,
      [
        {
          happening: 'slack.message.replied',
          summary: 'Replied in a Slack thread.',
          answers: true,
          state: 'raised',
          correlationKeys: {
            branch: null,
            marks: [{ kind: 'slack.thread', value: '1789022375.833389' }],
          },
          message: { body: 'From eu-west-1.' },
          authorEmail: 'ada@example.com',
          ourOwn: false,
          opens: null,
        },
      ],
      'received-as',
    );

    expect(saved?.assignee?.value).toBe('user_9');
  });

  it('takes a Slack thread reply as the answer a paused run waits for, so that same run is taken up', async () => {
    const paused = taskAt()
      .assignRun(RunId.of('run_1'), line())
      .putToAPerson(RunId.of('run_1'), {
        voice: Voice.station(RunId.of('run_1')),
        line: null,
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
      processedEventsInMemory(),
      logger,
      channels,
      NO_RUNS,
      TEAMMATES,
    ).react(
      WorkspaceId.of('ws_1'),
      null,
      [
        {
          happening: 'slack.app_mention',
          summary: 'Somebody mentioned Spotlight in Slack.',
          answers: true,
          state: 'raised',
          correlationKeys: {
            branch: null,
            marks: [{ kind: 'slack.thread', value: '1789022375.833389' }],
          },
          message: { body: 'In the example repository, please.' },
          ourOwn: false,
          opens: null,
        },
      ],
      'received-as',
    );

    expect(saved?.hasCurrentRun(RunId.of('run_1'))).toBe(true);
    expect(saved?.pullEvents()).toContainEqual(
      new TaskAnswered(
        saved?.id as TaskId,
        saved?.workspaceId as WorkspaceId,
        RunId.of('run_1'),
        null,
      ),
    );
    expect(dispatched).toHaveLength(0);
  });

  describe('a word carrying files', () => {
    const asked = () =>
      taskAt().askedAbout(
        {
          voice: Voice.station(),
          line: null,
          body: TaskNoteBody.of('What does the queue look like now?'),
          at: NOW,
        },
        null,
      );

    const replying = (
      message: string | null,
      fetch: () => Promise<Uint8Array>,
    ): Happened => ({
      happening: 'slack.message.replied',
      summary: 'Replied in a Slack thread.',
      answers: true,
      state: 'raised',
      correlationKeys: {
        branch: null,
        marks: [{ kind: 'slack.thread', value: '1789022375.833389' }],
      },
      message: message ? { body: message } : null,
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
        processedEventsInMemory(),
        logger,
        channels,
        NO_RUNS,
        TEAMMATES,
      ).react(WorkspaceId.of('ws_1'), null, [reply], 'received-as');

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
      expect(stored.map((each) => each.size)).toEqual([4]);
    });

    it('leaves behind a file it cannot have, and still receives the words', async () => {
      await react(
        replying('Still stuck.', async () => {
          throw new Error('files.slack.com answered 403');
        }),
      );

      expect(saved?.notes[1]?.body.value).toBe('Still stuck.');
      expect(saved?.notes[1]?.attachments).toEqual([]);
      expect(stored).toEqual([]);
      expect(logger.warn).toHaveBeenCalled();
    });
  });

  it('keeps the answer from a person pending where the world merely reports itself', async () => {
    const asked = taskAt().askedAbout(
      {
        voice: Voice.station(),
        line: null,
        body: TaskNoteBody.of('Which queue should I drain?'),
        at: NOW,
      },
      null,
    );

    await receive(CHECKS_FAILED, asked);

    expect(saved?.notes.map((each) => each.kind)).toEqual(['asked', 'message']);
    expect(saved?.awaitingReview).toBe(true);
    expect(dispatched).toHaveLength(0);
  });

  it('looks for no author where no rule takes the happening', async () => {
    const byEmail = vi.fn(async () => UserId.of('user_9'));

    await new ReactToHappenings(
      tasks(taskAt()),
      tasks(taskAt()),
      lines(),
      dispatch,
      transaction,
      clock,
      ids,
      { byEmail },
      files,
      processedEventsInMemory(),
      logger,
      channels,
      NO_RUNS,
      TEAMMATES,
    ).react(
      WorkspaceId.of('ws_1'),
      null,
      [{ ...news(COMMENTED, null), authorEmail: 'ada@example.com' }],
      'received-as',
    );

    expect(saved).toBeUndefined();
    expect(byEmail).not.toHaveBeenCalled();
  });

  it('says nothing of a review submitted with nothing written on it', async () => {
    await receive(COMMENTED, taskAt(), null);

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
      processedEventsInMemory(),
      logger,
      channels,
      NO_RUNS,
      TEAMMATES,
    ).react(
      WorkspaceId.of('ws_1'),
      null,
      [
        {
          ...news(MERGED, null),
          correlationKeys: {
            branch: null,
            marks: [{ kind: 'Not A Kind', value: 'x' }],
          },
        },
      ],
      'received-as',
    );

    expect(saved).toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('says nothing to a station nobody set to wait for it', async () => {
    await receive(
      Happening.of('github.pull_request.closed-unmerged'),
      taskAt(),
    );

    expect(saved).toBeUndefined();
    expect(dispatched).toHaveLength(0);
    expect(logger.info).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        happening: 'github.pull_request.closed-unmerged',
        reason: 'no-rule-matched',
      }),
      'Did not act on a happening',
    );
  });

  it('keeps a task with another open pull request where it is, and leaves the close to GitHub’s event', async () => {
    const api = PullRequestUrl.of('https://github.com/acme/api/pull/7');
    const docs = PullRequestUrl.of('https://github.com/acme/docs/pull/3');
    const owning = Task.rehydrate({
      ...taskAt(),
      ownedPullRequests: [
        OwnedPullRequest.of(api, NOW),
        OwnedPullRequest.of(docs, NOW),
      ],
    });

    await new ReactToHappenings(
      tasks(owning),
      tasks(owning),
      lines(),
      dispatch,
      transaction,
      clock,
      ids,
      members,
      files,
      processedEventsInMemory(),
      logger,
      channels,
      NO_RUNS,
      TEAMMATES,
    ).react(
      WorkspaceId.of('ws_1'),
      null,
      [{ ...news(MERGED, null), closedPullRequest: api.value }],
      'received-as',
    );

    expect(saved?.stationId.value).toBe('station_2');
    expect(saved?.openPullRequests).toEqual([api, docs]);
  });

  it('leaves a task that has landed at the end of the line alone', async () => {
    await receive(MERGED, landedAt('station_3'));

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
          stationId: StationId.of('station_code_review'),
          body: TaskNoteBody.of('The work is done.'),
          at: NOW,
          kind: 'passed',
        }),
      ],
      finishedAt: NOW,
    });

    expect(ended.finished).toBe(true);

    await receive(COMMENTED, ended, 'One more thing.');

    expect(saved?.notes.map((each) => each.kind)).toEqual([
      'passed',
      'message',
    ]);
    expect(saved?.finished).toBe(false);
    expect(dispatched).toHaveLength(1);
  });

  it('lets a pull request nobody here opened pass', async () => {
    await receive(MERGED, null);

    expect(saved).toBeUndefined();
    expect(logger.info).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ reason: 'no-task-matched' }),
      'Did not act on a happening',
    );
  });

  it('starts nothing where the task already has a current run', async () => {
    await receive(
      COMMENTED,
      taskAt().assignRun(RunId.of('run_1'), line()),
      'One more thing.',
    );

    expect(dispatched).toHaveLength(0);
    expect(saved?.currentRunId).toEqual(RunId.of('run_1'));
  });

  describe('a happening that would move a task that has a current run', () => {
    const handed = (stationId: string) => {
      const task = taskAt(stationId).assignRun(RunId.of('run_1'), line());
      task.pullEvents();
      return task;
    };

    const paused = (stationId: string) => {
      const task = taskAt(stationId)
        .assignRun(RunId.of('run_1'), line())
        .putToAPerson(RunId.of('run_1'), {
          line: null,
          body: TaskNoteBody.of('Which queue should I drain?'),
          at: NOW,
          voice: Voice.station(RunId.of('run_1')),
        });
      task.pullEvents();
      return task;
    };

    const approving = (stationId: string) => {
      const task = taskAt(stationId)
        .assignRun(RunId.of('run_1'), line())
        .putToAPerson(RunId.of('run_1'), {
          line: null,
          body: TaskNoteBody.of('Approve linear.comment?'),
          at: NOW,
          voice: Voice.station(RunId.of('run_1')),
          form: 'approval',
          approval: Approval.request(
            ApprovalSubject.toolCall(
              ToolCall.of(
                Tool.of('linear.comment'),
                ToolInputs.of({ body: 'x' }),
              ),
            ),
            StationId.of(stationId),
            ApprovalNeeded.of('linear.comment', 'It posts publicly.'),
            null,
          ),
        });
      task.pullEvents();
      return task;
    };

    it('leaves the task where it is and its current run', async () => {
      await receive(COMMENTED, handed('station_1'), 'This retries forever.');

      expect(saved?.stationId).toEqual(StationId.of('station_1'));
      expect(saved?.currentRunId).toEqual(RunId.of('run_1'));
      expect(saved?.pullEvents().map((each) => each.kind)).toEqual([
        'task.noted',
      ]);
      expect(dispatched).toHaveLength(0);
    });

    it('defers the move on a note, for the run to be told', async () => {
      await receive(COMMENTED, handed('station_1'), 'This retries forever.');

      expect(saved?.notes.map((each) => each.body.value)).toEqual([
        'compose.yml:22\nThis retries forever.',
      ]);
      expect(saved?.notes[0]?.station).toEqual(
        StationName.of('Implementation'),
      );
      expect(saved?.notes[0]?.voice.source?.value).toBe('github');
      expect(saved?.notes[0]?.reviewComment?.value).toBe('PRRC_kwDO');
      expect(saved?.unacknowledged).toHaveLength(1);
      expect(saved?.deferredMoveTo).toEqual(StationId.of('station_2'));
    });

    it('defers a comment with no anchor as the summary of what happened', async () => {
      await receive(COMMENTED, handed('station_1'), null);

      expect(saved?.stationId).toEqual(StationId.of('station_1'));
      expect(saved?.notes[0]?.body.value).toBe(
        'The pull request was commented.',
      );
      expect(saved?.deferredMoveTo).toEqual(StationId.of('station_2'));
      expect(dispatched).toHaveLength(0);
    });

    it('moves the task while the current run of the task waits on a person', async () => {
      await receive(COMMENTED, paused('station_1'), 'This retries forever.');

      expect(saved?.stationId).toEqual(StationId.of('station_2'));
      expect(saved?.awaitingReview).toBe(false);
      expect(saved?.deferredMoveTo).toBeNull();
      expect(saved?.pullEvents().map((each) => each.kind)).toContain(
        'task.run-detached',
      );
      expect(dispatched).toHaveLength(1);
    });

    it('defers the move while the current run of the task waits on a tool approval', async () => {
      await receive(COMMENTED, approving('station_1'), 'This retries forever.');

      expect(saved?.stationId).toEqual(StationId.of('station_1'));
      expect(saved?.currentRunId).toEqual(RunId.of('run_1'));
      expect(saved?.decisionPending).toBe(true);
      expect(saved?.deferredMoveTo).toEqual(StationId.of('station_2'));
      expect(dispatched).toHaveLength(0);
    });

    it('keeps a stored-back move when a later happening leaves the task where it is', async () => {
      await receive(COMMENTED, handed('station_1'), 'This retries forever.');
      const noted = saved as Task;

      await receive(CHANGES_REQUESTED, noted, 'Handle the empty case.');

      expect(saved?.stationId).toEqual(StationId.of('station_1'));
      expect(saved?.notes.map((each) => each.kind)).toEqual([
        'message',
        'message',
      ]);
      expect(saved?.deferredMoveTo).toEqual(StationId.of('station_2'));
    });

    it('moves the same task once it has no current run', async () => {
      await receive(COMMENTED, taskAt('station_1'), 'This retries forever.');

      expect(saved?.stationId).toEqual(StationId.of('station_2'));
      expect(saved?.notes[0]?.body.value).toBe(
        'compose.yml:22\nThis retries forever.',
      );
      expect(saved?.deferredMoveTo).toBeNull();
      expect(dispatched).toHaveLength(1);
    });

    describe('when the pull request merges', () => {
      it('finishes a task whose run is working, detaching the run', async () => {
        await receive(MERGED, handed('station_2'));

        expect(saved?.stationId).toEqual(StationId.of('station_3'));
        expect(saved?.finished).toBe(true);
        expect(saved?.currentRunId).toBeNull();
        expect(saved?.awaitingReview).toBe(false);
        expect(
          saved
            ?.pullEvents()
            .filter((each) => each.kind === 'task.run-detached')
            .map((each) => (each as TaskRunDetached).runId),
        ).toEqual([RunId.of('run_1')]);
        expect(dispatched).toHaveLength(0);
      });

      it('finishes a task whose paused run waits on a person, detaching the run', async () => {
        await receive(MERGED, paused('station_2'));

        expect(saved?.stationId).toEqual(StationId.of('station_3'));
        expect(saved?.finished).toBe(true);
        expect(saved?.currentRunId).toBeNull();
        expect(saved?.awaitingReview).toBe(false);
        expect(
          saved
            ?.pullEvents()
            .filter((each) => each.kind === 'task.run-detached')
            .map((each) => (each as TaskRunDetached).runId),
        ).toEqual([RunId.of('run_1')]);
        expect(dispatched).toHaveLength(0);
      });

      it('finishes a task whose run waits on a tool approval, even with a move deferred before it', async () => {
        await receive(
          CHANGES_REQUESTED,
          approving('station_2'),
          'Handle the empty case.',
        );
        expect(saved?.deferredMoveTo).toEqual(StationId.of('station_1'));

        await receive(MERGED, saved as Task);

        expect(saved?.stationId).toEqual(StationId.of('station_3'));
        expect(saved?.finished).toBe(true);
        expect(saved?.currentRunId).toBeNull();
        expect(saved?.decisionPending).toBe(false);
        expect(dispatched).toHaveLength(0);
      });

      it('finishes a task that has no current run, as before', async () => {
        await receive(MERGED, taskAt('station_1'));

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
      processedEventsInMemory(),
      logger,
      channels,
      NO_RUNS,
      TEAMMATES,
    ).react(WorkspaceId.of('ws_1'), null, [news(MERGED, null)], 'received-as');

    expect(stored.findByCorrelation).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      expect.anything(),
    );
  });

  it('opens a task on a line with the line role that the word names', async () => {
    const ISSUE_CREATED = Happening.of('linear.issue.created');
    const issueMark = Mark.of('linear.issue', 'ISS-1');

    let next = 0;
    const opening = deliveryLineOf({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
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
      placementsAt: vi.fn(async () => []),
      findByCorrelation: vi.fn(async () => []),
      owningPullRequest: vi.fn(async () => null),
      reviewingPullRequest: vi.fn(async () => null),
      holdingMark: vi.fn(async () => []),
      settingUpFor: vi.fn(async () => null),
      settingUpIn: vi.fn(async () => []),
      settingUp: vi.fn(async () => []),
      withTurnAnsweredBetween: vi.fn(async () => []),
      awaitingConnection: vi.fn(async () => []),
    } satisfies TaskRepository & TaskPlacementsPort;

    const running = {
      find: vi.fn(async () => opening),
      findByStation: vi.fn(async () => opening),
      ofWorkspace: vi.fn(async () => [opening]),
      ofTeam: vi.fn(async () => []),
      candidate: vi.fn(),
    } satisfies LineMapsPort;

    const filed: Happened = {
      happening: ISSUE_CREATED.value,
      summary: 'An issue was filed.',
      answers: false,
      state: 'raised',
      correlationKeys: { branch: null, marks: [issueMark] },
      message: null,
      ourOwn: false,
      opens: {
        lineRole: 'delivery',
        station: null,
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
      processedEventsInMemory(),
      logger,
      channels,
      NO_RUNS,
      TEAMMATES,
    ).react(WorkspaceId.of('ws_1'), null, [filed], 'received-as');

    expect(stored.add).toHaveBeenCalledTimes(1);
    expect(added?.stationId).toEqual(entry.id);
    expect(added?.marks.some((each) => each.equals(issueMark))).toBe(true);
    expect(added?.title.value).toBe('Drain the retry queue');
    expect(added?.description?.value).toBe('It loops forever.');
    expect(added?.pullEvents()).toContainEqual(
      expect.objectContaining({ kind: 'task.opened', fromIntegration: true }),
    );
  });

  it('assigns an opened task to the member matched by email', async () => {
    const ISSUE_CREATED = Happening.of('linear.issue.created');
    const issueMark = Mark.of('linear.issue', 'ISS-1');

    let next = 0;
    const opening = deliveryLineOf({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
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
      placementsAt: vi.fn(async () => []),
      findByCorrelation: vi.fn(async () => []),
      owningPullRequest: vi.fn(async () => null),
      reviewingPullRequest: vi.fn(async () => null),
      holdingMark: vi.fn(async () => []),
      settingUpFor: vi.fn(async () => null),
      settingUpIn: vi.fn(async () => []),
      settingUp: vi.fn(async () => []),
      withTurnAnsweredBetween: vi.fn(async () => []),
      awaitingConnection: vi.fn(async () => []),
    } satisfies TaskRepository & TaskPlacementsPort;

    const running = {
      find: vi.fn(async () => opening),
      findByStation: vi.fn(async () => opening),
      ofWorkspace: vi.fn(async () => [opening]),
      ofTeam: vi.fn(async () => []),
      candidate: vi.fn(),
    } satisfies LineMapsPort;

    const byEmail = vi.fn(async () => UserId.of('user_9'));

    const filed: Happened = {
      happening: ISSUE_CREATED.value,
      summary: 'An issue was filed.',
      answers: false,
      state: 'raised',
      correlationKeys: { branch: null, marks: [issueMark] },
      message: null,
      ourOwn: false,
      opens: {
        lineRole: 'delivery',
        station: null,
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
      processedEventsInMemory(),
      logger,
      channels,
      NO_RUNS,
      TEAMMATES,
    ).react(WorkspaceId.of('ws_1'), null, [filed], 'received-as');

    expect(byEmail).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      'dev@acme.test',
    );
    expect(added?.assignee?.value).toBe('user_9');
  });

  it('leaves an opened task unassigned where the member matched by email is not on its team', async () => {
    const ISSUE_CREATED = Happening.of('linear.issue.created');
    const issueMark = Mark.of('linear.issue', 'ISS-1');

    let next = 0;
    const opening = deliveryLineOf({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
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
      placementsAt: vi.fn(async () => []),
      findByCorrelation: vi.fn(async () => []),
      owningPullRequest: vi.fn(async () => null),
      reviewingPullRequest: vi.fn(async () => null),
      holdingMark: vi.fn(async () => []),
      settingUpFor: vi.fn(async () => null),
      settingUpIn: vi.fn(async () => []),
      settingUp: vi.fn(async () => []),
      withTurnAnsweredBetween: vi.fn(async () => []),
      awaitingConnection: vi.fn(async () => []),
    } satisfies TaskRepository & TaskPlacementsPort;

    const running = {
      find: vi.fn(async () => opening),
      findByStation: vi.fn(async () => opening),
      ofWorkspace: vi.fn(async () => [opening]),
      ofTeam: vi.fn(async () => []),
      candidate: vi.fn(),
    } satisfies LineMapsPort;

    const byEmail = vi.fn(async () => UserId.of('user_9'));

    const filed: Happened = {
      happening: ISSUE_CREATED.value,
      summary: 'An issue was filed.',
      answers: false,
      state: 'raised',
      correlationKeys: { branch: null, marks: [issueMark] },
      message: null,
      ourOwn: false,
      opens: {
        lineRole: 'delivery',
        station: null,
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
      processedEventsInMemory(),
      logger,
      channels,
      NO_RUNS,
      { membersOf: async () => TeamMembers.of([]) },
    ).react(WorkspaceId.of('ws_1'), null, [filed], 'received-as');

    expect(byEmail).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      'dev@acme.test',
    );
    expect(added?.assignee).toBeNull();
  });

  it('leaves an opened task unassigned where no member has the email', async () => {
    const ISSUE_CREATED = Happening.of('linear.issue.created');
    const issueMark = Mark.of('linear.issue', 'ISS-1');

    let next = 0;
    const opening = deliveryLineOf({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
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
      placementsAt: vi.fn(async () => []),
      findByCorrelation: vi.fn(async () => []),
      owningPullRequest: vi.fn(async () => null),
      reviewingPullRequest: vi.fn(async () => null),
      holdingMark: vi.fn(async () => []),
      settingUpFor: vi.fn(async () => null),
      settingUpIn: vi.fn(async () => []),
      settingUp: vi.fn(async () => []),
      withTurnAnsweredBetween: vi.fn(async () => []),
      awaitingConnection: vi.fn(async () => []),
    } satisfies TaskRepository & TaskPlacementsPort;

    const running = {
      find: vi.fn(async () => opening),
      findByStation: vi.fn(async () => opening),
      ofWorkspace: vi.fn(async () => [opening]),
      ofTeam: vi.fn(async () => []),
      candidate: vi.fn(),
    } satisfies LineMapsPort;

    const filed: Happened = {
      happening: ISSUE_CREATED.value,
      summary: 'An issue was filed.',
      answers: false,
      state: 'raised',
      correlationKeys: { branch: null, marks: [issueMark] },
      message: null,
      ourOwn: false,
      opens: {
        lineRole: 'delivery',
        station: null,
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
      processedEventsInMemory(),
      logger,
      channels,
      NO_RUNS,
      TEAMMATES,
    ).react(WorkspaceId.of('ws_1'), null, [filed], 'received-as');

    expect(added?.assignee).toBeNull();
  });

  it('opens one task where two lines share the line role that it names', async () => {
    const ISSUE_CREATED = Happening.of('linear.issue.created');
    const issueMark = Mark.of('linear.issue', 'ISS-1');

    const delivery = (key: string) => {
      let next = 0;
      return deliveryLineOf({
        workspaceId: WorkspaceId.of('ws_1'),
        teamId: TeamId.of('team_1'),
        key,
        name: key,
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
      placementsAt: vi.fn(async () => []),
      findByCorrelation: vi.fn(async () => []),
      owningPullRequest: vi.fn(async () => null),
      reviewingPullRequest: vi.fn(async () => null),
      holdingMark: vi.fn(async () => []),
      settingUpFor: vi.fn(async () => null),
      settingUpIn: vi.fn(async () => []),
      settingUp: vi.fn(async () => []),
      withTurnAnsweredBetween: vi.fn(async () => []),
      awaitingConnection: vi.fn(async () => []),
    } satisfies TaskRepository & TaskPlacementsPort;

    const running = {
      find: vi.fn(async () => first),
      findByStation: vi.fn(async () => first),
      ofWorkspace: vi.fn(async () => [second, first]),
      ofTeam: vi.fn(async () => []),
      candidate: vi.fn(),
    } satisfies LineMapsPort;

    const filed: Happened = {
      happening: ISSUE_CREATED.value,
      summary: 'An issue was filed.',
      answers: false,
      state: 'raised',
      correlationKeys: { branch: null, marks: [issueMark] },
      message: null,
      ourOwn: false,
      opens: {
        lineRole: 'delivery',
        station: null,
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
      processedEventsInMemory(),
      logger,
      channels,
      NO_RUNS,
      TEAMMATES,
    ).react(WorkspaceId.of('ws_1'), null, [filed], 'received-as');

    expect(stored.add).toHaveBeenCalledTimes(1);
    expect(added[0]?.stationId).toEqual((first.entry as Station).id);
  });
});

describe('ReactToHappenings assigning a task it opens', () => {
  const DIRECTORY: Record<string, string> = {
    'dev@acme.test': 'user_dev',
    'lead@acme.test': 'user_lead',
    'outsider@acme.test': 'user_outsider',
  };

  const opening = (input: {
    readonly assignEmail: string | null;
    readonly defaultAssignee: string | null;
  }) => {
    let next = 0;
    const onLine = deliveryLineOf({
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      newId: () => `id_${++next}`,
      defaultAssignee: input.defaultAssignee,
    });

    let added: Task | undefined;
    const stored = {
      add: vi.fn(async (each: Task) => {
        added = each;
      }),
      save: vi.fn(),
      find: vi.fn(async () => null),
      remove: vi.fn(),
      placementsAt: vi.fn(async () => []),
      findByCorrelation: vi.fn(async () => []),
      owningPullRequest: vi.fn(async () => null),
      reviewingPullRequest: vi.fn(async () => null),
      holdingMark: vi.fn(async () => []),
      settingUpFor: vi.fn(async () => null),
      settingUpIn: vi.fn(async () => []),
      settingUp: vi.fn(async () => []),
      withTurnAnsweredBetween: vi.fn(async () => []),
      awaitingConnection: vi.fn(async () => []),
    } satisfies TaskRepository & TaskPlacementsPort;

    const running = {
      find: vi.fn(async () => onLine),
      findByStation: vi.fn(async () => onLine),
      ofWorkspace: vi.fn(async () => [onLine]),
      ofTeam: vi.fn(async () => []),
      candidate: vi.fn(),
    } satisfies LineMapsPort;

    const issueMark = Mark.of('linear.issue', 'ISS-1');
    const filed: Happened = {
      happening: 'linear.issue.created',
      summary: 'An issue was filed.',
      answers: false,
      state: 'raised',
      correlationKeys: { branch: null, marks: [issueMark] },
      message: null,
      ourOwn: false,
      opens: {
        lineRole: 'delivery',
        station: null,
        title: 'Drain the retry queue',
        description: null,
        assignEmail: input.assignEmail,
        marks: [issueMark],
      },
    };

    const assigned = async (): Promise<string | null> => {
      await new ReactToHappenings(
        stored,
        stored,
        running,
        dispatch,
        transaction,
        clock,
        ids,
        {
          byEmail: async (_workspaceId, email) => {
            const found = DIRECTORY[email];

            return found ? UserId.of(found) : null;
          },
        },
        files,
        processedEventsInMemory(),
        logger,
        channels,
        NO_RUNS,
        {
          membersOf: async () =>
            TeamMembers.of([UserId.of('user_dev'), UserId.of('user_lead')]),
        },
      ).react(WorkspaceId.of('ws_1'), null, [filed], 'received-as');

      return added?.assignee?.value ?? null;
    };

    return { assigned };
  };

  it('assigns the person the happening names over the default assignee of the line', async () => {
    expect(
      await opening({
        assignEmail: 'dev@acme.test',
        defaultAssignee: 'lead@acme.test',
      }).assigned(),
    ).toBe('user_dev');
  });

  it('assigns the default assignee of the line where the happening names nobody', async () => {
    expect(
      await opening({
        assignEmail: null,
        defaultAssignee: 'lead@acme.test',
      }).assigned(),
    ).toBe('user_lead');
  });

  it('assigns the default assignee of the line where the person the happening names is not on the team', async () => {
    expect(
      await opening({
        assignEmail: 'stranger@acme.test',
        defaultAssignee: 'lead@acme.test',
      }).assigned(),
    ).toBe('user_lead');
  });

  it('leaves the task unassigned where the default assignee of the line is not on the team', async () => {
    expect(
      await opening({
        assignEmail: null,
        defaultAssignee: 'outsider@acme.test',
      }).assigned(),
    ).toBeNull();
  });

  it('leaves the task unassigned where neither the happening nor the line names anybody', async () => {
    expect(
      await opening({ assignEmail: null, defaultAssignee: null }).assigned(),
    ).toBeNull();
  });
});

describe('ReactToHappenings with a word for a chat', () => {
  const mention = (): Happened => ({
    happening: 'slack.app_mention',
    summary: 'Mentioned Spotlight in Slack.',
    answers: false,
    state: 'raised',
    correlationKeys: {
      branch: null,
      marks: [{ kind: 'slack.thread', value: 'C1:1700.1' }],
    },
    message: { body: 'Why do retries fail?' },
    ourOwn: false,
    opens: null,
    chat: {
      email: 'ada@example.com',
      harness: null,
      marks: [{ kind: 'slack.thread', value: 'C1:1700.1', finds: true }],
    },
  });

  const MENTIONED = Happening.of('slack.app_mention');

  const reacting = (
    found: Task | null,
    over: { member?: boolean; mentionedTo?: string } = {},
  ) => {
    const refusal = { body: 'Sorry.' };
    const chatting = {
      reached: vi.fn(async () => refusal),
      answer: vi.fn(async () => undefined),
    };
    const ruled = line(
      over.mentionedTo ? [sends(MENTIONED, over.mentionedTo)] : [],
    );
    const reactions = new ReactToHappenings(
      tasks(found),
      tasks(found),
      { ...lines(), findByStation: vi.fn(async () => ruled) },
      dispatch,
      transaction,
      clock,
      ids,
      {
        byEmail: async () => (over.member === false ? null : UserId.of('ada')),
      },
      files,
      processedEventsInMemory(),
      logger,
      chatting as unknown as ChannelChats,
      NO_RUNS,
      TEAMMATES,
    );

    return { reactions, chatting, refusal };
  };

  const finishedAt = (stationId: string) =>
    Task.rehydrate({ ...taskAt(stationId), finishedAt: NOW });

  beforeEach(() => {
    saved = undefined;
    dispatched.length = 0;
  });

  it('hands it to the chats when no task wears its marks, and posts the refusal after', async () => {
    const { reactions, chatting, refusal } = reacting(null);

    await reactions.react(WorkspaceId.of('ws_1'), null, [mention()], null);

    expect(chatting.reached).toHaveBeenCalledOnce();
    expect(chatting.answer).toHaveBeenCalledWith(refusal);
  });

  it('keeps it away from the chats and out of the notes of a task that wears its marks', async () => {
    const { reactions, chatting } = reacting(taskAt());

    await reactions.react(WorkspaceId.of('ws_1'), null, [mention()], null);

    expect(chatting.reached).not.toHaveBeenCalled();
    expect(
      saved?.notes.some((note) => note.body.value.includes('retries')) ?? false,
    ).toBe(false);
  });

  describe('on a finished task', () => {
    it('reopens it at the station it finished at, as the person who wrote, and starts a run', async () => {
      const { reactions, chatting } = reacting(finishedAt('station_2'));

      await reactions.react(WorkspaceId.of('ws_1'), null, [mention()], null);

      expect(saved?.finished).toBe(false);
      expect(saved?.stationId).toEqual(StationId.of('station_2'));
      expect(saved?.notes[saved.notes.length - 1]?.body.value).toContain(
        'Why do retries fail?',
      );
      expect(saved?.notes[saved.notes.length - 1]?.voice.author).toEqual(
        UserId.of('ada'),
      );
      expect(dispatched).toHaveLength(1);
      expect(chatting.answer).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'chat.acknowledged', body: '' }),
      );
    });

    it('reopens it at the station the line sends a mention to', async () => {
      const { reactions } = reacting(finishedAt('station_2'), {
        mentionedTo: 'station_1',
      });

      await reactions.react(WorkspaceId.of('ws_1'), null, [mention()], null);

      expect(saved?.stationId).toEqual(StationId.of('station_1'));
      expect(saved?.finished).toBe(false);
      expect(dispatched).toHaveLength(1);
    });

    it('refuses a task at the completed station, and leaves it alone', async () => {
      const { reactions, chatting } = reacting(
        Task.rehydrate({ ...landedAt('station_3'), finishedAt: NOW }),
      );

      await reactions.react(WorkspaceId.of('ws_1'), null, [mention()], null);

      expect(saved).toBeUndefined();
      expect(chatting.answer).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'chat.refused',
          body: ChannelReplies.taskCompleted,
        }),
      );
    });

    it('refuses a person who is not a member, and leaves the task alone', async () => {
      const { reactions, chatting } = reacting(finishedAt('station_2'), {
        member: false,
      });

      await reactions.react(WorkspaceId.of('ws_1'), null, [mention()], null);

      expect(saved).toBeUndefined();
      expect(chatting.answer).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'chat.refused',
          body: ChannelReplies.unknownPerson,
        }),
      );
    });

    it('leaves a thread reply without a mention to the task as before', async () => {
      const { reactions, chatting } = reacting(finishedAt('station_2'));
      const { chat: _, ...replied } = mention();

      await reactions.react(
        WorkspaceId.of('ws_1'),
        null,
        [{ ...replied, happening: 'slack.message.replied', answers: true }],
        null,
      );

      expect(saved).toBeUndefined();
      expect(chatting.answer).not.toHaveBeenCalled();
    });
  });
});

describe('a happening for a task whose run’s turn is still being decided (R18)', () => {
  const turnFor = (turn: 'pending' | 'kept', ageMs: number) =>
    ({
      of: async () => [
        {
          runId: RunId.of('run_1'),
          turn,
          suspendedAt: new Date(NOW.getTime() - ageMs),
        },
      ],
    }) as unknown as RunFactsPort;

  const reacting = (runs: RunFactsPort) => {
    const stored = tasks(taskAt().assignRun(RunId.of('run_1'), line()));

    return {
      stored,
      reactions: new ReactToHappenings(
        stored,
        stored,
        lines(),
        dispatch,
        transaction,
        clock,
        ids,
        members,
        files,
        processedEventsInMemory(),
        logger,
        channels,
        runs,
        TEAMMATES,
      ),
    };
  };

  it('is held back as a transient failure, so the delivery comes again once the turn is decided', async () => {
    const { reactions, stored } = reacting(turnFor('pending', 60_000));

    await expect(
      reactions.react(
        WorkspaceId.of('ws_1'),
        null,
        [news(CHANGES_REQUESTED, 'Handle the empty case.')],
        'delivery_1',
      ),
    ).resolves.toMatchObject({ kind: 'failed', transient: true });
    expect(stored.save).not.toHaveBeenCalled();
  });

  it('applies as to a working task once the turn has been pending longer than the wait', async () => {
    const { reactions, stored } = reacting(turnFor('pending', 4 * 60_000));

    await reactions.react(
      WorkspaceId.of('ws_1'),
      null,
      [news(CHANGES_REQUESTED, 'Handle the empty case.')],
      'delivery_1',
    );

    expect(stored.save).toHaveBeenCalled();
  });

  it('is never held when its turn is kept, or for a poll with no cursor', async () => {
    const kept = reacting(turnFor('kept', 60_000));
    const cursorless = reacting(turnFor('pending', 60_000));

    await kept.reactions.react(
      WorkspaceId.of('ws_1'),
      null,
      [news(COMMENTED, 'Still retries.')],
      'delivery_1',
    );
    await cursorless.reactions.react(
      WorkspaceId.of('ws_1'),
      null,
      [news(COMMENTED, 'Still retries.')],
      null,
    );

    expect(kept.stored.save).toHaveBeenCalled();
    expect(cursorless.stored.save).toHaveBeenCalled();
  });
});
