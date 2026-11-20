import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { LineResumed } from '@work/domain/events/line-resumed.event';
import { PullRequestOpened } from '@work/domain/events/pull-request-opened.event';
import { TaskHeld } from '@work/domain/events/task-held.event';
import { TaskNotedForChat } from '@work/domain/events/task-noted-for-chat.event';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';
import { TaskOnHoldError } from '@work/domain/exceptions/task-on-hold.error';
import { Branch } from '@work/domain/value-objects/branch.vo';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { HoldId } from '@work/domain/value-objects/hold-id.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { TeamMembers } from '@work/domain/value-objects/team-members.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-19T09:00:00.000Z');
const LATER = new Date('2026-11-19T10:00:00.000Z');
const LEON = UserId.of('user_leon');
const MAYA = UserId.of('user_maya');
const CHAT = ChatId.of('chat_1');
const BACKLOG = StationId.of('station_backlog');
const BUILD = StationId.of('station_build');
const REVIEW = StationId.of('station_review');
const COMPLETED = StationId.of('station_completed');
const URL = PullRequestUrl.of('https://github.com/acme/web/pull/7');

const station = (
  id: StationId,
  key: string,
  position: number,
  extra: Partial<Parameters<typeof stationOf>[0]> = {},
) =>
  stationOf({
    id,
    key: StationKey.of(key),
    name: StationName.of(key),
    position,
    color: '#a3a8b0',
    ...extra,
  });

const line = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    station(BACKLOG, 'backlog', 0, { kind: 'backlog' }),
    station(BUILD, 'build', 1, { harness: HarnessId.of('dev') }),
    station(REVIEW, 'ship', 2, {
      harness: HarnessId.of('dev'),
      tools: [Tool.of('pull-request')],
    }),
    station(COMPLETED, 'completed', 3, { kind: 'completed' }),
  ],
});

const opened = (at: StationId = REVIEW) =>
  Task.openedInChat({
    line,
    at,
    title: TaskTitle.of('Show video icons'),
    description: null,
    branch: Branch.of('feat/video-icons'),
    rank: TaskRank.of('i'),
    by: LEON,
    members: TeamMembers.of([LEON, MAYA]),
    chat: CHAT,
    hold: HoldId.of('hold_1'),
    now: NOW,
    newId: () => 'task_1',
  });

const said = (body: string, voice: Voice) => ({
  line,
  body: TaskNoteBody.of(body),
  at: LATER,
  voice,
});

const wordsFor = (task: Task) =>
  task
    .pullEvents()
    .filter(
      (each): each is TaskNotedForChat => each instanceof TaskNotedForChat,
    );

