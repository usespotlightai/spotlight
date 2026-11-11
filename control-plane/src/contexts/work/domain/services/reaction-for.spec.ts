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
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { type Outcome, ReactionFor } from '@work/domain/services/reaction-for';
import { Anchor } from '@work/domain/value-objects/anchor.vo';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { Approval } from '@work/domain/value-objects/approval.vo';
import type { HappeningPayload } from '@work/domain/value-objects/happening-payload';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { OwnedPullRequest } from '@work/domain/value-objects/owned-pull-request.vo';
import { Reaction } from '@work/domain/value-objects/reaction.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOTHING_HELD = { line: null, ranksAtHeldMove: [] };

const NOW = new Date('2026-09-29T12:00:00.000Z');
const RUN = RunId.of('run_1');

const MERGED = Happening.of('github.pull_request.merged');
const COMMENTED = Happening.of('github.pull_request.commented');
const CLOSED = Happening.of('github.pull_request.closed-unmerged');

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

const LINE = lineMapOf({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    at('station_0', 'Backlog', 0, 'backlog'),
    at('station_1', 'Implementation', 1),
    at('station_2', 'Code Review', 2),
    at('station_3', 'Completed', 3, 'completed'),
  ],
  reactions: [
    Reaction.of({
      happening: COMMENTED,
      from: null,
      to: StationId.of('station_2'),
    }),
    Reaction.of({
      happening: MERGED,
      from: null,
      to: StationId.of('station_3'),
    }),
    Reaction.of({
      happening: CLOSED,
      from: null,
      to: StationId.of('station_3'),
    }),
  ],
});

const taskAt = (stationId: string) =>
  Task.add({
    line: LINE,
    at: StationId.of(stationId),
    title: TaskTitle.of('Retry uploads'),
    rank: TaskRank.of('i'),
    now: NOW,
    newId: () => 'task_1',
  });

const landedAt = (stationId: string) =>
  Task.rehydrate({
    ...taskAt('station_1'),
    stationId: StationId.of(stationId),
  });

const payloadOf = (
  happening: Happening,
  summary: string,
): HappeningPayload => ({
  happening,
  summary,
  answers: happening.equals(COMMENTED),
  state: 'raised',
});

const merged = payloadOf(MERGED, 'The pull request was merged.');
const commented = payloadOf(COMMENTED, 'The pull request was commented on.');

const reaction = (
  task: Task,
  payload: HappeningPayload,
  anchor: Anchor | null = null,
) => ReactionFor.happened({ task, line: LINE, payload, anchor });

const destination = (outcome: Outcome) =>
  outcome.kind === 'moves' || outcome.kind === 'deferredMove'
    ? outcome.to.id
    : null;

const destinationHeld = (outcome: Outcome) =>
  outcome.kind === 'held' ? outcome.to.id.value : null;

const ON = {
  at: NOW,
  voice: Voice.world(),
  attachments: [],
  ranksAtDestination: [],
};

const handed = (stationId: string) => taskAt(stationId).assignRun(RUN, LINE);

const paused = (stationId: string) =>
  handed(stationId).putToAPerson(RUN, {
    line: null,
    body: TaskNoteBody.of('Which queue should I drain?'),
    at: NOW,
    voice: Voice.station(RUN),
  });

const API = PullRequestUrl.of('https://github.com/acme/api/pull/7');
const DOCS = PullRequestUrl.of('https://github.com/acme/docs/pull/3');

const openedTwo = () =>
  Task.rehydrate({
    ...taskAt('station_1'),
    ownedPullRequests: [
      OwnedPullRequest.of(API, NOW),
      OwnedPullRequest.of(DOCS, NOW),
    ],
  });

const mergedOf = (url: PullRequestUrl): HappeningPayload => ({
  ...merged,
  closedPullRequest: url,
});

