import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { turnEnded, turnWaits } from '@work/domain/services/turn-end';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { Declaration } from '@work/domain/value-objects/declaration.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { WayOut } from '@work/domain/value-objects/way-out.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-29T09:00:00.000Z');
const RUN = RunId.of('run_1');
const RUNNER = RunnerId.of('runner_1');
const BUILD = StationId.of('station_build');
const SHIP = StationId.of('station_ship');

const station = (
  id: StationId,
  key: string,
  position: number,
  extra: Partial<Parameters<typeof Station.of>[0]> = {},
) =>
  Station.of({
    id,
    key: StationKey.of(key),
    name: StationName.of(key),
    position,
    color: StationColor.plain(),
    ...extra,
  });

const line = Line.rehydrate({
  id: LineId.of('line_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    station(StationId.of('station_backlog'), 'backlog', 0, {
      kind: 'backlog',
    }),
    station(BUILD, 'build', 1, {
      harness: HarnessId.of('dev'),
      wayOut: WayOut.of({ stations: [SHIP] }),
    }),
    station(SHIP, 'ship', 2, { harness: HarnessId.of('dev') }),
    station(StationId.of('station_completed'), 'completed', 3, {
      kind: 'completed',
    }),
  ],
});

const run = () =>
  Run.enqueue({
    id: RUN,
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'Fix the queue.',
      handover: { options: [], noteLimit: 0 },
      continuity: { key: 'task_1:station_build' },
    }),
  }).claim(RUNNER, NOW);

const held = () =>
  Task.add({
    line,
    at: BUILD,
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    raisedBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  }).handedTo(RUN, line);

const approvalAsked = () =>
  held().clearFor(
    ApprovalSubject.toolCall(
      ToolCall.of(Tool.of('linear.comment'), ToolInputs.of({ body: 'x' })),
    ),
    ApprovalNeeded.of('linear.comment', 'It posts publicly.'),
    {
      station: StationName.of('build'),
      body: TaskNoteBody.of('Approve?'),
      at: NOW,
      voice: Voice.station(RUN),
    },
    RUN,
  ).task;

const CLEAN = RunOutcome.of({ exitCode: 0, failed: false });

const ending = (input: {
  task?: Task | null;
  outcome?: RunOutcome;
  declared?: { next?: string; note?: string } | null;
  ran?: Run;
  kept?: boolean;
}) =>
  turnEnded({
    run: input.ran ?? run(),
    by: RUNNER,
    task: input.task === undefined ? held() : input.task,
    line,
    outcome: input.outcome ?? CLEAN,
    report: HandoverReport.of({
      declared: input.declared ? Declaration.of(input.declared) : null,
      session: HarnessSession.of('session_1'),
    }),
    kept: input.kept ?? true,
    now: NOW,
  });

describe('turnEnded', () => {
  it('pauses a turn that hands the task over for review, putting the task to a person in the same stroke', () => {
    const ended = ending({ declared: { next: 'review', note: 'Which?' } });

    expect(ended.waiting).toBe(true);
    expect(ended.run.state).toBe('waiting');
    expect(ended.task?.awaitingReview).toBe(true);
    expect(ended.task?.heldBy(RUN)).toBe(true);
    expect(ended.task?.sessionId?.value).toBe('session_1');
    expect(ended.task?.notes[0]?.body.value).toBe('Which?');
  });

  it('pauses a turn that ends without saying where the task goes, or names a station it cannot pass to', () => {
    expect(ending({ declared: null }).waiting).toBe(true);
    expect(ending({ declared: { next: 'nowhere' } }).waiting).toBe(true);
  });

  it('pauses after a tool approval or harness permission was put to a person, asking nothing more', () => {
    const ended = ending({ task: approvalAsked(), declared: { next: 'ship' } });

    expect(ended.run.state).toBe('waiting');
    expect(ended.task?.notes).toHaveLength(1);
  });

  it('carries on at once, unchanged, when the person answered before the turn was reported', () => {
    const answered = approvalAsked().answered(NotePosition.of(0), {
      station: StationName.of('build'),
      body: TaskNoteBody.of('Yes.'),
      at: NOW,
      voice: Voice.person(UserId.of('user_1')),
    });
    const ran = run();

    const ended = ending({ task: answered, ran });

    expect(ended).toEqual({ waiting: true, run: ran, task: null });
  });

  it('answers a repeated report of a pause without changing anything', () => {
    const waiting = run().paused(RUNNER, CLEAN, HandoverReport.none(), NOW);

    expect(ending({ ran: waiting, declared: { next: 'review' } })).toEqual({
      waiting: true,
      run: waiting,
      task: null,
    });
  });

  it('ends the run as before, leaving the task to be put to the person, when its workspace was not kept', () => {
    const ended = ending({ declared: { next: 'review' }, kept: false });

    expect(ended.waiting).toBe(false);
    expect(ended.run.state).toBe('completed');
    expect(ended.task).toBeNull();
  });

  describe('whether a turn waits, asked before the runner keeps its workspace', () => {
    const turn = (
      declared: { next: string } | null,
      over: { ran?: Run; mayBeWithheld?: boolean; outcome?: RunOutcome } = {},
    ) => ({
      run: over.ran ?? run(),
      by: RUNNER,
      task: held(),
      line,
      outcome: over.outcome ?? CLEAN,
      declared: declared ? Declaration.of(declared) : null,
      mayBeWithheld: over.mayBeWithheld ?? false,
    });

    it('waits for the same turns it pauses', () => {
      expect(turnWaits(turn({ next: 'review' }))).toBe(true);
      expect(turnWaits(turn(null))).toBe(true);
      expect(turnWaits(turn({ next: 'ship' }))).toBe(false);
    });

    it('may wait where a hook could hold back the task being passed on', () => {
      expect(turnWaits(turn({ next: 'ship' }, { mayBeWithheld: true }))).toBe(
        true,
      );
    });

    it('still waits on a repeated report of a pause, unless it was stopped', () => {
      const waiting = run().paused(RUNNER, CLEAN, HandoverReport.none(), NOW);

      expect(turnWaits(turn({ next: 'ship' }, { ran: waiting }))).toBe(true);
      expect(
        turnWaits(
          turn(null, { ran: waiting, outcome: RunOutcome.stopped(130) }),
        ),
      ).toBe(false);
    });
  });

  it('ends a turn that passes the task on', () => {
    const ended = ending({ declared: { next: 'ship' } });

    expect(ended.waiting).toBe(false);
    expect(ended.run.state).toBe('completed');
    expect(ended.task).toBeNull();
  });

  it('ends a turn that failed or was stopped', () => {
    expect(
      ending({
        outcome: RunOutcome.of({ exitCode: 1, failed: true }),
        declared: { next: 'review' },
      }).run.state,
    ).toBe('failed');
    expect(
      ending({
        outcome: RunOutcome.stopped(130),
        declared: { next: 'review' },
      }).waiting,
    ).toBe(false);
  });

  it('ends a turn once a person asked the run to stop', () => {
    expect(
      ending({ ran: run().requestStop(NOW), declared: { next: 'review' } })
        .waiting,
    ).toBe(false);
  });

  it('ends a turn whose task has moved on, or that works no task', () => {
    expect(
      ending({ task: held().leftBy(RUN, NOW), declared: { next: 'review' } })
        .waiting,
    ).toBe(false);
    expect(ending({ task: null, declared: { next: 'review' } }).waiting).toBe(
      false,
    );
  });
});
