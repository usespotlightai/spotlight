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
import type { JudgeSettings } from '@work/domain/value-objects/judge-settings.vo';

export type StationKind = 'backlog' | 'work' | 'completed';

export interface StationInput {
  readonly id: StationId;
  readonly key: StationKey;
  readonly name: StationName;
  readonly kind: StationKind;
  readonly position: number;
  readonly description?: string | null;
  readonly passesTo?: readonly StationId[];
  readonly ends?: boolean;
  readonly harness?: HarnessId | null;
  readonly model?: HarnessModel | null;
  readonly effort?: Effort | null;
  readonly profile?: ProfileKey | null;
  readonly agentPrompt?: string | null;
  readonly check?: string | null;
  readonly placement?: RunnerPlacement;
  readonly diffs?: boolean;
  readonly decisions?: boolean;
  readonly memories?: boolean;
  readonly judge?: JudgeSettings | null;
  readonly tools?: readonly Tool[];
  readonly skills?: readonly SkillKey[];
}

export class Station {
  private constructor(
    readonly id: StationId,
    readonly key: StationKey,
    readonly name: StationName,
    readonly kind: StationKind,
    readonly position: number,
    readonly description: string | null,
    readonly passesTo: readonly StationId[],
    readonly ends: boolean,
    readonly harness: HarnessId | null,
    readonly model: HarnessModel | null,
    readonly effort: Effort | null,
    readonly profile: ProfileKey | null,
    readonly agentPrompt: string | null,
    readonly check: string | null,
    readonly placement: RunnerPlacement,
    readonly diffs: boolean,
    readonly decisions: boolean,
    readonly memories: boolean,
    readonly judge: JudgeSettings | null,
    readonly tools: readonly Tool[],
    readonly skills: readonly SkillKey[],
  ) {}

  static of(input: StationInput): Station {
    const works = input.kind === 'work';

    return new Station(
      input.id,
      input.key,
      input.name,
      input.kind,
      input.position,
      input.description ?? null,
      [...(input.passesTo ?? [])],
      input.ends ?? false,
      works ? (input.harness ?? null) : null,
      works ? (input.model ?? null) : null,
      works ? (input.effort ?? null) : null,
      works ? (input.profile ?? null) : null,
      works ? (input.agentPrompt ?? null) : null,
      works ? (input.check ?? null) : null,
      works
        ? (input.placement ?? RunnerPlacement.anywhere())
        : RunnerPlacement.anywhere(),
      works && (input.diffs ?? false),
      works && (input.decisions ?? false),
      works && (input.memories ?? false),
      works ? (input.judge ?? null) : null,
      [...(input.tools ?? [])],
      [...(input.skills ?? [])],
    );
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

  routesTo(stationId: StationId): boolean {
    return this.passesTo.some((each) => each.equals(stationId));
  }
}
