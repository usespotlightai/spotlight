import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { RunPaused } from '@work/domain/events/run-paused.event';
import { turnEnded } from '@work/domain/services/turn-end';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { Handover } from '@work/domain/value-objects/handover.vo';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
import { HarnessSession } from '@work/domain/value-objects/harness-session.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { LineRepositoryConfig } from '@work/domain/value-objects/line-repository-config.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { RunSubject } from '@work/domain/value-objects/run-subject.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationConfig } from '@work/domain/value-objects/station-config.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { StationRoutes } from '@work/domain/value-objects/station-routes.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const REPLAYED_AS = StationConfig.rehydrate(
  {
    prompt: null,
    harness: 'dev',
    model: null,
    effort: null,
    profile: null,
    image: null,
    repositories: [],
    skills: [],
    tools: [],
    decisions: false,
    memories: false,
  },
  'f'.repeat(64),
);

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

const lineWith = (repositories: readonly LineRepositoryConfig[]) =>
  Line.rehydrate({
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
        routes: StationRoutes.of({ stations: [SHIP] }),
      }),
      station(SHIP, 'ship', 2, { harness: HarnessId.of('dev') }),
      station(StationId.of('station_completed'), 'completed', 3, {
        kind: 'completed',
      }),
    ],
    repositories,
  });

const line = lineWith([]);

const run = () =>
  Run.enqueue({
    id: RUN,
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('dev'),
    spec: RunSpec.of({
      command: { executable: 'sh', args: [] },
      briefing: 'Fix the queue.',
      handover: { options: [], noteLimit: 0 },
      resume: { key: 'task_1:station_build' },
    }),
  }).claim(RUNNER, NOW);

const handed = () =>
  Task.add({
    line,
    at: BUILD,
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    createdBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  }).assignRun(RUN, line);

const approvalAsked = () =>
  handed().clearFor(
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
    null,
  ).task;

const CLEAN = RunOutcome.of({ exitCode: 0, failed: false });

const ending = (input: {
  task?: Task | null;
  outcome?: RunOutcome;
  handover?: { next?: string; note?: string } | null;
  ran?: Run;
  on?: Line;
}) =>
  turnEnded({
    run: input.ran ?? run(),
    by: RUNNER,
    task: input.task === undefined ? handed() : input.task,
    line: input.on ?? line,
    outcome: input.outcome ?? CLEAN,
    report: HandoverReport.of({
      handover: input.handover ? Handover.of(input.handover) : null,
      session: HarnessSession.of('session_1'),
    }),
    now: NOW,
  });

const asks = (ended: ReturnType<typeof ending>) =>
  ended.run.state === 'suspended';

