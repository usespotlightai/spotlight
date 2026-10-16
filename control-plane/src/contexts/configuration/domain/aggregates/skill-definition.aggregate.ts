import type { Skill } from '@configuration/domain/entities/skill.entity';
import { SkillDefined } from '@configuration/domain/events/skill-defined.event';
import { SkillRedefined } from '@configuration/domain/events/skill-redefined.event';
import { SkillRetired } from '@configuration/domain/events/skill-retired.event';
import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';
import { SkillDefinitionVersionConflictError } from '@configuration/domain/exceptions/skill-definition-version-conflict.error';
import { SkillInUseError } from '@configuration/domain/exceptions/skill-in-use.error';
import { SkillKeyFixedError } from '@configuration/domain/exceptions/skill-key-fixed.error';
import type { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import type { SkillFiles } from '@configuration/domain/value-objects/skill-files.vo';
import type { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import type { StationUses } from '@configuration/domain/value-objects/station-uses.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

interface Kept {
  readonly id: SkillDefinitionId;
  readonly teamId: TeamId;
  readonly key: SkillKey;
  readonly files: SkillFiles;
  readonly version: number;
}

interface State extends Kept {
  readonly retired: boolean;
}

export interface ReadSkill {
  readonly skill: Skill;
  readonly files: SkillFiles;
}

const guardDefinedHere = (read: ReadSkill): void => {
  if (read.skill.isShipped) {
    throw new InvalidSkillError(
      read.skill.key.value,
      'is built in and cannot be defined by a team',
    );
  }
};

export class SkillDefinition extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static define(
    input: ReadSkill & {
      id: SkillDefinitionId;
      teamId: TeamId;
      by: Attribution;
    },
  ): SkillDefinition {
    guardDefinedHere(input);

    const defined = new SkillDefinition({
      id: input.id,
      teamId: input.teamId,
      key: input.skill.key,
      files: input.files,
      version: 0,
      retired: false,
    });

    defined.record(
      new SkillDefined(
        defined.id,
        defined.teamId,
        defined.key,
        ConfigurationChange.created(defined.whatChanged, input.by),
      ),
    );

    return defined;
  }

  static rehydrate(input: Kept): SkillDefinition {
    if (input.version < 1) {
      throw new InconsistentStateError(
        'skill definition',
        'was kept without a version',
      );
    }

    return new SkillDefinition({ ...input, retired: false });
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new SkillDefinitionVersionConflictError(this.key.value);
    }
  }

  redefinedAs(read: ReadSkill, by: Attribution): SkillDefinition {
    this.guardLive();
    guardDefinedHere(read);

    if (!read.skill.key.equals(this.key)) {
      throw new SkillKeyFixedError(
        this.key.value,
        `cannot be renamed to ${read.skill.key.value}. Please replace it instead`,
      );
    }

    const redefined = this.with({ files: read.files });

    redefined.record(
      new SkillRedefined(
        this.id,
        this.teamId,
        this.key,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return redefined;
  }

  retired(given: StationUses, by: Attribution): SkillDefinition {
    this.guardLive();

    const using = given.of(this.key);

    if (!using.isEmpty) {
      throw new SkillInUseError(this.key.value, using);
    }

    const retired = this.with({ retired: true });

    retired.record(this.retiredBy(by));

    return retired;
  }

  abandoned(by: Attribution): SkillDefinition {
    this.guardLive();

    const abandoned = this.with({ retired: true });

    abandoned.record(this.retiredBy(by));

    return abandoned;
  }

  get id(): SkillDefinitionId {
    return this.state.id;
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get key(): SkillKey {
    return this.state.key;
  }

  get files(): SkillFiles {
    return this.state.files;
  }

  get version(): number {
    return this.state.version;
  }

  get isNew(): boolean {
    return this.state.version === 0;
  }

  get isRetired(): boolean {
    return this.state.retired;
  }

  private retiredBy(by: Attribution): SkillRetired {
    return new SkillRetired(
      this.id,
      this.teamId,
      this.key,
      ConfigurationChange.deleted(this.whatChanged, by),
    );
  }

  private get whatChanged() {
    return {
      resource: 'skill' as const,
      id: this.id.value,
      key: this.key.value,
    };
  }

  private with(change: Partial<State>): SkillDefinition {
    const next = new SkillDefinition({ ...this.state, ...change });

    next.inheritEvents(this);

    return next;
  }

  private guardLive(): void {
    if (this.isRetired) {
      throw new InconsistentStateError(
        'skill definition',
        'was changed after it was retired',
      );
    }
  }
}
