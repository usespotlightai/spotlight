import { Station } from '@lines/domain/entities/station.entity';
import { InvalidStationChangeError } from '@lines/domain/exceptions/invalid-station-change.error';
import { idleStationProblem } from '@lines/domain/services/idle-station';
import { StationColor } from '@lines/domain/value-objects/station-color.vo';
import { StationJudge } from '@lines/domain/value-objects/station-judge.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { describe, expect, it } from 'vitest';

const JUDGE = StationJudge.of({
  rubric: 'A good run.',
  sample: 0.2,
  minAgreement: 0.6,
});

const backlogWith = (over: Partial<Parameters<typeof Station.of>[0]>) =>
  Station.of({
    id: StationId.of('station_1'),
    key: StationKey.of('backlog'),
    name: StationName.of('Backlog'),
    position: 0,
    color: StationColor.plain(),
    kind: 'backlog',
    ...over,
  });

describe('idleStationProblem', () => {
  it('finds nothing wrong with a work station that runs an agent', () => {
    expect(
      idleStationProblem({
        kind: 'work',
        harness: HarnessId.of('claude-code'),
        judge: JUDGE,
      }),
    ).toBeNull();
  });

  it('finds nothing wrong with a backlog that takes no run settings', () => {
    expect(
      idleStationProblem({
        kind: 'backlog',
        alerts: [],
        placement: RunnerPlacement.anywhere(),
        diffs: false,
      }),
    ).toBeNull();
  });

  it('names the first run setting a backlog or completed station cannot take', () => {
    expect(idleStationProblem({ kind: 'backlog', judge: JUDGE })).toEqual({
      setting: 'judge',
      reason: 'is a backlog and has no runs to judge',
    });
    expect(
      idleStationProblem({
        kind: 'completed',
        placement: RunnerPlacement.of(['gpu']),
      }),
    ).toEqual({
      setting: 'runners',
      reason:
        'is the completed station and runs no agent, so it takes no runners',
    });
  });
});

describe('Station.of', () => {
  it('refuses run settings on a station that runs no agent, keeping nothing silently', () => {
    expect(() => backlogWith({ judge: JUDGE })).toThrow(
      InvalidStationChangeError,
    );
    expect(() => backlogWith({ harness: HarnessId.of('claude-code') })).toThrow(
      /takes no harness/,
    );
  });

  it('builds a backlog without run settings', () => {
    expect(backlogWith({}).kind).toBe('backlog');
  });
});
