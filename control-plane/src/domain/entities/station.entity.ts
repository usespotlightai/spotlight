import type { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import type { StationColor } from '@domain/value-objects/station-color.vo';
import type { StationDescription } from '@domain/value-objects/station-description.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';

export class Station {
  private constructor(
    readonly id: StationId,
    readonly name: StationName,
    readonly position: number,
    readonly color: StationColor,
    readonly description: StationDescription | null,
    readonly harness: HarnessId | null,
    readonly agentPrompt: AgentPrompt | null,
  ) {}

  static create(input: {
    id: StationId;
    name: StationName;
    position: number;
    color: StationColor;
    description?: StationDescription | null;
    harness?: HarnessId | null;
    agentPrompt?: AgentPrompt | null;
  }): Station {
    return new Station(
      input.id,
      input.name,
      input.position,
      input.color,
      input.description ?? null,
      input.harness ?? null,
      input.agentPrompt ?? null,
    );
  }

  rename(name: StationName): Station {
    return this.with({ name });
  }

  repaint(color: StationColor): Station {
    return this.with({ color });
  }

  describe(description: StationDescription | null): Station {
    return this.with({ description });
  }

  /** A station naming no harness holds what it is given: that is a backlog. */
  runsOn(harness: HarnessId | null): Station {
    return this.with({ harness });
  }

  instruct(agentPrompt: AgentPrompt | null): Station {
    return this.with({ agentPrompt });
  }

  equals(other: Station): boolean {
    return this.id.equals(other.id);
  }

  private with(part: {
    name?: StationName;
    color?: StationColor;
    description?: StationDescription | null;
    harness?: HarnessId | null;
    agentPrompt?: AgentPrompt | null;
  }): Station {
    return new Station(
      this.id,
      part.name ?? this.name,
      this.position,
      part.color ?? this.color,
      part.description !== undefined ? part.description : this.description,
      part.harness !== undefined ? part.harness : this.harness,
      part.agentPrompt !== undefined ? part.agentPrompt : this.agentPrompt,
    );
  }
}
