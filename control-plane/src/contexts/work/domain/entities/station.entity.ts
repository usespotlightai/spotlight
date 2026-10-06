import type { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import type { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { InvalidStationChangeError } from '@work/domain/exceptions/invalid-station-change.error';
import {
  skillsRefused,
  toolsRefused,
} from '@work/domain/services/station-gives';
import type { AgentPrompt } from '@work/domain/value-objects/agent-prompt.vo';
import type { Effort } from '@work/domain/value-objects/effort.vo';
import type { ProfileKey } from '@work/domain/value-objects/profile-key.vo';
import type { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import { StationAlert } from '@work/domain/value-objects/station-alert.vo';
import type { StationCheck } from '@work/domain/value-objects/station-check.vo';
import type { StationColor } from '@work/domain/value-objects/station-color.vo';
import type { StationDescription } from '@work/domain/value-objects/station-description.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';
import type { StationJudge } from '@work/domain/value-objects/station-judge.vo';
import type { StationKey } from '@work/domain/value-objects/station-key.vo';
import type { StationName } from '@work/domain/value-objects/station-name.vo';
import type { Tool } from '@work/domain/value-objects/tool.vo';
import { WayOut } from '@work/domain/value-objects/way-out.vo';

export type StationKind = 'backlog' | 'work' | 'completed';

type Part = {
  name?: StationName;
  position?: number;
  color?: StationColor;
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
  wayOut?: WayOut;
  tools?: readonly Tool[];
  skills?: readonly SkillKey[];
};

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
  kind?: StationKind;
  wayOut?: WayOut;
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
    readonly wayOut: WayOut,
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

  static of(input: StationInput): Station {
    Station.guardWhatItGives(input.tools ?? [], input.skills ?? []);

    const ends = [
      input.id,
      input.key,
      input.name,
      input.position,
      input.color,
      input.description ?? null,
      input.wayOut ?? WayOut.nowhere(),
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

  givesSkills(skills: readonly SkillKey[]): Station {
    Station.guardWhatItGives(this.tools, skills);

    return this.copiedWith({ skills });
  }

  private static guardWhatItGives(
    tools: readonly Tool[],
    skills: readonly SkillKey[],
  ): void {
    const refused = skillsRefused(skills) ?? toolsRefused(tools);

    if (refused) {
      throw new InvalidStationChangeError(refused);
    }
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

class WorkStation extends Station {
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
  ) {
    super(id, key, name, position, color, description, wayOut, tools, skills);
  }

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
      part.skills ?? this.skills,
      part.harness !== undefined ? part.harness : this.harness,
      part.model !== undefined ? part.model : this.model,
      part.effort !== undefined ? part.effort : this.effort,
      part.profile !== undefined ? part.profile : this.profile,
      part.agentPrompt !== undefined ? part.agentPrompt : this.agentPrompt,
      part.check !== undefined ? part.check : this.check,
      part.placement ?? this.placement,
      part.diffs !== undefined ? part.diffs : this.diffs,
      part.decisions !== undefined ? part.decisions : this.decisions,
      part.memories !== undefined ? part.memories : this.memories,
      part.judge !== undefined ? part.judge : this.judge,
      part.alerts ? StationAlert.together(part.alerts) : this.alerts,
    );
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

  runsOn(): Station {
    throw new InvalidStationChangeError(
      `${this.key.value} is a backlog. Nothing runs there`,
    );
  }

  atEffort(): Station {
    throw new InvalidStationChangeError(
      `${this.key.value} is a backlog and takes no effort`,
    );
  }

  instruct(): Station {
    throw new InvalidStationChangeError(
      `${this.key.value} is a backlog and takes no prompt`,
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
      part.skills ?? this.skills,
    );
  }
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

  runsOn(): Station {
    throw new InvalidStationChangeError(
      `${this.key.value} is the completed station. Nothing runs there`,
    );
  }

  atEffort(): Station {
    throw new InvalidStationChangeError(
      `${this.key.value} is the completed station and takes no effort`,
    );
  }

  instruct(): Station {
    throw new InvalidStationChangeError(
      `${this.key.value} is the completed station and takes no prompt`,
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
      part.skills ?? this.skills,
    );
  }
}
