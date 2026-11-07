import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
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
import { TurnDecision } from '@work/domain/services/turn-decision';
import { ApprovalNeeded } from '@work/domain/value-objects/approval-needed.vo';
import { ApprovalSubject } from '@work/domain/value-objects/approval-subject.vo';
import { Handover } from '@work/domain/value-objects/handover.vo';
import {
  lineMapOf,
  type RepositorySpec,
  repositoryOf,
  routesOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { NotePosition } from '@work/domain/value-objects/note-position.vo';
import { RunOutcome } from '@work/domain/value-objects/run-outcome.vo';
import { TaskNoteBody } from '@work/domain/value-objects/task-note-body.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { ToolCall } from '@work/domain/value-objects/tool-call.vo';
import { ToolInputs } from '@work/domain/value-objects/tool-inputs.vo';
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-29T09:00:00.000Z');
const RUN = RunId.of('run_1');
const BUILD = StationId.of('station_build');
const SHIP = StationId.of('station_ship');

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

const lineWith = (repositories: readonly RepositorySpec[]) =>
  lineMapOf({
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
        routes: routesOf({ stations: [SHIP] }),
      }),
      station(SHIP, 'ship', 2, { harness: HarnessId.of('dev') }),
      station(StationId.of('station_completed'), 'completed', 3, {
        kind: 'completed',
      }),
    ],
    repositories,
  });

const line = lineWith([]);

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
      line: null,
      body: TaskNoteBody.of('Approve?'),
      at: NOW,
      voice: Voice.station(RUN),
    },
    RUN,
    null,
  ).task;

const CLEAN = RunOutcome.of({ exitCode: 0, failed: false });

const deciding = (input: {
  task?: Task;
  outcome?: RunOutcome;
  handover?: { next?: string; note?: string } | null;
  stopRequested?: boolean;
  on?: LineMap;
}) =>
  TurnDecision.after({
    task: input.task ?? handed(),
    line: input.on ?? line,
    outcome: input.outcome ?? CLEAN,
    handover:
      input.handover === null
        ? null
        : Handover.of(
            input.handover ?? { next: 'review', note: 'Which queue?' },
          ),
    lastWords: null,
    stopRequested: input.stopRequested ?? false,
  });

describe('TurnDecision', () => {
  it('keeps a turn that hands the task over for review, so the task is put to a person', () => {
    const decision = deciding({});

    expect(decision.kind).toBe('keep');
    expect(decision.kind === 'keep' && decision.handover.body.value).toBe(
      'Which queue?',
    );
  });

  it('keeps a turn that ends without a handover to a station, or names a station it cannot pass to', () => {
    expect(deciding({ handover: null }).kind).toBe('keep');
    expect(deciding({ handover: { next: 'nowhere' } }).kind).toBe('keep');
  });

  it('keeps a turn after a tool approval was put to a person', () => {
    expect(
      deciding({ task: approvalAsked(), handover: { next: 'ship' } }).kind,
    ).toBe('keep');
  });

  it('resumes at once, to read them, when messages came in during the turn', () => {
    const answered = approvalAsked().answer(NotePosition.of(0), {
      line: null,
      body: TaskNoteBody.of('Yes.'),
      at: NOW,
      voice: Voice.person(UserId.of('user_1')),
    });

    expect(deciding({ task: answered }).kind).toBe('resume');
  });

  it('checks out the repositories its line gained when it resumes at once', () => {
    const answered = approvalAsked().answer(NotePosition.of(0), {
      line: null,
      body: TaskNoteBody.of('Yes.'),
      at: NOW,
      voice: Voice.person(UserId.of('user_1')),
    });
    const grown = lineWith([repositoryOf(Repository.of('acme/widgets'))]);
    const decision = deciding({ task: answered, on: grown });

    expect(
      decision.kind === 'resume' && decision.checkouts.map((each) => each.path),
    ).toEqual(['widgets']);
  });

  it('routes a turn that passes the task on', () => {
    expect(deciding({ handover: { next: 'ship' } }).kind).toBe('route');
  });

  it('routes a turn that failed or was stopped', () => {
    expect(
      deciding({ outcome: RunOutcome.of({ exitCode: 1, failed: true }) }).kind,
    ).toBe('route');
    expect(deciding({ outcome: RunOutcome.stopped(130) }).kind).toBe('route');
  });

  it('routes, asking nobody, a turn whose run a person asked to stop', () => {
    expect(deciding({ stopRequested: true }).kind).toBe('route');
  });
});
