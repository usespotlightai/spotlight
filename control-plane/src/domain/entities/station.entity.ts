import { InvalidStationChangeError } from '@domain/exceptions/invalid-station-change.error';
import type { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import type { Effort } from '@domain/value-objects/effort.vo';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@domain/value-objects/harness-model.vo';
import type { StationColor } from '@domain/value-objects/station-color.vo';
import type { StationDescription } from '@domain/value-objects/station-description.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';
import type { Tool } from '@domain/value-objects/tool.vo';
import { WayOut } from '@domain/value-objects/way-out.vo';

export type StationKind = 'backlog' | 'work' | 'completed';

type Part = {
  name?: StationName;
  position?: number;
  color?: StationColor;
  description?: StationDescription | null;
  harness?: HarnessId | null;
  model?: HarnessModel | null;
  effort?: Effort | null;
  agentPrompt?: AgentPrompt | null;
  wayOut?: WayOut;
  tools?: readonly Tool[];
};

export type StationInput = {
  id: StationId;
  /** What it is called in the file. Taken from its name where none is given. */
  key?: StationKey;
  name: StationName;
  position: number;
  color: StationColor;
  description?: StationDescription | null;
  harness?: HarnessId | null;
  model?: HarnessModel | null;
  effort?: Effort | null;
  agentPrompt?: AgentPrompt | null;
  kind?: StationKind;
  wayOut?: WayOut;
  tools?: readonly Tool[];
};

export abstract class Station {
  protected constructor(
    readonly id: StationId,
    /**
     * What it is called in the file that describes it, and what it stays
     * called however it is renamed. Tasks stand here by the identifier
     * above; configuration finds it again by this.
     */
    readonly key: StationKey,
    readonly name: StationName,
    readonly position: number,
    readonly color: StationColor,
    readonly description: StationDescription | null,
    readonly wayOut: WayOut,
    /** What a run here may reach for, and so what it is told about. */
    readonly tools: readonly Tool[],
  ) {}

  abstract readonly kind: StationKind;
  abstract readonly harness: HarnessId | null;
  /** Which model the harness answers with here. Null where nothing runs. */
  abstract readonly model: HarnessModel | null;
  /** How hard the harness is told to think here. Null leaves its own default. */
  abstract readonly effort: Effort | null;
  abstract readonly agentPrompt: AgentPrompt | null;

  static of(input: StationInput): Station {
    const ends = [
      input.id,
      input.key ?? StationKey.from(input.name.value),
      input.name,
      input.position,
      input.color,
      input.description ?? null,
      input.wayOut ?? WayOut.nowhere(),
      input.tools ?? [],
    ] as const;

    switch (input.kind) {
      case 'backlog':
        return new Backlog(...ends);
      case 'completed':
        return new Completed(...ends);
      default:
        return new WorkStation(
          ...ends,
          input.harness ?? null,
          input.model ?? null,
          input.effort ?? null,
          input.agentPrompt ?? null,
        );
    }
  }

  get isBacklog(): boolean {
    return this.kind === 'backlog';
  }

  get isCompleted(): boolean {
    return this.kind === 'completed';
  }

  get isWorked(): boolean {
    return this.kind === 'work';
  }

  rename(name: StationName): Station {
    return this.copiedWith({ name });
  }

  repaint(color: StationColor): Station {
    return this.copiedWith({ color });
  }

  describe(description: StationDescription | null): Station {
    return this.copiedWith({ description });
  }

  /** True where a run here was told about it, and so may reach for it. */
  has(tool: Tool): boolean {
    return this.tools.some((each) => each.equals(tool));
  }

  reaches(tools: readonly Tool[]): Station {
    return this.copiedWith({ tools });
  }

  abstract runsOn(
    harness: HarnessId | null,
    model: HarnessModel | null,
  ): Station;

  abstract atEffort(effort: Effort | null): Station;

  abstract instruct(agentPrompt: AgentPrompt | null): Station;

  equals(other: Station): boolean {
    return this.id.equals(other.id);
  }

  protected abstract copiedWith(part: Part): Station;
}

export class WorkStation extends Station {
  readonly kind = 'work' as const;

  constructor(
    id: StationId,
    key: StationKey,
    name: StationName,
    position: number,
    color: StationColor,
    description: StationDescription | null,
    wayOut: WayOut,
    tools: readonly Tool[],
    readonly harness: HarnessId | null,
    readonly model: HarnessModel | null,
    readonly effort: Effort | null,
    readonly agentPrompt: AgentPrompt | null,
  ) {
    super(id, key, name, position, color, description, wayOut, tools);
  }

  // A harness, its model and its effort travel together: dropping the harness
  // drops both, so nothing names them with nothing to answer them.
  runsOn(harness: HarnessId | null, model: HarnessModel | null): Station {
    return this.copiedWith({
      harness,
      model: harness ? model : null,
      effort: harness ? this.effort : null,
    });
  }

  atEffort(effort: Effort | null): Station {
    return this.copiedWith({ effort });
  }

  instruct(agentPrompt: AgentPrompt | null): Station {
    return this.copiedWith({ agentPrompt });
  }

  protected copiedWith(part: Part): Station {
    return new WorkStation(
      this.id,
      this.key,
      part.name ?? this.name,
      part.position ?? this.position,
      part.color ?? this.color,
      part.description !== undefined ? part.description : this.description,
      part.wayOut ?? this.wayOut,
      part.tools ?? this.tools,
      part.harness !== undefined ? part.harness : this.harness,
      part.model !== undefined ? part.model : this.model,
      part.effort !== undefined ? part.effort : this.effort,
      part.agentPrompt !== undefined ? part.agentPrompt : this.agentPrompt,
    );
  }
}

export class Backlog extends Station {
  readonly kind = 'backlog' as const;
  readonly harness = null;
  readonly model = null;
  readonly effort = null;
  readonly agentPrompt = null;

  runsOn(): Station {
    throw new InvalidStationChangeError(
      'is a backlog, where tasks wait to be started, so nothing runs there',
    );
  }

  atEffort(): Station {
    throw new InvalidStationChangeError(
      'is a backlog, where nothing runs, so there is no effort to set',
    );
  }

  instruct(): Station {
    throw new InvalidStationChangeError(
      'is a backlog, so there is nothing there to instruct',
    );
  }

  protected copiedWith(part: Part): Station {
    return new Backlog(
      this.id,
      this.key,
      part.name ?? this.name,
      part.position ?? this.position,
      part.color ?? this.color,
      part.description !== undefined ? part.description : this.description,
      part.wayOut ?? this.wayOut,
      part.tools ?? this.tools,
    );
  }
}

/** Where a task lands once its pull request is merged. */
export class Completed extends Station {
  readonly kind = 'completed' as const;
  readonly harness = null;
  readonly model = null;
  readonly effort = null;
  readonly agentPrompt = null;

  runsOn(): Station {
    throw new InvalidStationChangeError(
      'is where the line ends, so nothing runs there',
    );
  }

  atEffort(): Station {
    throw new InvalidStationChangeError(
      'is where the line ends, so there is no effort to set',
    );
  }

  instruct(): Station {
    throw new InvalidStationChangeError(
      'is where the line ends, so there is nothing there to instruct',
    );
  }

  protected copiedWith(part: Part): Station {
    return new Completed(
      this.id,
      this.key,
      part.name ?? this.name,
      part.position ?? this.position,
      part.color ?? this.color,
      part.description !== undefined ? part.description : this.description,
      part.wayOut ?? this.wayOut,
      part.tools ?? this.tools,
    );
  }
}
