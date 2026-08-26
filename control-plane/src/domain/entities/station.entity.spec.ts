import { Station } from '@domain/entities/station.entity';
import { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import { RunnerPool } from '@domain/value-objects/runner-pool.vo';
import { StationDescription } from '@domain/value-objects/station-description.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { describe, expect, it } from 'vitest';

const station = () =>
  Station.create({
    id: StationId.of('station_1'),
    name: StationName.of('Triage'),
    position: 0,
  });

const furnished = () =>
  station().customise({
    description: StationDescription.of('Where new work lands'),
    pool: RunnerPool.of('dev'),
    agentPrompt: AgentPrompt.of('## Role'),
  });

describe('Station', () => {
  it('opens bare, with nothing said about how it is worked', () => {
    const bare = station();

    expect(bare.description).toBeNull();
    expect(bare.pool).toBeNull();
    expect(bare.agentPrompt).toBeNull();
  });

  it('takes a description, a pool and a prompt', () => {
    const customised = furnished();

    expect(customised.description?.value).toBe('Where new work lands');
    expect(customised.pool?.value).toBe('dev');
    expect(customised.agentPrompt?.value).toBe('## Role');
  });

  it('leaves out of a change whatever the change left out', () => {
    const renamed = furnished().customise({ name: StationName.of('Intake') });

    expect(renamed.name.value).toBe('Intake');
    expect(renamed.pool?.value).toBe('dev');
    expect(renamed.agentPrompt?.value).toBe('## Role');
  });

  it('clears a field asked for as null', () => {
    const cleared = furnished().customise({ pool: null });

    expect(cleared.pool).toBeNull();
    expect(cleared.description?.value).toBe('Where new work lands');
  });

  it('keeps its identity and its place across a change', () => {
    const customised = furnished().customise({
      name: StationName.of('Intake'),
    });

    expect(customised.id.value).toBe('station_1');
    expect(customised.position).toBe(0);
  });

  it('leaves the station it was made from untouched', () => {
    const bare = station();
    bare.customise({ pool: RunnerPool.of('dev') });

    expect(bare.pool).toBeNull();
  });
});