describe('turnEnded', () => {
  it('suspends a turn that hands the task over for review, putting the task to a person in the same stroke', () => {
    const ended = ending({ handover: { next: 'review', note: 'Which?' } });

    expect(ended.run.state).toBe('suspended');
    expect(ended.run.claimedBy).toBeNull();
    expect(ended.task?.awaitingReview).toBe(true);
    expect(ended.task?.hasCurrentRun(RUN)).toBe(true);
    expect(ended.task?.sessionId?.value).toBe('session_1');
    expect(ended.task?.notes[0]?.body.value).toBe('Which?');
  });

  it('suspends a turn that ends without a handover to a station, or names a station it cannot pass to', () => {
    expect(asks(ending({ handover: null }))).toBe(true);
    expect(asks(ending({ handover: { next: 'nowhere' } }))).toBe(true);
  });

  it('suspends after a tool approval or harness permission was put to a person, asking nothing more', () => {
    const ended = ending({ task: approvalAsked(), handover: { next: 'ship' } });

    expect(ended.run.state).toBe('suspended');
    expect(ended.task?.notes).toHaveLength(1);
  });

  it('puts the run back on the queue at once, to resume its session, when the person answered before the turn was reported', () => {
    const answered = approvalAsked().answer(NotePosition.of(0), {
      station: StationName.of('build'),
      body: TaskNoteBody.of('Yes.'),
      at: NOW,
      voice: Voice.person(UserId.of('user_1')),
    });

    const ended = ending({ task: answered });

    expect(ended.task).toBeNull();
    expect(ended.run.state).toBe('queued');
    expect(ended.run.attempt).toBe(2);
    expect(ended.run.spec.resumesSession).toBe(true);
    expect(
      ended.run
        .pullEvents()
        .find((event): event is RunPaused => event instanceof RunPaused)
        ?.resumesAtOnce,
    ).toBe(true);
  });

  it('checks out the repositories its line gained when it puts the run back on the queue at once', () => {
    const answered = approvalAsked().answer(NotePosition.of(0), {
      station: StationName.of('build'),
      body: TaskNoteBody.of('Yes.'),
      at: NOW,
      voice: Voice.person(UserId.of('user_1')),
    });

    const ended = ending({
      task: answered,
      on: lineWith([LineRepositoryConfig.of(Repository.of('acme/widgets'))]),
    });

    expect(ended.run.spec.checkoutFolders).toEqual(['widgets']);
  });

  it('says the run waits for a person when no answer came in during the turn', () => {
    const ended = ending({ task: approvalAsked(), handover: { next: 'ship' } });

    expect(
      ended.run
        .pullEvents()
        .find((event): event is RunPaused => event instanceof RunPaused)
        ?.resumesAtOnce,
    ).toBe(false);
  });

  it('refuses a repeated report of a turn whose run it suspended', () => {
    const suspended = run().suspend(RUNNER, CLEAN, HandoverReport.none(), NOW);

    expect(() =>
      ending({ ran: suspended, handover: { next: 'review' } }),
    ).toThrow();
  });

  it('ends a turn that passes the task on', () => {
    const ended = ending({ handover: { next: 'ship' } });

    expect(ended.run.state).toBe('completed');
    expect(ended.task).toBeNull();
  });

  it('ends a turn that failed or was stopped', () => {
    expect(
      ending({
        outcome: RunOutcome.of({ exitCode: 1, failed: true }),
        handover: { next: 'review' },
      }).run.state,
    ).toBe('failed');
    expect(
      asks(
        ending({
          outcome: RunOutcome.stopped(130),
          handover: { next: 'review' },
        }),
      ),
    ).toBe(false);
  });

  it('ends a turn once a person requested the run to stop', () => {
    expect(
      asks(
        ending({ ran: run().requestStop(NOW), handover: { next: 'review' } }),
      ),
    ).toBe(false);
  });

  it('ends a turn whose task has moved on, or that works no task', () => {
    expect(
      asks(
        ending({
          task: handed().leaveRun(RUN, NOW),
          handover: { next: 'review' },
        }),
      ),
    ).toBe(false);
    expect(asks(ending({ task: null, handover: { next: 'review' } }))).toBe(
      false,
    );
  });
});

describe('the end of a replay’s turn', () => {
  const COMMIT = 'a'.repeat(40);
  const replay = () =>
    Run.enqueue({
      id: RUN,
      workspaceId: WorkspaceId.of('ws_1'),
      harness: HarnessId.of('dev'),
      configuredAs: REPLAYED_AS,
      subject: RunSubject.replay(
        RunId.of('run_0'),
        TaskId.of('task_1'),
        BUILD,
        TeamId.of('team_1'),
      ),
      spec: RunSpec.of({
        checkouts: [
          { remote: 'spotlight:repository', path: 'api', ref: COMMIT },
        ],
        command: { executable: 'sh', args: [] },
        briefing: 'Fix the queue.',
        handover: { options: ['ship', 'review'], noteLimit: 0 },
        resume: { key: 'replay-run_1' },
        replay: {
          archive: null,
          checkouts: [{ path: 'api', commit: COMMIT, repository: 'acme/api' }],
          movesOnAfter: ['ship'],
        },
      }),
    }).claim(RUNNER, NOW);

  const ended = (
    next: string | null,
    outcome = RunOutcome.of({ exitCode: 0, failed: false }),
  ) =>
    turnEnded({
      run: replay(),
      by: RUNNER,
      task: null,
      line,
      outcome,
      report: HandoverReport.of({
        handover: next === null ? null : Handover.of({ next }),
        session: null,
      }),
      now: NOW,
    });

  it('ends without being suspended, and without touching a task', () => {
    const turn = ended('ship');

    expect(turn.task).toBeNull();
    expect(turn.run.hasCompleted).toBe(true);
    expect(turn.run.askedAPerson).toBe(false);
  });

  it('records that it asked a person where its handover would have put the work to one', () => {
    for (const next of ['review', null, 'nowhere', 'done']) {
      const turn = ended(next);

      expect(turn.run.hasCompleted).toBe(true);
      expect(turn.run.askedAPerson).toBe(true);
    }
  });

  it('asked nobody when it failed or was stopped', () => {
    expect(
      ended('review', RunOutcome.of({ exitCode: 1, failed: true })).run
        .askedAPerson,
    ).toBe(false);
    expect(ended('review', RunOutcome.stopped(130)).run.askedAPerson).toBe(
      false,
    );
  });
});
