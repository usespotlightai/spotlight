import { InvalidStationChangeError } from '@lines/domain/exceptions/invalid-station-change.error';
import {
  skillsProblem,
  toolsProblem,
} from '@lines/domain/services/station-enables';
import type { AgentPrompt } from '@lines/domain/value-objects/agent-prompt.vo';
import type { StationSearchOverride } from '@lines/domain/value-objects/search-policy.vo';
import { StationAlert } from '@lines/domain/value-objects/station-alert.vo';
import type { StationCheck } from '@lines/domain/value-objects/station-check.vo';
import type { StationColor } from '@lines/domain/value-objects/station-color.vo';
import type { StationDescription } from '@lines/domain/value-objects/station-description.vo';
import type { StationJudge } from '@lines/domain/value-objects/station-judge.vo';
import { StationRoutes } from '@lines/domain/value-objects/station-routes.vo';
import type { Effort } from '@shared-kernel/domain/value-objects/effort.vo';
import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import type { ProfileKey } from '@shared-kernel/domain/value-objects/profile-key.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import type { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import type { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import type { Tool } from '@shared-kernel/domain/value-objects/tool.vo';

export const STATION_KINDS = ['backlog', 'work', 'completed'] as const;

export type StationKind = (typeof STATION_KINDS)[number];

export type StationInput = {
  id: StationId;
  key: StationKey;
  name: StationName;
  position: number;
  color: StationColor;
  description?: StationDescription | null;
  harness?: HarnessId | null;
  model?: HarnessModel | null;
  effort?: Effort | null;
  profile?: ProfileKey | null;
  agentPrompt?: AgentPrompt | null;
  check?: StationCheck | null;
  placement?: RunnerPlacement;
  diffs?: boolean;
  decisions?: boolean;
  memories?: boolean;
  judge?: StationJudge | null;
  alerts?: readonly StationAlert[];
  search?: StationSearchOverride | null;
  kind?: StationKind;
  routes?: StationRoutes;
  tools?: readonly Tool[];
  skills?: readonly SkillKey[];
};

export abstract class Station {
  protected constructor(
    readonly id: StationId,
    readonly key: StationKey,
    readonly name: StationName,
    readonly position: number,
    readonly color: StationColor,
    readonly description: StationDescription | null,
    readonly routes: StationRoutes,
    readonly tools: readonly Tool[],
    readonly skills: readonly SkillKey[],
  ) {}

  abstract readonly kind: StationKind;
  abstract readonly harness: HarnessId | null;
  abstract readonly model: HarnessModel | null;
  abstract readonly effort: Effort | null;
  abstract readonly profile: ProfileKey | null;
  abstract readonly agentPrompt: AgentPrompt | null;
  abstract readonly check: StationCheck | null;
  abstract readonly placement: RunnerPlacement;
  abstract readonly diffs: boolean;
  abstract readonly decisions: boolean;
  abstract readonly memories: boolean;
  abstract readonly judge: StationJudge | null;
  abstract readonly alerts: readonly StationAlert[];
  abstract readonly search: StationSearchOverride | null;

  static of(input: StationInput): Station {
    Station.guardWhatItEnables(input.tools ?? [], input.skills ?? []);

    const ends = [
      input.id,
      input.key,
      input.name,
      input.position,
      input.color,
      input.description ?? null,
      input.routes ?? StationRoutes.none(),
      input.tools ?? [],
      input.skills ?? [],
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
          input.profile ?? null,
          input.agentPrompt ?? null,
          input.check ?? null,
          input.placement ?? RunnerPlacement.anywhere(),
          input.diffs ?? false,
          input.decisions ?? false,
          input.memories ?? false,
          input.judge ?? null,
          StationAlert.together(input.alerts ?? []),
          input.search ?? null,
        );
    }
  }

  get isBacklog(): boolean {
    return this.kind === 'backlog';
  }

  get isCompleted(): boolean {
    return this.kind === 'completed';
  }

  get isAgentStation(): boolean {
    return this.kind === 'work';
  }

  private static guardWhatItEnables(
    tools: readonly Tool[],
    skills: readonly SkillKey[],
  ): void {
    const problem = skillsProblem(skills) ?? toolsProblem(tools);

    if (problem) {
      throw new InvalidStationChangeError(problem);
    }
  }

  equals(other: Station): boolean {
    return this.id.equals(other.id);
  }
}

class WorkStation extends Station {
  readonly kind = 'work' as const;

  constructor(
    id: StationId,
    key: StationKey,
    name: StationName,
    position: number,
    color: StationColor,
    description: StationDescription | null,
    routes: StationRoutes,
    tools: readonly Tool[],
    skills: readonly SkillKey[],
    readonly harness: HarnessId | null,
    readonly model: HarnessModel | null,
    readonly effort: Effort | null,
    readonly profile: ProfileKey | null,
    readonly agentPrompt: AgentPrompt | null,
    readonly check: StationCheck | null,
    readonly placement: RunnerPlacement,
    readonly diffs: boolean,
    readonly decisions: boolean,
    readonly memories: boolean,
    readonly judge: StationJudge | null,
    readonly alerts: readonly StationAlert[],
    readonly search: StationSearchOverride | null,
  ) {
    super(id, key, name, position, color, description, routes, tools, skills);
  }
}

class Backlog extends Station {
  readonly kind = 'backlog' as const;
  readonly harness = null;
  readonly model = null;
  readonly effort = null;
  readonly profile = null;
  readonly agentPrompt = null;
  readonly check = null;
  readonly placement = RunnerPlacement.anywhere();
  readonly diffs = false;
  readonly decisions = false;
  readonly memories = false;
  readonly judge = null;
  readonly alerts: readonly StationAlert[] = [];
  readonly search = null;
}

class Completed extends Station {
  readonly kind = 'completed' as const;
  readonly harness = null;
  readonly model = null;
  readonly effort = null;
  readonly profile = null;
  readonly agentPrompt = null;
  readonly check = null;
  readonly placement = RunnerPlacement.anywhere();
  readonly diffs = false;
  readonly decisions = false;
  readonly memories = false;
  readonly judge = null;
  readonly alerts: readonly StationAlert[] = [];
  readonly search = null;
}
