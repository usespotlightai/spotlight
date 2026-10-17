import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { StationConfigMapper } from '@work/application/mappers/station-config.mapper';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import type { RunOrder } from '@work/domain/services/run-order';
import { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';
import { StationAlert } from '@work/domain/value-objects/station-alert.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationJudge } from '@work/domain/value-objects/station-judge.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { Sha256ContentDigest } from '@work/infrastructure/hashing/sha256-content-digest';
import { describe, expect, it } from 'vitest';

const DIGEST = new Sha256ContentDigest();

const LINE = {
  image: null,
  repositories: LineRepositories.none(),
} as unknown as Line;

const ORDER = {
  harness: { id: HarnessId.of('claude-code') },
  model: null,
  effort: null,
  enabled: { profile: null, tools: [] },
} as unknown as RunOrder;

const RUBRIC = 'A good run changes only what the task requests.\n';

const station = (
  over: Partial<Parameters<typeof Station.of>[0]> = {},
): Station =>
  Station.of({
    id: StationId.of('station_1'),
    key: StationKey.of('implementation'),
    name: StationName.of('Implementation'),
    position: 1,
    color: StationColor.plain(),
    ...over,
  });

const configured = (at: Station) =>
  StationConfigMapper.configuredAs(
    { station: at, line: LINE, order: ORDER, folders: [] },
    DIGEST,
  );

describe('StationConfigMapper', () => {
  it('keeps alerts out of the fingerprint', () => {
    const alerted = station({
      alerts: [
        StationAlert.of({ measure: 'cost_per_run', above: 2, over: 10 }),
      ],
    });

    expect(configured(alerted).fingerprint).toBe(
      configured(station()).fingerprint,
    );
  });

  it('configures the judge by its rubric digest, sample and trust', () => {
    const judged = station({
      judge: StationJudge.of({ rubric: RUBRIC, sample: 0.2, trust: 0.6 }),
    });

    expect(configured(judged).parts.judge).toEqual({
      rubricDigest: DIGEST.sha256(
        JSON.stringify({ rubric: RUBRIC, claims: [], passShare: 1 }),
      ),
      sample: 0.2,
      trust: 0.6,
    });
  });

  it('changes the judge’s digest when its claims or the share it passes on change', () => {
    const judgedBy = (passShare: number) =>
      configured(
        station({
          judge: StationJudge.of({
            rubric: RUBRIC,
            claims: ['It retries.'],
            passShare,
            sample: 0.2,
            trust: 0.6,
          }),
        }),
      ).parts.judge?.rubricDigest;

    expect(judgedBy(1)).not.toBe(judgedBy(0.5));
    expect(judgedBy(1)).not.toBe(
      configured(
        station({
          judge: StationJudge.of({ rubric: RUBRIC, sample: 0.2, trust: 0.6 }),
        }),
      ).parts.judge?.rubricDigest,
    );
  });

  it('configures no judge on a station without one', () => {
    expect(configured(station()).parts).not.toHaveProperty('judge');
  });
});
