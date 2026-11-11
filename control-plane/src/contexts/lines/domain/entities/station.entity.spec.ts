import { Station } from '@lines/domain/entities/station.entity';
import { InvalidStationAlertError } from '@lines/domain/exceptions/invalid-station-alert.error';
import { AgentPrompt } from '@lines/domain/value-objects/agent-prompt.vo';
import { StationAlert } from '@lines/domain/value-objects/station-alert.vo';
import { StationColor } from '@lines/domain/value-objects/station-color.vo';
import { StationDescription } from '@lines/domain/value-objects/station-description.vo';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { describe, expect, it } from 'vitest';

const station = () =>
  Station.of({
    id: StationId.of('station_1'),
    key: StationKey.of('triage'),
    name: StationName.of('Triage'),
    position: 0,
    color: StationColor.of('#a3a8b0'),
  });

const furnished = () =>
  Station.of({
    id: StationId.of('station_1'),
    key: StationKey.of('triage'),
    name: StationName.of('Triage'),
    position: 0,
    color: StationColor.of('#a3a8b0'),
    description: StationDescription.of('Where new work lands'),
    harness: HarnessId.of('dev'),
    model: HarnessModel.of('dev-large'),
    agentPrompt: AgentPrompt.of('## Role'),
  });

describe('Station', () => {
  it('does not watch one measure twice for the same condition', () => {
    expect(() =>
      Station.of({
        id: StationId.of('station_1'),
        key: StationKey.of('build'),
        name: StationName.of('Build'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
        kind: 'work',
        alerts: [
          StationAlert.of({ measure: 'failed_rate', above: 0.1, over: 5 }),
          StationAlert.of({ measure: 'failed_rate', above: 0.3, over: 9 }),
        ],
      }),
    ).toThrow(InvalidStationAlertError);
  });

  it('opens bare, with nothing said about how it is worked', () => {
    const bare = station();

    expect(bare.description).toBeNull();
    expect(bare.harness).toBeNull();
    expect(bare.agentPrompt).toBeNull();
  });

  it('takes a description, a pool and a prompt', () => {
    const furnishedStation = furnished();

    expect(furnishedStation.description?.value).toBe('Where new work lands');
    expect(furnishedStation.harness?.value).toBe('dev');
    expect(furnishedStation.model?.value).toBe('dev-large');
    expect(furnishedStation.agentPrompt?.value).toBe('## Role');
  });
});