describe('ReactionFor.happened', () => {
  it('holds the move of a task with another pull request still open, with a note', () => {
    const outcome = reaction(
      openedTwo().pullRequestClosed(API, NOW, NOTHING_HELD),
      mergedOf(API),
    );

    expect(outcome.kind).toBe('held');
    expect(destinationHeld(outcome)).toBe('station_3');
  });

  it('holds the move when another pull request is open, before the close is recorded', () => {
    expect(reaction(openedTwo(), mergedOf(API)).kind).toBe('held');
  });

  it('moves a task whose two pull requests close at once, when the last close is recorded', () => {
    const before = openedTwo();
    const [apiHeld, docsHeld] = [mergedOf(API), mergedOf(DOCS)].map((each) =>
      reaction(before, each),
    );

    expect([apiHeld?.kind, docsHeld?.kind]).toEqual(['held', 'held']);

    const held = before.reactTo(apiHeld, ON) as Task;
    const onLine = { line: LINE, ranksAtHeldMove: [] };
    const apiClosed = held.pullRequestClosed(API, NOW, onLine);
    const bothClosed = apiClosed.pullRequestClosed(DOCS, NOW, onLine);

    expect(held.moveHeldTo?.value).toBe('station_3');
    expect(apiClosed.stationId.value).toBe('station_1');
    expect(bothClosed.stationId.value).toBe('station_3');
    expect(bothClosed.moveHeldTo).toBeNull();
    expect(bothClosed.finishedAt).toEqual(NOW);
  });

  it('defers the held move of a task with a run in progress to the end of the run', () => {
    const toReview = Task.rehydrate({
      ...openedTwo().assignRun(RUN, LINE),
      ownedPullRequests: [
        OwnedPullRequest.of(API, NOW),
        OwnedPullRequest.of(DOCS, NOW),
      ],
    });
    const held = toReview.reactTo(
      reaction(toReview, { ...commented, closedPullRequest: API }),
      ON,
    ) as Task;
    const released = held
      .pullRequestClosed(API, NOW, { line: LINE, ranksAtHeldMove: [] })
      .pullRequestClosed(DOCS, NOW, { line: LINE, ranksAtHeldMove: [] });

    expect(released.stationId.value).toBe('station_1');
    expect(released.deferredMoveTo?.value).toBe('station_2');
    expect(released.moveHeldTo).toBeNull();
  });

  it('drops a held move once a pull request of the task reopens', () => {
    const before = openedTwo();
    const held = before.reactTo(reaction(before, mergedOf(API)), ON) as Task;
    const reopened = held
      .pullRequestClosed(API, NOW, NOTHING_HELD)
      .pullRequestReopened(API);

    expect(reopened.moveHeldTo).toBeNull();
    expect(
      reopened
        .pullRequestClosed(API, NOW, { line: LINE, ranksAtHeldMove: [] })
        .pullRequestClosed(DOCS, NOW, { line: LINE, ranksAtHeldMove: [] })
        .stationId.value,
    ).toBe('station_1');
  });

  it('moves a task when the last of its pull requests merges, before the close is recorded', () => {
    const outcome = reaction(
      openedTwo().pullRequestClosed(API, NOW, NOTHING_HELD),
      mergedOf(DOCS),
    );

    expect(outcome.kind).toBe('moves');
  });

  it('moves a task once the last of its pull requests merges after another closed unmerged', () => {
    const outcome = reaction(
      openedTwo()
        .pullRequestClosed(API, NOW, NOTHING_HELD)
        .pullRequestClosed(DOCS, NOW, NOTHING_HELD),
      mergedOf(DOCS),
    );

    expect(outcome.kind).toBe('moves');
  });

  it('moves a task once the last of its pull requests merges', () => {
    const outcome = reaction(
      openedTwo()
        .pullRequestClosed(API, NOW, NOTHING_HELD)
        .pullRequestClosed(DOCS, NOW, NOTHING_HELD),
      mergedOf(DOCS),
    );

    expect(outcome.kind).toBe('moves');
    expect(destination(outcome)).toEqual(StationId.of('station_3'));
  });

  it('moves a task with no current run to the station the rule names', () => {
    const outcome = reaction(taskAt('station_1'), commented);

    expect(outcome.kind).toBe('moves');
    expect(destination(outcome)).toEqual(StationId.of('station_2'));
  });

  it('moves a task with no current run to the end of the line when the pull request merges', () => {
    const outcome = reaction(taskAt('station_1'), merged);

    expect(outcome.kind).toBe('moves');
    expect(destination(outcome)).toEqual(StationId.of('station_3'));
  });

  it('defers a move while the task has a current run, noted where the task is', () => {
    const outcome = reaction(
      handed('station_1'),
      commented,
      Anchor.of({ body: 'This retries forever.', path: 'upload.ts', from: 12 }),
    );

    expect(outcome.kind).toBe('deferredMove');
    expect(destination(outcome)).toEqual(StationId.of('station_2'));
    expect(outcome.kind !== 'nothing' && outcome.line.id).toEqual(LINE.id);
  });

  it('notes only what arrived while a run was in progress on the task', () => {
    const anchor = Anchor.of({ body: 'This retries forever.' });
    const outcome = reaction(handed('station_1'), commented, anchor);

    expect(outcome.kind === 'deferredMove' && outcome.body.value).toBe(
      'This retries forever.',
    );
    expect(outcome.kind === 'deferredMove' && outcome.anchor).toBe(anchor);
  });

  it('defers a comment with no anchor as the summary of what happened', () => {
    const outcome = reaction(handed('station_1'), commented);

    expect(outcome.kind === 'deferredMove' && outcome.body.value).toBe(
      'The pull request was commented on.',
    );
  });

  it('finishes a task whose run is working when the pull request merges', () => {
    const outcome = reaction(handed('station_2'), merged);

    expect(outcome.kind).toBe('moves');
    expect(destination(outcome)).toEqual(LINE.completed.id);
    expect(outcome.kind !== 'nothing' && outcome.line.id).toEqual(LINE.id);
    expect(outcome.kind === 'moves' && outcome.body.value).toBe(
      'The pull request was merged.',
    );
  });

  it('finishes a task whose run is working when the pull request closes unmerged', () => {
    const outcome = reaction(
      handed('station_1'),
      payloadOf(CLOSED, 'The pull request was closed without being merged.'),
    );

    expect(outcome.kind).toBe('moves');
    expect(destination(outcome)).toEqual(LINE.completed.id);
  });

  it('defers a move while the current run of the task waits on a person', () => {
    const outcome = reaction(paused('station_1'), commented);

    expect(outcome.kind).toBe('deferredMove');
    expect(destination(outcome)).toEqual(StationId.of('station_2'));
  });

  it('finishes a task whose run waits on a person when the pull request merges', () => {
    const outcome = reaction(paused('station_2'), merged);

    expect(outcome.kind).toBe('moves');
    expect(destination(outcome)).toEqual(LINE.completed.id);
    expect(outcome.kind === 'moves' && outcome.body.value).toBe(
      'The pull request was merged.',
    );
  });

  it('finishes a task whose run waits on a person when the pull request closes unmerged', () => {
    const outcome = reaction(
      paused('station_1'),
      payloadOf(CLOSED, 'The pull request was closed without being merged.'),
    );

    expect(outcome.kind).toBe('moves');
    expect(destination(outcome)).toEqual(LINE.completed.id);
  });

  it('finishes a task whose run waits on a tool approval when the pull request merges', () => {
    const asking = handed('station_2').putToAPerson(RUN, {
      line: null,
      body: TaskNoteBody.of('Approve linear.comment?'),
      at: NOW,
      voice: Voice.station(RUN),
      form: 'approval',
      approval: Approval.request(
        ApprovalSubject.toolCall(
          ToolCall.of(Tool.of('linear.comment'), ToolInputs.of({ body: 'x' })),
        ),
        StationId.of('station_2'),
        ApprovalNeeded.of('linear.comment', 'It posts publicly.'),
        null,
      ),
    });

    const outcome = reaction(asking, merged);

    expect(outcome.kind).toBe('moves');
    expect(destination(outcome)).toEqual(LINE.completed.id);
  });

  it('keeps a task where the rule names the station it is at, run or no run', () => {
    const anchor = Anchor.of({ body: 'Pin it to a version.' });

    expect(reaction(taskAt('station_2'), commented, anchor).kind).toBe('stays');
    expect(reaction(handed('station_2'), commented, anchor).kind).toBe('stays');
  });

  it('says nothing to a task that has landed at the end of the line', () => {
    expect(reaction(landedAt('station_3'), merged).kind).toBe('nothing');
  });
});

