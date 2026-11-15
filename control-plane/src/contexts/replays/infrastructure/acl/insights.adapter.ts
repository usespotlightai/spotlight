import type {
  RunAcceptancePort,
  RunDisposition,
} from '@insights/application/ports/run-acceptance.port';
import type {
  PublishedCalibration,
  StationJudgeCalibrationsPort,
} from '@insights/application/ports/station-judge-calibrations.port';
import type {
  CalibratedJudge,
  InsightsPort,
} from '@replays/application/ports/insights.port';
import type { OriginalOutcome } from '@replays/domain/services/composition';
import { JudgeCalibration } from '@replays/domain/value-objects/judge-calibration';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const outcomeOf = (disposition: RunDisposition): OriginalOutcome => {
  switch (disposition) {
    case 'accepted':
      return 'accepted';
    case 'sent-back':
      return 'sent-back';
    case 'asked':
      return 'asked';
    case 'failed':
      return 'failed';
    case 'other':
      return 'other';
  }
};

const calibrationOf = (published: PublishedCalibration): JudgeCalibration =>
  JudgeCalibration.of({
    state: published.state,
    agreement: published.agreement,
    pairs: published.pairs,
    minPairs: published.minPairs,
    minAgreement: published.minAgreement,
  });

export class Insights implements InsightsPort {
  constructor(
    private readonly acceptance: RunAcceptancePort,
    private readonly calibrations: StationJudgeCalibrationsPort,
  ) {}

  acceptedAfter(run: RunId): Promise<boolean> {
    return this.acceptance.acceptedAfter(run.value);
  }

  async originalOutcomes(
    runs: readonly RunId[],
  ): Promise<ReadonlyMap<string, OriginalOutcome>> {
    const dispositions = await this.acceptance.dispositions(
      runs.map((each) => each.value),
    );

    return new Map(
      [...dispositions].map(([run, disposition]) => [
        run,
        outcomeOf(disposition),
      ]),
    );
  }

  async judgeCalibration(
    judge: CalibratedJudge,
  ): Promise<JudgeCalibration | null> {
    const published = await this.calibrations.calibrationOf({
      workspaceId: judge.workspaceId.value,
      teamId: judge.teamId.value,
      lineId: judge.lineId.value,
      stationId: judge.stationId.value,
      rubricVersion: judge.rubricVersion,
    });

    return published && calibrationOf(published);
  }
}
