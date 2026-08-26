import type { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import type { RunnerPool } from '@domain/value-objects/runner-pool.vo';
import type { StationDescription } from '@domain/value-objects/station-description.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';

/** A field left out is left alone; a field given as null is cleared. */
export type StationChanges = {
  name?: StationName;
  description?: StationDescription | null;
  pool?: RunnerPool | null;
  agentPrompt?: AgentPrompt | null;
};

/** Position orders the board. It does not define the flow: movement becomes
 *  explicit transitions once runs execute, because review sends work back. */
export class Station {
  private constructor(
    readonly id: StationId,
    readonly name: StationName,
    readonly position: number,
    readonly description: StationDescription | null,
    readonly pool: RunnerPool | null,
    readonly agentPrompt: AgentPrompt | null,
  ) {}

  /** A station opens bare: what it says, which pool works it and what the
   *  agent is told are all decided afterwards, by whoever runs the board. */
  static create(input: {
    id: StationId;
    name: StationName;
    position: number;
    description?: StationDescription | null;
    pool?: RunnerPool | null;
    agentPrompt?: AgentPrompt | null;
  }): Station {
    return new Station(
      input.id,
      input.name,
      input.position,
      input.description ?? null,
      input.pool ?? null,
      input.agentPrompt ?? null,
    );
  }

  customise(changes: StationChanges): Station {
    return new Station(
      this.id,
      changes.name ?? this.name,
      this.position,
      changes.description !== undefined
        ? changes.description
        : this.description,
      changes.pool !== undefined ? changes.pool : this.pool,
      changes.agentPrompt !== undefined
        ? changes.agentPrompt
        : this.agentPrompt,
    );
  }

  equals(other: Station): boolean {
    return this.id.equals(other.id);
  }
}
