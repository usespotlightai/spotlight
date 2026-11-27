import { StationJudgeCalibrations } from '@insights/application/services/station-judge-calibrations.service';
import type { CurrentCalibration } from '@insights/application/services/station-judge-reports.service';
import type { JudgeCalibration } from '@insights/domain/services/judge-calibration';
import {
  NEXT_RUBRIC_VERSION,
  RUBRIC_VERSION,
} from '@insights/judging.fake-spec';
import { describe, expect, it } from 'vitest';

const STATION = {
  workspaceId: 'workspace_1',
  teamId: 'team_1',
  lineId: 'line_1',
  stationId: 'station_1',
  rubricVersion: RUBRIC_VERSION,
};

const calibrated = (
  calibration: Partial<JudgeCalibration>,
  rubricVersion: CurrentCalibration['rubricVersion'] = RUBRIC_VERSION,
) =>
  new StationJudgeCalibrations({
    calibrationAt: async () => ({
      rubricVersion,
      rubric: null,
      calibration: {
        qualified: false,
        agreement: null,
        pairs: 0,
        minAgreement: 0.6,
        hiddenReason: null,
        ...calibration,
      },
    }),
  });

describe('StationJudgeCalibrations', () => {
  it('says a judge that agrees with people well enough is qualified', async () => {
    await expect(
      calibrated({
        qualified: true,
        agreement: 0.8,
        pairs: 12,
      }).calibrationOf(STATION),
    ).resolves.toEqual({
      state: 'qualified',
      agreement: 0.8,
      pairs: 12,
      minPairs: 10,
      minAgreement: 0.6,
    });
  });

  it.each(['below-min-agreement', 'unreadable-rubric'] as const)(
    'says a judge hidden as %s is failing',
    async (hiddenReason) => {
      await expect(
        calibrated({ hiddenReason, pairs: 12 }).calibrationOf(STATION),
      ).resolves.toMatchObject({ state: 'failing' });
    },
  );

  it('says a judge whose pairs all have one verdict is unmeasured, not failing', async () => {
    await expect(
      calibrated({ hiddenReason: 'no-agreement', pairs: 12 }).calibrationOf(
        STATION,
      ),
    ).resolves.toMatchObject({ state: 'unmeasured', pairs: 12 });
  });

  it('says a judge with too few pairs is unmeasured', async () => {
    await expect(
      calibrated({ hiddenReason: 'too-few-pairs', pairs: 4 }).calibrationOf(
        STATION,
      ),
    ).resolves.toMatchObject({ state: 'unmeasured', pairs: 4 });
  });

  it('says a judge of another rubric version is unmeasured for this one', async () => {
    await expect(
      calibrated(
        { qualified: true, agreement: 0.9, pairs: 30 },
        NEXT_RUBRIC_VERSION,
      ).calibrationOf(STATION),
    ).resolves.toEqual({
      state: 'unmeasured',
      agreement: null,
      pairs: 0,
      minPairs: 10,
      minAgreement: 0.6,
    });
  });

  it('answers nothing for a station with no judge', async () => {
    await expect(
      calibrated({
        hiddenReason: 'no-judge',
        minAgreement: null,
      }).calibrationOf(STATION),
    ).resolves.toBeNull();
  });
});