describe('ReactionFor.happened with a close that releases a held move', () => {
  const STEPPED = lineMapOf({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: LINE.stations,
    reactions: [
      Reaction.of({
        happening: MERGED,
        from: StationId.of('station_1'),
        to: StationId.of('station_2'),
      }),
      Reaction.of({
        happening: MERGED,
        from: StationId.of('station_2'),
        to: StationId.of('station_3'),
      }),
    ],
  });
  const onLine = { line: STEPPED, ranksAtHeldMove: [] };
  const stepped = (task: Task, payload: HappeningPayload) =>
    ReactionFor.happened({ task, line: STEPPED, payload, anchor: null });
  const reacted = (task: Task, payload: HappeningPayload) =>
    task.reactTo(stepped(task, payload), ON) ?? task;
  const heldByApi = (task: Task) =>
    reacted(task, mergedOf(API)).pullRequestClosed(API, NOW, onLine);

  it('keeps a task in place when the close event of the last pull request released the move before its happening', () => {
    const released = heldByApi(openedTwo()).pullRequestClosed(
      DOCS,
      NOW,
      onLine,
    );

    expect(released.stationId.value).toBe('station_2');
    expect(stepped(released, mergedOf(DOCS)).kind).toBe('stays');
    expect(reacted(released, mergedOf(DOCS)).stationId.value).toBe('station_2');
  });

  it('moves a task once when the happening of the last pull request comes before its close event', () => {
    const routed = reacted(heldByApi(openedTwo()), mergedOf(DOCS));
    const closed = routed.pullRequestClosed(DOCS, NOW, onLine);

    expect(routed.stationId.value).toBe('station_2');
    expect(closed.stationId.value).toBe('station_2');
    expect(closed.moveHeldTo).toBeNull();
    expect(stepped(closed, mergedOf(DOCS)).kind).toBe('stays');
  });

  it('defers the move of a working task once when the happening of the last pull request comes first', () => {
    const working = Task.rehydrate({
      ...openedTwo().assignRun(RUN, LINE),
      ownedPullRequests: [
        OwnedPullRequest.of(API, NOW),
        OwnedPullRequest.of(DOCS, NOW),
      ],
    });
    const deferred = reacted(heldByApi(working), mergedOf(DOCS));
    const closed = deferred.pullRequestClosed(DOCS, NOW, onLine);

    expect(deferred.deferredMoveTo?.value).toBe('station_2');
    expect(deferred.moveHeldTo).toBeNull();
    expect(closed.notes).toHaveLength(deferred.notes.length);
  });

  it('routes the close of a pull request again once it reopens', () => {
    const released = heldByApi(openedTwo()).pullRequestClosed(
      DOCS,
      NOW,
      onLine,
    );

    expect(released.pullRequestReopened(DOCS).routedCloseOf(DOCS)).toBe(false);
  });
});

