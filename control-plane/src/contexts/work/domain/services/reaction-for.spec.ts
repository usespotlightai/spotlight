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
import { LaterPullRequest } from '@work/domain/value-objects/later-pull-request.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { PullRequestLink } from '@work/domain/value-objects/pull-request-link.vo';
import { Reaction } from '@work/domain/value-objects/reaction.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

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
    pullRequestLink: PullRequestLink.opened(API),
    laterPullRequests: [LaterPullRequest.of(DOCS, NOW)],
  });

const mergedOf = (url: PullRequestUrl): HappeningPayload => ({
  ...merged,
  closedPullRequest: url,
});

describe('ReactionFor.happened', () => {
  it('keeps a task with another pull request still open where it is, with a note', () => {
    const outcome = reaction(
      openedTwo().pullRequestClosed(API, NOW),
      mergedOf(API),
    );

    expect(outcome.kind).toBe('stays');
  });

  it('moves a task once the last of its pull requests merges after another closed unmerged', () => {
    const outcome = reaction(
      openedTwo().pullRequestClosed(API, NOW).pullRequestClosed(DOCS, NOW),
      mergedOf(DOCS),
    );

    expect(outcome.kind).toBe('moves');
  });

  it('moves a task once the last of its pull requests merges', () => {
    const outcome = reaction(
      openedTwo().pullRequestClosed(API, NOW).pullRequestClosed(DOCS, NOW),
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

  it('notes what arrived while a run was in progress on the task, and where it moves once the run ends', () => {
    const anchor = Anchor.of({ body: 'This retries forever.' });
    const outcome = reaction(handed('station_1'), commented, anchor);

    expect(outcome.kind === 'deferredMove' && outcome.body.value).toBe(
      'This arrived while a run was in progress on the task. If the run does not pass the task on, the task moves to Code Review when the run ends.\n\nThis retries forever.',
    );
    expect(outcome.kind === 'deferredMove' && outcome.anchor).toBe(anchor);
  });

  it('defers a comment with no anchor as the summary of what happened', () => {
    const outcome = reaction(handed('station_1'), commented);

    expect(outcome.kind === 'deferredMove' && outcome.body.value).toContain(
      'moves to Code Review when the run ends.\n\nThe pull request was commented on.',
    );
  });

  it('interrupts the run and puts it to a person where a merge would finish a task that has a current run', () => {
    const outcome = reaction(handed('station_2'), merged);

    expect(outcome.kind).toBe('interrupts');
    expect(outcome.kind !== 'nothing' && outcome.line.id).toEqual(LINE.id);
    expect(outcome.kind === 'interrupts' && outcome.body.value).toBe(
      'The pull request was merged while Code Review was working. Close the task, or reply to carry on.',
    );
  });

  it('says what closed the pull request when it interrupts a run', () => {
    const outcome = reaction(
      handed('station_1'),
      payloadOf(CLOSED, 'The pull request was closed without being merged.'),
    );

    expect(outcome.kind === 'interrupts' && outcome.body.value).toBe(
      'The pull request was closed without being merged while Implementation was working. Close the task, or reply to carry on.',
    );
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

  it('says the station was working where the task awaits only a tool approval', () => {
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

    expect(outcome.kind === 'interrupts' && outcome.body.value).toBe(
      'The pull request was merged while Code Review was working. Close the task, or reply to carry on.',
    );
  });

  it('names no station of the line when the task a merge interrupts is on none of it', () => {
    const elsewhere = lineMapOf({
      id: LineId.of('line_9'),
      workspaceId: WorkspaceId.of('ws_1'),
      teamId: TeamId.of('team_1'),
      key: LineKey.of('elsewhere'),
      name: LineName.of('Elsewhere'),
      stations: [
        at('station_8', 'Backlog', 0, 'backlog'),
        at('station_9', 'Triage', 1),
        at('station_10', 'Completed', 2, 'completed'),
      ],
    });
    const task = Task.add({
      line: elsewhere,
      at: StationId.of('station_9'),
      title: TaskTitle.of('Retry uploads'),
      rank: TaskRank.of('i'),
      now: NOW,
      newId: () => 'task_9',
    }).assignRun(RUN, elsewhere);

    const outcome = reaction(task, merged);

    expect(outcome.kind === 'interrupts' && outcome.body.value).toBe(
      'The pull request was merged while its station was working. Close the task, or reply to carry on.',
    );
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
