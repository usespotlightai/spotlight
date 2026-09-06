import type { StationKind } from '@domain/entities/station.entity';
import { InvalidLinePlanError } from '@domain/exceptions/invalid-line-plan.error';
import type { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import type { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import type { Happening } from '@domain/value-objects/happening.vo';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import type { LineKey } from '@domain/value-objects/line-key.vo';
import type { LineRole } from '@domain/value-objects/line-role.vo';
import type { StationColor } from '@domain/value-objects/station-color.vo';
import type { StationDescription } from '@domain/value-objects/station-description.vo';
import type { StationKey } from '@domain/value-objects/station-key.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';
import type { Tool } from '@domain/value-objects/tool.vo';

/** Named by its key rather than an identifier nobody typed. */
export interface StationPlan {
  readonly key: StationKey;
  readonly name: StationName;
  readonly kind: StationKind;
  readonly color: StationColor;
  readonly description: StationDescription | null;
  readonly harness: HarnessId | null;
  readonly agentPrompt: AgentPrompt | null;
  readonly tools: readonly Tool[];
  readonly passesTo: readonly StationKey[];
  readonly ends: boolean;
}

export interface ReactionPlan {
  readonly happening: Happening;
  /** Where the task must be standing. Null is wherever it is. */
  readonly from: StationKey | null;
  readonly to: StationKey;
}

export interface OpenerPlan {
  readonly happening: Happening;
  readonly to: StationKey;
}

/**
 * A line as somebody described it. Whole on its own terms or not a plan:
 * every station named once, and everywhere it points landing on one it
 * describes.
 */
export class LinePlan {
  private constructor(
    readonly key: LineKey,
    readonly name: AssemblyLineName,
    readonly stations: readonly StationPlan[],
    readonly reactions: readonly ReactionPlan[],
    readonly openers: readonly OpenerPlan[],
    /** What the line is for, where the factory routes work by purpose. */
    readonly role: LineRole | null,
  ) {}

  static of(input: {
    key: LineKey;
    name: AssemblyLineName;
    stations: readonly StationPlan[];
    reactions?: readonly ReactionPlan[];
    openers?: readonly OpenerPlan[];
    role?: LineRole | null;
  }): LinePlan {
    const reactions = input.reactions ?? [];
    const openers = input.openers ?? [];
    const keys = input.stations.map((each) => each.key.value);

    // A line with nowhere to stand is not a line.
    if (input.stations.length === 0) {
      throw new InvalidLinePlanError(
        input.key.value,
        'describes no stations at all',
      );
    }

    // The second would quietly never be reached.
    if (new Set(keys).size !== keys.length) {
      throw new InvalidLinePlanError(
        input.key.value,
        'names one station twice, and each is named once',
      );
    }

    const named = new Set(keys);

    for (const station of input.stations) {
      for (const to of station.passesTo) {
        if (!named.has(to.value)) {
          throw new InvalidLinePlanError(
            input.key.value,
            `has ${station.key.value} passing work to ${to.value}, which is not a station on it`,
          );
        }
      }
    }

    for (const reaction of reactions) {
      for (const each of [reaction.to, reaction.from]) {
        if (each && !named.has(each.value)) {
          throw new InvalidLinePlanError(
            input.key.value,
            `sends ${reaction.happening.value} to ${each.value}, which is not a station on it`,
          );
        }
      }
    }

    for (const opener of openers) {
      if (!named.has(opener.to.value)) {
        throw new InvalidLinePlanError(
          input.key.value,
          `opens ${opener.happening.value} at ${opener.to.value}, which is not a station on it`,
        );
      }
    }

    return new LinePlan(
      input.key,
      input.name,
      input.stations,
      reactions,
      openers,
      input.role ?? null,
    );
  }

  names(key: StationKey): boolean {
    return this.stations.some((each) => each.key.equals(key));
  }

  /** Those the line standing has that this no longer describes. */
  drops(
    standing: readonly { readonly key: StationKey }[],
  ): readonly StationKey[] {
    return standing
      .filter((each) => !this.names(each.key))
      .map((each) => each.key);
  }
}
