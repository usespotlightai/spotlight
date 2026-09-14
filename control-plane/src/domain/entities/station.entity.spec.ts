import { Station } from '@domain/entities/station.entity';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { HarnessModel } from '@domain/value-objects/harness-model.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationDescription } from '@domain/value-objects/station-description.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
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
