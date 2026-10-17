import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { Station } from '@work/domain/entities/station.entity';
import { InvalidStationAlertError } from '@work/domain/exceptions/invalid-station-alert.error';
import { AgentPrompt } from '@work/domain/value-objects/agent-prompt.vo';
import { StationAlert } from '@work/domain/value-objects/station-alert.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationDescription } from '@work/domain/value-objects/station-description.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
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
  station()
    .describe(StationDescription.of('Where new work lands'))
    .runsOn(HarnessId.of('dev'), HarnessModel.of('dev-large'))
    .instruct(AgentPrompt.of('## Role'));

describe('Station', () => {
  it('does not watch one measure twice for the same kind of threshold', () => {
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

  it('leaves everything else alone when it is renamed', () => {
    const renamed = furnished().rename(StationName.of('Intake'));

    expect(renamed.name.value).toBe('Intake');
    expect(renamed.harness?.value).toBe('dev');
    expect(renamed.agentPrompt?.value).toBe('## Role');
  });

  it('takes a colour of its own', () => {
    const repainted = furnished().repaint(StationColor.of('#db5b52'));

    expect(repainted.color.value).toBe('#db5b52');
    expect(repainted.name.value).toBe('Triage');
  });

  it('answers to no pool once it is assigned none', () => {
    const cleared = furnished().runsOn(null, null);

    expect(cleared.harness).toBeNull();
    expect(cleared.model).toBeNull();
    expect(cleared.description?.value).toBe('Where new work lands');
  });

  it('drops the model with the harness, so none is named with nothing to run', () => {
    const cleared = furnished().runsOn(null, HarnessModel.of('dev-large'));

    expect(cleared.harness).toBeNull();
    expect(cleared.model).toBeNull();
  });

  it('keeps its identity and its place across a change', () => {
    const renamed = furnished().rename(StationName.of('Intake'));

    expect(renamed.id.value).toBe('station_1');
    expect(renamed.position).toBe(0);
  });

  it('leaves the station it was made from untouched', () => {
    const bare = station();
    bare.runsOn(HarnessId.of('dev'), HarnessModel.of('dev-large'));

    expect(bare.harness).toBeNull();
  });
});
