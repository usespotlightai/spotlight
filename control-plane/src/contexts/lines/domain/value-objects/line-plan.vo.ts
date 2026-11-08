import type { StationKind } from '@lines/domain/entities/station.entity';
import { DuplicateRepositoryError } from '@lines/domain/exceptions/duplicate-repository.error';
import { InvalidLinePlanError } from '@lines/domain/exceptions/invalid-line-plan.error';
import { MixedRunnerImagesError } from '@lines/domain/exceptions/mixed-runner-images.error';
import { idleStationProblem } from '@lines/domain/services/idle-station';
import {
  reactionsProblem,
  searchProblem,
  setupProblem,
  stationsProblem,
} from '@lines/domain/services/line-layout';
import {
  skillsProblem,
  toolsProblem,
} from '@lines/domain/services/station-enables';
import type { AgentPrompt } from '@lines/domain/value-objects/agent-prompt.vo';
import type { ConfigSource } from '@lines/domain/value-objects/config-source.vo';
import { LineRepositories } from '@lines/domain/value-objects/line-repositories.vo';
import type { LineRepositoryConfig } from '@lines/domain/value-objects/line-repository-config.vo';
import type { StationRule } from '@lines/domain/value-objects/plan-flaw';
import type { ReplayCheckPolicy } from '@lines/domain/value-objects/replay-check-policy.vo';
import type { ReviewPolicy } from '@lines/domain/value-objects/review-policy.vo';
import { reviewsOn } from '@lines/domain/value-objects/review-policy.vo';
import {
  LineSearchPolicy,
  type StationSearchOverride,
} from '@lines/domain/value-objects/search-policy.vo';
import type { StationAlert } from '@lines/domain/value-objects/station-alert.vo';
import type { StationCheck } from '@lines/domain/value-objects/station-check.vo';
import type { StationColor } from '@lines/domain/value-objects/station-color.vo';
import type { StationDescription } from '@lines/domain/value-objects/station-description.vo';
import type { StationJudge } from '@lines/domain/value-objects/station-judge.vo';
import type { Effort } from '@shared-kernel/domain/value-objects/effort.vo';
import type { Happening } from '@shared-kernel/domain/value-objects/happening.vo';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import type { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import type { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { LineRole } from '@shared-kernel/domain/value-objects/line-role.vo';
import type { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { WarmSandboxCount } from '@shared-kernel/domain/value-objects/warm-sandbox-count.vo';

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
  readonly judge: StationJudge | null;
  readonly alerts: readonly StationAlert[];
  readonly search: StationSearchOverride | null;
  readonly tools: readonly Tool[];
  readonly skills: readonly SkillKey[];
  readonly passesTo: readonly StationKey[];
  readonly ends: boolean;
}

type InvalidStation = {
  readonly rule: Exclude<StationRule, 'routes'>;
  readonly reason: string;
} | null;

const stationProblem = (station: StationPlan): InvalidStation => {
  const idle = idleStationProblem(station);

  if (idle) {
    return { rule: idle.setting, reason: idle.reason };
  }

  const skills = skillsProblem(station.skills);

  if (skills) {
    return { rule: 'skills', reason: skills };
  }

  const tools = toolsProblem(station.tools);

  return tools ? { rule: 'tools', reason: tools } : null;
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
    readonly warmSandboxes: WarmSandboxCount,
    readonly replayCheck: ReplayCheckPolicy | null,
    readonly search: LineSearchPolicy | null,
    readonly source: ConfigSource | null,
  ) {}

  static of(input: {
    key: LineKey;
    name: LineName;
    stations: readonly StationPlan[];
    reactions?: readonly ReactionPlan[];
    role?: LineRole | null;
    repositories?: readonly LineRepositoryConfig[];
    reviews?: ReviewPolicy | null;
    placement?: RunnerPlacement;
    warmSandboxes?: WarmSandboxCount;
    replayCheck?: ReplayCheckPolicy | null;
    search?: LineSearchPolicy | null;
    source?: ConfigSource | null;
  }): LinePlan {
    const reactions = input.reactions ?? [];
    const laid = stationsProblem(
      input.stations.map((each) => ({
        at: each.key,
        key: each.key,
        name: each.name,
        kind: each.kind,
        passesTo: each.passesTo,
      })),
    );

    if (laid) {
      throw new InvalidLinePlanError(
        input.key.value,
        `stations ${laid.reason}`,
        laid.flaw,
      );
    }

    for (const station of input.stations) {
      const problem = stationProblem(station);

      if (problem) {
        throw new InvalidLinePlanError(
          input.key.value,
          `station ${station.key.value} ${problem.reason}`,
          { in: 'station', station: station.key, rule: problem.rule },
        );
      }
    }

    const reacting = reactionsProblem(
      reactions,
      input.stations.map((each) => each.key),
    );

    if (reacting) {
      throw new InvalidLinePlanError(
        input.key.value,
        `reactions ${reacting.reason}`,
        reacting.flaw,
      );
    }

    let repositories = LineRepositories.none();

    try {
      repositories = LineRepositories.of(input.repositories ?? []);
    } catch (error) {
      if (
        !(error instanceof DuplicateRepositoryError) &&
        !(error instanceof MixedRunnerImagesError)
      ) {
        throw error;
      }

      throw new InvalidLinePlanError(
        input.key.value,
        `has repositories it cannot use. ${error.message.replace(/\.$/, '')}`,
        { in: 'line', rule: 'repositories' },
      );
    }

    const unready = setupProblem(input.stations, repositories);

    if (unready) {
      throw new InvalidLinePlanError(
        input.key.value,
        unready.reason,
        unready.flaw,
      );
    }

    const searching = searchProblem(
      input.stations,
      input.search ?? LineSearchPolicy.DEFAULT,
    );

    if (searching) {
      throw new InvalidLinePlanError(
        input.key.value,
        searching.reason,
        searching.flaw,
      );
    }

    if (input.reviews && !reviewsOn(input.role ?? null)) {
      throw new InvalidLinePlanError(
        input.key.value,
        `cannot review pull requests. Only a line with role ${LineRole.REVIEW.value} can`,
        { in: 'line', rule: 'reviews' },
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
      input.warmSandboxes ?? WarmSandboxCount.NONE,
      input.replayCheck ?? null,
      input.search ?? null,
      input.source ?? null,
    );
  }
}
