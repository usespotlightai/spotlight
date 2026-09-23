import type { Skill } from '@configuration/domain/entities/skill.entity';
import { SkillDefined } from '@configuration/domain/events/skill-defined.event';
import { SkillRedefined } from '@configuration/domain/events/skill-redefined.event';
import { SkillRetired } from '@configuration/domain/events/skill-retired.event';
import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';
import { SkillDefinitionMovedOnError } from '@configuration/domain/exceptions/skill-definition-moved-on.error';
import { SkillInUseError } from '@configuration/domain/exceptions/skill-in-use.error';
import { SkillKeyFixedError } from '@configuration/domain/exceptions/skill-key-fixed.error';
import type { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import type { SkillFiles } from '@configuration/domain/value-objects/skill-files.vo';
import type { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import type { SkillUses } from '@configuration/domain/value-objects/skill-uses.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
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
      'is one Spotlight ships, and a team defines only its own',
    );
  }
};

export class SkillDefinition extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static define(
    input: ReadSkill & { id: SkillDefinitionId; teamId: TeamId },
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

    defined.record(new SkillDefined(defined.id, defined.teamId, defined.key));

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

  expecting(version: number): void {
    if (version !== this.version) {
      throw new SkillDefinitionMovedOnError(this.key.value);
    }
  }

  redefinedAs(read: ReadSkill): SkillDefinition {
    this.guardLive();
    guardDefinedHere(read);

    if (!read.skill.key.equals(this.key)) {
      throw new SkillKeyFixedError(
        this.key.value,
        `keeps its key for its whole life, since stations give it by that key; replace it to define ${read.skill.key.value}`,
      );
    }

    const redefined = this.with({ files: read.files });

    redefined.record(new SkillRedefined(this.id, this.teamId, this.key));

    return redefined;
  }

  retired(given: SkillUses): SkillDefinition {
    this.guardLive();

    const using = given.of(this.key);

    if (!using.isEmpty) {
      throw new SkillInUseError(this.key.value, using);
    }

    const retired = this.with({ retired: true });

    retired.record(new SkillRetired(this.id, this.teamId, this.key));

    return retired;
  }

  abandoned(): SkillDefinition {
    this.guardLive();

    const abandoned = this.with({ retired: true });

    abandoned.record(new SkillRetired(this.id, this.teamId, this.key));

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