describe('a task a chat opens a pull request for', () => {
  it('waits on hold for the chat at the station it opened at, with the chat’s branch', () => {
    const task = opened();

    expect(task.stationId.equals(REVIEW)).toBe(true);
    expect(task.openHold?.chat?.equals(CHAT)).toBe(true);
    expect(task.heldFor(CHAT)).toBe(true);
    expect(task.heldFor(ChatId.of('chat_2'))).toBe(false);
    expect(task.openHold?.from).toBeNull();
    expect(task.assignee?.equals(LEON)).toBe(true);
    expect(task.branch.value).toBe('feat/video-icons');
    expect(task.pullRequests).toEqual([]);
    expect(task.wantsRun(line)).toBe(false);
    expect(task.pullEvents().some((each) => each instanceof TaskHeld)).toBe(
      true,
    );
  });

  it('keeps the pull request its chat opened, once', () => {
    const task = opened();
    task.pullEvents();
    const recorded = task.recordChatPullRequest(CHAT, URL, LATER, line);

    expect(recorded.pullRequests.map((each) => each.value)).toEqual([
      URL.value,
    ]);
    expect(
      recorded.pullEvents().some((each) => each instanceof PullRequestOpened),
    ).toBe(true);
    expect(
      recorded.recordChatPullRequest(CHAT, URL, LATER, line).pullEvents(),
    ).toEqual([]);
  });

  it('keeps the pull request its chat opened after the person handed the task to the line', () => {
    const handed = opened().resumeLine({
      by: LEON,
      line,
      next: 'continue',
      to: null,
      rank: null,
      verdict: null,
      summary: null,
      turnHeads: [],
      at: LATER,
    });

    expect(handed.wasHeldFor(CHAT)).toBe(true);
    expect(
      handed
        .recordChatPullRequest(CHAT, URL, LATER, line)
        .pullRequests.map((each) => each.value),
    ).toEqual([URL.value]);
  });

  it('keeps no pull request from a chat that does not hold it', () => {
    expect(() =>
      opened().recordChatPullRequest(ChatId.of('chat_2'), URL, LATER, line),
    ).toThrow(/was never on hold for chat chat_2/);
  });

  it('cannot open at a station where no agent works', () => {
    expect(() => opened(BACKLOG)).toThrow(InvalidTaskTransitionError);
  });

  it('holds every note aside, the person’s too, and passes each to the chat', () => {
    const task = opened();
    task.pullEvents();

    const noted = task
      .addMessage(said('Checks failed on web.', Voice.world()))
      .addMessage(said('Use the Film icon.', Voice.person(LEON)));
    const words = wordsFor(noted);

    expect(words.map((each) => [each.body, each.wakes])).toEqual([
      ['Checks failed on web.', true],
      ['Use the Film icon.', true],
    ]);
    expect(words.every((each) => each.chatId.equals(CHAT))).toBe(true);
    expect(noted.wantsRun(line)).toBe(false);
  });

  it('keeps a move to another station for when the line resumes, and tells the chat', () => {
    const task = opened();
    task.pullEvents();

    expect(task.movableByHappeningTo(line, BUILD)).toBe(false);

    const held = task.deferMove(
      line,
      BUILD,
      said('Changes were requested.', Voice.world()),
    );

    expect(held.openHold?.heldMove?.equals(BUILD)).toBe(true);
    expect(wordsFor(held).map((each) => each.wakes)).toEqual([true]);
  });

  it('completes when its pull request merges, ends the hold and tells the chat without waking it', () => {
    const task = opened();
    task.pullEvents();

    expect(task.movableByHappeningTo(line, COMPLETED)).toBe(true);

    const merged = task.react(
      line,
      COMPLETED,
      TaskRank.of('m'),
      said('The pull request was merged.', Voice.world()),
    );
    const events = merged.pullEvents();
    const resumed = events.find(
      (each): each is LineResumed => each instanceof LineResumed,
    );

    expect(merged.finished).toBe(true);
    expect(merged.openHold).toBeNull();
    expect(resumed?.end).toBe('finish');
    expect(
      events
        .filter(
          (each): each is TaskNotedForChat => each instanceof TaskNotedForChat,
        )
        .map((each) => [each.body, each.wakes]),
    ).toEqual([['The pull request was merged.', false]]);
  });

  it('goes back to the line when the person hands it over', () => {
    const back = opened().resumeLine({
      by: LEON,
      line,
      next: 'continue',
      to: null,
      rank: null,
      verdict: null,
      summary: null,
      turnHeads: [],
      at: LATER,
    });

    expect(back.openHold).toBeNull();
    expect(back.stationId.equals(REVIEW)).toBe(true);
    expect(back.wantsRun(line)).toBe(true);
    const told = wordsFor(back);

    expect(told.map((each) => [each.chatId.value, each.wakes])).toEqual([
      ['chat_1', false],
    ]);
    expect(told[0]?.body).toMatch(/handed the task to the line/);
  });

  it('goes back to the line only when the person whose chat holds it says so', () => {
    expect(() =>
      opened().resumeLine({
        by: MAYA,
        line,
        next: 'continue',
        to: null,
        rank: null,
        verdict: null,
        summary: null,
        turnHeads: [],
        at: LATER,
      }),
    ).toThrow(TaskOnHoldError);
    expect(() =>
      opened().moveTo(
        line,
        BACKLOG,
        TaskRank.of('m'),
        said('Not now.', Voice.person(MAYA)),
        { mover: MAYA },
      ),
    ).toThrow(TaskOnHoldError);
  });

  it('tells the chat when the person moves the task on by hand', () => {
    const task = opened();
    task.pullEvents();
    const moved = task.moveTo(
      line,
      BACKLOG,
      TaskRank.of('m'),
      said('Not now.', Voice.person(LEON)),
      { mover: LEON },
    );

    expect(moved.openHold).toBeNull();
    expect(wordsFor(moved).map((each) => [each.body, each.wakes])).toEqual([
      [
        'The person moved the task to backlog. It waits there until someone starts it. Do not push to its branch again. When the person asks for more changes, make them on a new branch.',
        false,
      ],
    ]);
  });

  it('tells the chat the task is done when the person moves it to completed', () => {
    const task = opened();
    task.pullEvents();
    const moved = task.moveTo(
      line,
      COMPLETED,
      TaskRank.of('m'),
      said('Ship it.', Voice.person(LEON)),
      { mover: LEON },
    );

    expect(wordsFor(moved)[0]?.body).toMatch(
      /^The person moved the task to completed, so the task is done\./,
    );
  });

  it('refuses to open its pull request again after the person handed it to the line, though one is open', () => {
    const back = opened()
      .recordChatPullRequest(CHAT, URL, LATER, line)
      .resumeLine({
        by: LEON,
        line,
        next: 'continue',
        to: null,
        rank: null,
        verdict: null,
        summary: null,
        turnHeads: [],
        at: LATER,
      });

    expect(
      back.chatPullRequestStep(CHAT, Repository.of('acme/web'), line),
    ).toEqual({
      kind: 'refused',
      refusal: {
        kind: 'branch-of-released-task',
        branch: Branch.of('feat/video-icons'),
        completed: false,
      },
    });
  });

  it('answers the pull request it already opened while it holds the task', () => {
    expect(
      opened()
        .recordChatPullRequest(CHAT, URL, LATER, line)
        .chatPullRequestStep(CHAT, Repository.of('acme/web'), line),
    ).toEqual({ kind: 'known', url: URL });
  });

  it('opens a pull request only in a repository its line works on', () => {
    const task = opened();

    expect(
      task.chatPullRequestStep(CHAT, Repository.of('acme/billing'), line),
    ).toMatchObject({
      kind: 'refused',
      refusal: { kind: 'branch-off-the-line' },
    });
    expect(
      task.chatPullRequestStep(
        ChatId.of('chat_2'),
        Repository.of('acme/web'),
        line,
      ),
    ).toMatchObject({
      kind: 'refused',
      refusal: { kind: 'branch-of-another-task' },
    });
  });

  it('takes no turns of its own while the chat holds it', () => {
    expect(() => opened().assignRun(RunId.of('run_1'), line)).toThrow(
      /is waiting on a person/,
    );
  });
});
