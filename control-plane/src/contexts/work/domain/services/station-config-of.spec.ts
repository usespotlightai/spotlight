import { createHash } from 'node:crypto';

import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import type { RunOrder } from '@work/domain/services/run-order';
import { stationConfigOf } from '@work/domain/services/station-config-of';
import {
  judgeOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';
import type { Station } from '@work/domain/value-objects/station.vo';
import { describe, expect, it } from 'vitest';

const sha256 = (text: string): string =>
  createHash('sha256').update(text).digest('hex');

const LINE = {
  image: null,
  repositories: LineRepositories.none(),
} as unknown as LineMap;

const ORDER = {
  harness: HarnessId.of('claude-code'),
  model: null,
  effort: null,
  enabled: { profile: null, tools: [] },
} as unknown as RunOrder;

const RUBRIC = 'A good run changes only what the task requests.\n';

const station = (
  over: Partial<Parameters<typeof stationOf>[0]> = {},
): Station =>
  stationOf({
    id: StationId.of('station_1'),
    key: StationKey.of('implementation'),
    name: StationName.of('Implementation'),
    position: 1,
    color: '#a3a8b0',
    ...over,
  });

const configured = (at: Station) =>
  stationConfigOf(
    { station: at, line: LINE, order: ORDER, folders: [] },
    sha256,
  );

describe('stationConfigOf', () => {
  it('configures the judge by its rubric hash, sample and minimum agreement', () => {
    const judged = station({
      judge: judgeOf({
        rubric: RUBRIC,
        sample: 0.2,
        minAgreement: 0.6,
      }),
    });

    expect(configured(judged).parts.judge).toEqual({
      rubricHash: sha256(
        JSON.stringify({ rubric: RUBRIC, claims: [], passThreshold: 1 }),
      ),
      sample: 0.2,
      minAgreement: 0.6,
    });
  });

  it('changes the judge’s hash when its claims or its pass threshold change', () => {
    const judgedBy = (passThreshold: number) =>
      configured(
        station({
          judge: judgeOf({
            rubric: RUBRIC,
            claims: ['It retries.'],
            passThreshold,
            sample: 0.2,
            minAgreement: 0.6,
          }),
        }),
      ).parts.judge?.rubricHash;

    expect(judgedBy(1)).not.toBe(judgedBy(0.5));
    expect(judgedBy(1)).not.toBe(
      configured(
        station({
          judge: judgeOf({
            rubric: RUBRIC,
            sample: 0.2,
            minAgreement: 0.6,
          }),
        }),
      ).parts.judge?.rubricHash,
    );
  });

  it('configures no judge on a station without one', () => {
    expect(configured(station()).parts).not.toHaveProperty('judge');
  });
});
