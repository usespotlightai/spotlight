import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { StationKind } from '@work/domain/entities/station.entity';
import { InvalidLinePlanError } from '@work/domain/exceptions/invalid-line-plan.error';
import {
  reactionsRefused,
  setupRefused,
  stationsRefused,
} from '@work/domain/services/line-layout';
import {
  skillsRefused,
  toolsRefused,
} from '@work/domain/services/station-gives';
import type { AgentPrompt } from '@work/domain/value-objects/agent-prompt.vo';
import type { Effort } from '@work/domain/value-objects/effort.vo';
import type { Happening } from '@work/domain/value-objects/happening.vo';
import type { LineKey } from '@work/domain/value-objects/line-key.vo';
import type { LineName } from '@work/domain/value-objects/line-name.vo';
import { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';
import { LineRole } from '@work/domain/value-objects/line-role.vo';
import type { ProfileKey } from '@work/domain/value-objects/profile-key.vo';
import type { ReviewPolicy } from '@work/domain/value-objects/review-policy.vo';
import { reviewsOn } from '@work/domain/value-objects/review-policy.vo';
import type { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import type { StationCheck } from '@work/domain/value-objects/station-check.vo';
import type { StationColor } from '@work/domain/value-objects/station-color.vo';
import type { StationDescription } from '@work/domain/value-objects/station-description.vo';
import type { StationKey } from '@work/domain/value-objects/station-key.vo';
import type { StationName } from '@work/domain/value-objects/station-name.vo';
import type { Tool } from '@work/domain/value-objects/tool.vo';
import type { WorkedRepository } from '@work/domain/value-objects/worked-repository.vo';

export interface StationPlan {
  readonly key: StationKey;
  readonly name: StationName;
  readonly kind: StationKind;
  readonly color: StationColor;
  readonly description: StationDescription | null;
  readonly harness: HarnessId | null;
  readonly model: HarnessModel | null;
  readonly effort: Effort | null;
  readonly profile: ProfileKey | null;
  readonly agentPrompt: AgentPrompt | null;
  readonly check: StationCheck | null;
  readonly placement: RunnerPlacement;
  readonly diffs: boolean;
  readonly decisions: boolean;
  readonly memories: boolean;
  readonly tools: readonly Tool[];
  readonly skills: readonly SkillKey[];
  readonly passesTo: readonly StationKey[];
  readonly ends: boolean;
}

type RefusedStation = {
  readonly field: 'skills' | 'tools';
  readonly reason: string;
} | null;

const stationRefused = (station: StationPlan): RefusedStation => {
  const skills = skillsRefused(station.skills);

  if (skills) {
    return { field: 'skills', reason: skills };
  }

  const tools = toolsRefused(station.tools);

  return tools ? { field: 'tools', reason: tools } : null;
};

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
    readonly repositories: LineRepositories,
    readonly reviews: ReviewPolicy | null,
    readonly placement: RunnerPlacement,
  ) {}

  static of(input: {
    key: LineKey;
    name: LineName;
    stations: readonly StationPlan[];
    reactions?: readonly ReactionPlan[];
    role?: LineRole | null;
    repositories?: readonly WorkedRepository[];
    reviews?: ReviewPolicy | null;
    placement?: RunnerPlacement;
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
        laid.part,
      );
    }

    for (const station of input.stations) {
      const refused = stationRefused(station);

      if (refused) {
        throw new InvalidLinePlanError(
          input.key.value,
          `has ${station.key.value}, which ${refused.reason}`,
          {
            of: 'station',
            station: station.key.value,
            field: refused.field,
          },
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
        reacting.part,
      );
    }

    let repositories = LineRepositories.none();

    try {
      repositories = LineRepositories.of(input.repositories ?? []);
    } catch (error) {
      throw new InvalidLinePlanError(
        input.key.value,
        `has repositories it cannot work: ${error instanceof Error ? error.message : String(error)}`,
        { of: 'line', field: 'repositories' },
      );
    }

    const unready = setupRefused(input.stations, repositories);

    if (unready) {
      throw new InvalidLinePlanError(
        input.key.value,
        unready.reason,
        unready.part,
      );
    }

    if (input.reviews && !reviewsOn(input.role ?? null)) {
      throw new InvalidLinePlanError(
        input.key.value,
        `reviews pull requests, which only a line whose role is ${LineRole.REVIEW.value} does`,
        { of: 'line', field: 'reviews' },
      );
    }

    return new LinePlan(
      input.key,
      input.name,
      input.stations,
      reactions,
      input.role ?? null,
      repositories,
      input.reviews ?? null,
      input.placement ?? RunnerPlacement.anywhere(),
    );
  }

  names(key: StationKey): boolean {
    return this.stations.some((each) => each.key.equals(key));
  }
}
