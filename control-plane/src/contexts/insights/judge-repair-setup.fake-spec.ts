import { deletionsInMemory } from '@insights/application/ports/deletions.fake-spec';
import type {
  StationJudge,
  StationJudgesPort,
} from '@insights/application/ports/station-judges.port';
import { FactRecorder } from '@insights/application/services/fact-recorder.service';
import type { Score } from '@insights/domain/aggregates/score.aggregate';
import { TaskActions } from '@insights/domain/aggregates/task-actions.aggregate';
import { PersonAction } from '@insights/domain/value-objects/person-action.vo';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import { TaskAction } from '@insights/domain/value-objects/task-action.vo';
import { TaskActionsInMemory } from '@insights/insights.fake-spec';
import {
  CLAIMS,
  NEXT_RUBRIC_VERSION,
  RUBRIC_VERSION,
  ScoresInMemory,
} from '@insights/judging.fake-spec';
import {
  endedRecord,
  factOf,
  RunRecordsInMemory,
  StationFactsInMemory,
  WORKSPACE,
} from '@insights/runs.fake-spec';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const NOW = new Date('2026-10-05T10:00:00.000Z');

const ACTED_AT = new Date('2026-09-30T11:00:00.000Z');

export const ACTOR = UserId.of('user_cleo');

export const judgeOf = (
  change: { rubricVersion?: RubricVersion; claims?: readonly string[] } = {},
): StationJudge => ({
  teamId: TeamId.of('team_1'),
  lineId: LineId.of('line_1'),
  claims: change.claims ?? CLAIMS,
  passThreshold: 1,
  rubricVersion: change.rubricVersion ?? RUBRIC_VERSION,
  sample: 1,
  minAgreement: 0.5,
});

export const NEXT_JUDGE = judgeOf({
  rubricVersion: NEXT_RUBRIC_VERSION,
  claims: ['It retries the upload twice.'],
});

export const judgesWith = (
  judge: StationJudge | null = judgeOf(),
): StationJudgesPort => ({
  judgeAt: async () => judge,
  judgesOnTeam: async () => new Map(),
});

export const clockAt = (now = NOW): ClockPort => ({
  now: () => now,
  sleep: async () => {},
});

export const sequence = (prefix: string): IdGeneratorPort => {
  let next = 0;

  return {
    generate: (): string => {
      next += 1;
      return `${prefix}_${next}`;
    },
  };
};

export type Acted = 'accepted' | 'sent-back' | null;

export type StationRun = {
  readonly runId: string;
  readonly acted: Acted;
  readonly ending?: RunEnding;
  readonly scores?: readonly Score[];
};

export interface Station {
  readonly records: RunRecordsInMemory;
  readonly scores: ScoresInMemory;
  readonly taskActions: TaskActionsInMemory;
  readonly deletions: ReturnType<typeof deletionsInMemory>;
  readonly recorder: FactRecorder;
  readonly facts: StationFactsInMemory;
}

export const stationWith = async (
  runs: readonly StationRun[],
): Promise<Station> => {
  const records = new RunRecordsInMemory();
  const scores = new ScoresInMemory();
  const taskActions = new TaskActionsInMemory();

  for (const run of runs) {
    const ended = endedRecord(run.runId, {
      taskId: `task_${run.runId}`,
      ending: run.ending,
    });

    if (run.acted) {
      const { location } = factOf(ended).end;

      await taskActions.add(
        TaskActions.empty(location.taskId, WORKSPACE).recordAction(
          TaskAction.of({
            kind: run.acted,
            by: ACTOR,
            stationId: location.stationId,
            at: ACTED_AT,
          }),
        ),
      );
    }

    await records.add(
      run.acted
        ? ended.recordAction(PersonAction.of(run.acted, ACTED_AT, ACTOR))
        : ended,
    );

    for (const score of run.scores ?? []) {
      await scores.add(score);
    }
  }

  scores.events.length = 0;
  const deletions = deletionsInMemory();

  return {
    records,
    scores,
    taskActions,
    deletions,
    recorder: new FactRecorder(deletions),
    facts: new StationFactsInMemory(records, { scores }),
  };
};
