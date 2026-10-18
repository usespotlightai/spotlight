import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { PausedRuns } from '@work/application/services/paused-runs.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import { Run } from '@work/domain/aggregates/run.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import { RunVersionConflictError } from '@work/domain/exceptions/run-version-conflict.error';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { HandoverReport } from '@work/domain/value-objects/handover-report.vo';
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
import { Voice } from '@work/domain/value-objects/voice.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-29T09:00:00.000Z');
const RUN = RunId.of('run_1');
const RUNNER = RunnerId.of('runner_1');
const BUILD = StationId.of('station_build');

const station = (
  id: string,
  key: string,
  position: number,
  extra: Partial<Parameters<typeof Station.of>[0]> = {},
) =>
  Station.of({
    id: StationId.of(id),
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
    station('station_backlog', 'backlog', 0, { kind: 'backlog' }),
    station('station_build', 'build', 1, { harness: HarnessId.of('dev') }),
    station('station_completed', 'completed', 2, { kind: 'completed' }),
  ],
});

const note = (body: string, voice: Voice) => ({
  station: StationName.of('build'),
  body: TaskNoteBody.of(body),
  at: NOW,
  voice,
});

const asked = () =>
  Task.add({
    line,
    at: BUILD,
    title: TaskTitle.of('Fix the queue'),
    rank: TaskRank.of('i'),
    createdBy: UserId.of('user_1'),
    now: NOW,
    newId: () => 'task_1',
  })
    .assignRun(RUN, line)
    .putToAPerson(RUN, note('Which queue?', Voice.station(RUN)));

const answered = () =>
  asked().answer(
    NotePosition.of(0),
    note('The default one.', Voice.person(UserId.of('user_1'))),
  );

const waiting = () =>
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
  })
    .claim(RUNNER, NOW)
    .paused(
      RUNNER,
      RunOutcome.of({ exitCode: 0, failed: false }),
      HandoverReport.none(),
      NOW,
    );

const taking = (task: Task, run: Run | null, conflictsFirst = false) => {
  const saved: Run[] = [];
  let reads = 0;
  let conflicted = !conflictsFirst;

  const paused = new PausedRuns(
    { find: async () => task } as unknown as TaskRepository,
    {
      findById: async () =>
        reads++ > 0 && conflictsFirst ? run?.suspend(RUNNER, NOW) : run,
      save: async (each: Run) => {
        if (!conflicted) {
          conflicted = true;
          throw new RunVersionConflictError(each.id.value);
        }
        saved.push(each);
      },
    } as unknown as RunRepository,
  );

  return {
    saved,
    takeUp: () =>
      paused.onTaskAnswered(
        new TaskAnswered(TaskId.of('task_1'), WorkspaceId.of('ws_1'), RUN),
      ),
  };
};

describe('PausedRuns', () => {
  it('takes a run waiting warm up again once its person has answered', async () => {
    const { takeUp, saved } = taking(answered(), waiting());

    await takeUp();

    expect(saved[0]?.state).toBe('claimed');
    expect(saved[0]?.attempt).toBe(1);
  });

  it('requeues a suspended run as its next attempt once its person has answered', async () => {
    const { takeUp, saved } = taking(
      answered(),
      waiting().suspend(RUNNER, NOW),
    );

    await takeUp();

    expect(saved[0]?.state).toBe('queued');
    expect(saved[0]?.attempt).toBe(2);
  });

  it('requeues from the archive when the run was suspended while it was being taken up', async () => {
    const { takeUp, saved } = taking(answered(), waiting(), true);

    await takeUp();

    expect(saved[0]?.state).toBe('queued');
  });

  it('leaves the run waiting while an answer from the person is still pending', async () => {
    const { takeUp, saved } = taking(asked(), waiting());

    await takeUp();

    expect(saved).toEqual([]);
  });

  it('leaves a run that is no longer the current run of its task, or one with a stop request, alone', async () => {
    const moved = taking(answered().leaveRun(RUN, NOW), waiting());
    const stopping = taking(answered(), waiting().requestStop(NOW));

    await moved.takeUp();
    await stopping.takeUp();

    expect(moved.saved).toEqual([]);
    expect(stopping.saved).toEqual([]);
  });
});