describe('ReactionFor.happened with two pull requests, whatever order their closes arrive in', () => {
  const ORDERED = lineMapOf({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: LINE.stations,
    reactions: [
      Reaction.of({
        happening: CLOSED,
        from: null,
        to: StationId.of('station_2'),
      }),
      Reaction.of({
        happening: MERGED,
        from: null,
        to: StationId.of('station_3'),
      }),
    ],
  });
  const closedUnmergedOf = (url: PullRequestUrl): HappeningPayload => ({
    ...payloadOf(CLOSED, 'The pull request was closed.'),
    closedPullRequest: url,
  });

  type Arrival = (task: Task) => Task;
  const happens =
    (payload: HappeningPayload): Arrival =>
    (task) =>
      task.reactTo(
        ReactionFor.happened({ task, line: ORDERED, payload, anchor: null }),
        ON,
      ) ?? task;
  const closes =
    (url: PullRequestUrl): Arrival =>
    (task) =>
      task.pullRequestClosed(url, NOW, { line: ORDERED, ranksAtHeldMove: [] });
  const reopens =
    (url: PullRequestUrl): Arrival =>
    (task) =>
      task.pullRequestReopened(url);
  const opens =
    (url: PullRequestUrl): Arrival =>
    (task) =>
      Task.rehydrate({
        ...task,
        ownedPullRequests: [
          ...task.ownedPullRequests,
          OwnedPullRequest.of(url, NOW),
        ],
      });

  const hA = happens(closedUnmergedOf(API));
  const hB = happens(mergedOf(DOCS));
  const cA = closes(API);
  const cB = closes(DOCS);

  const walk = (start: Task, arrivals: readonly Arrival[]) => {
    const trail: { station: string; held: string | null }[] = [];
    const end = arrivals.reduce((task, arrive) => {
      const next = Task.rehydrate({ ...arrive(task) });
      trail.push({
        station: next.stationId.value,
        held: next.moveHeldTo?.value ?? null,
      });
      return next;
    }, start);

    return {
      end,
      stations: trail.map((each) => each.station),
      held: trail.map((each) => each.held),
    };
  };

  it('moves on the later happening when both happenings come before both close events', () => {
    const { stations, held } = walk(openedTwo(), [hA, hB, cB, cA]);

    expect(stations).toEqual([
      'station_1',
      'station_3',
      'station_3',
      'station_3',
    ]);
    expect(held).toEqual(['station_2', null, null, null]);
  });

  it('releases the held move with the last close event when the first close event comes before its happening', () => {
    const { stations, held } = walk(openedTwo(), [cA, hA, cB, hB]);

    expect(stations).toEqual([
      'station_1',
      'station_1',
      'station_2',
      'station_2',
    ]);
    expect(held).toEqual([null, 'station_2', null, null]);
  });

  it('moves on the second happening when the first pull request closes fully before it', () => {
    const { stations, held } = walk(openedTwo(), [hA, cA, hB, cB]);

    expect(stations).toEqual([
      'station_1',
      'station_1',
      'station_3',
      'station_3',
    ]);
    expect(held).toEqual(['station_2', 'station_2', null, null]);
  });

  it('moves on the happening of a pull request opened after the routed close of another, whose close event comes later', () => {
    const one = Task.rehydrate({
      ...taskAt('station_1'),
      ownedPullRequests: [OwnedPullRequest.of(API, NOW)],
    });
    const { stations, held } = walk(one, [hA, opens(DOCS), hB, cB, cA]);

    expect(stations).toEqual([
      'station_2',
      'station_2',
      'station_3',
      'station_3',
      'station_3',
    ]);
    expect(held).toEqual([null, null, null, null, null]);
  });

  it('routes the close of a pull request again when it reopens after its close was routed and before its close event', () => {
    const one = Task.rehydrate({
      ...taskAt('station_1'),
      ownedPullRequests: [OwnedPullRequest.of(API, NOW)],
    });
    const { stations } = walk(one, [
      hA,
      reopens(API),
      happens(mergedOf(API)),
      cA,
    ]);

    expect(stations).toEqual([
      'station_2',
      'station_2',
      'station_3',
      'station_3',
    ]);
  });

  it('releases the held move with the last close event when a happening never arrives', () => {
    const { stations, held } = walk(openedTwo(), [hA, cA, cB]);

    expect(stations).toEqual(['station_1', 'station_1', 'station_2']);
    expect(held).toEqual(['station_2', 'station_2', null]);
  });

  it('holds nothing when no close event arrives', () => {
    const { stations, held } = walk(openedTwo(), [hA, hB]);

    expect(stations).toEqual(['station_1', 'station_3']);
    expect(held).toEqual(['station_2', null]);
  });

  it('moves once when a close event comes before both happenings', () => {
    const { stations, held } = walk(openedTwo(), [cB, hA, hB]);

    expect(stations).toEqual(['station_1', 'station_2', 'station_2']);
    expect(held).toEqual([null, null, null]);
  });

  it('moves once with three pull requests when a close event releases the hold before a late happening', () => {
    const WEB = PullRequestUrl.of('https://github.com/acme/web/pull/5');
    const three = Task.rehydrate({
      ...taskAt('station_1'),
      ownedPullRequests: [
        OwnedPullRequest.of(API, NOW),
        OwnedPullRequest.of(DOCS, NOW),
        OwnedPullRequest.of(WEB, NOW),
      ],
    });
    const { stations } = walk(three, [
      hA,
      closes(WEB),
      cB,
      happens(mergedOf(WEB)),
      hB,
      cA,
    ]);

    expect(stations).toEqual([
      'station_1',
      'station_1',
      'station_2',
      'station_2',
      'station_2',
      'station_2',
    ]);
  });

  it('routes a repeated happening of a held close no further', () => {
    const { stations, held } = walk(openedTwo(), [hA, hA, cA, cB]);

    expect(stations).toEqual([
      'station_1',
      'station_1',
      'station_1',
      'station_2',
    ]);
    expect(held).toEqual(['station_2', 'station_2', 'station_2', null]);
  });
});
