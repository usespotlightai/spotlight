import type { StationKind } from '@domain/entities/station.entity';
import { InvalidLinePlanError } from '@domain/exceptions/invalid-line-plan.error';
import {
  reactionsRefused,
  stationsRefused,
} from '@domain/services/line-layout';
import { skillsRefused, toolsRefused } from '@domain/services/station-gives';
import type { AgentPrompt } from '@domain/value-objects/agent-prompt.vo';
import type { Effort } from '@domain/value-objects/effort.vo';
import type { Happening } from '@domain/value-objects/happening.vo';
import type { HarnessId } from '@domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@domain/value-objects/harness-model.vo';
import type { LineKey } from '@domain/value-objects/line-key.vo';
import type { LineName } from '@domain/value-objects/line-name.vo';
import { LineRepositories } from '@domain/value-objects/line-repositories.vo';
import type { LineRole } from '@domain/value-objects/line-role.vo';
import type { Repository } from '@domain/value-objects/repository.vo';
import type { SkillKey } from '@domain/value-objects/skill-key.vo';
import type { StationColor } from '@domain/value-objects/station-color.vo';
import type { StationDescription } from '@domain/value-objects/station-description.vo';
import type { StationKey } from '@domain/value-objects/station-key.vo';
import type { StationName } from '@domain/value-objects/station-name.vo';
import type { Tool } from '@domain/value-objects/tool.vo';

export interface StationPlan {
  readonly key: StationKey;
  readonly name: StationName;
  readonly kind: StationKind;
  readonly color: StationColor;
  readonly description: StationDescription | null;
  readonly harness: HarnessId | null;
  readonly model: HarnessModel | null;
  readonly effort: Effort | null;
  readonly agentPrompt: AgentPrompt | null;
  readonly tools: readonly Tool[];
  readonly skills: readonly SkillKey[];
  readonly passesTo: readonly StationKey[];
  readonly ends: boolean;
}

export interface ReactionPlan {
  readonly happening: Happening;
  readonly from: StationKey | null;
  readonly to: StationKey;
}

export class LinePlan {
  private constructor(
    readonly key: LineKey,
    readonly name: LineName,
    readonly stations: readonly StationPlan[],
    readonly reactions: readonly ReactionPlan[],
    readonly role: LineRole | null,
    readonly repositories: readonly Repository[],
  ) {}

  static of(input: {
    key: LineKey;
    name: LineName;
    stations: readonly StationPlan[];
    reactions?: readonly ReactionPlan[];
    role?: LineRole | null;
    repositories?: readonly Repository[];
  }): LinePlan {
    const reactions = input.reactions ?? [];
    const laid = stationsRefused(
      input.stations.map((each) => ({
        key: each.key.value,
        name: each.name.value,
        kind: each.kind,
        passesTo: each.passesTo.map((to) => to.value),
      })),
    );

    if (laid) {
      throw new InvalidLinePlanError(
        input.key.value,
        `has stations that ${laid.reason}`,
        laid.at,
      );
    }

    for (const [at, station] of input.stations.entries()) {
      const refused =
        skillsRefused(station.skills) ?? toolsRefused(station.tools);

      if (refused) {
        throw new InvalidLinePlanError(
          input.key.value,
          `has ${station.key.value}, which ${refused}`,
          `stations.${at}`,
        );
      }
    }

    const reacting = reactionsRefused(
      reactions.map((each) => ({
        happening: each.happening.value,
        from: each.from?.value ?? null,
        to: each.to.value,
      })),
      new Set(input.stations.map((each) => each.key.value)),
    );

    if (reacting) {
      throw new InvalidLinePlanError(
        input.key.value,
        `has reactions that ${reacting.reason}`,
        reacting.at,
      );
    }

    try {
      LineRepositories.of(input.repositories ?? []);
    } catch (error) {
      throw new InvalidLinePlanError(
        input.key.value,
        `works in repositories that ${error instanceof Error ? error.message : String(error)}`,
        'repositories',
      );
    }

    return new LinePlan(
      input.key,
      input.name,
      input.stations,
      reactions,
      input.role ?? null,
      input.repositories ?? [],
    );
  }

  names(key: StationKey): boolean {
    return this.stations.some((each) => each.key.equals(key));
  }
}
