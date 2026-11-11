import { SkillCreated } from '@configuration/domain/events/skill-created.event';
import { SkillDeleted } from '@configuration/domain/events/skill-deleted.event';
import { SkillUpdated } from '@configuration/domain/events/skill-updated.event';
import { InvalidSkillError } from '@configuration/domain/exceptions/invalid-skill.error';
import { SkillDefinitionVersionConflictError } from '@configuration/domain/exceptions/skill-definition-version-conflict.error';
import { SkillInUseError } from '@configuration/domain/exceptions/skill-in-use.error';
import type { SkillFolderReading } from '@configuration/domain/services/skill-folder-reading';
import type { DefinedSkillKey } from '@configuration/domain/value-objects/defined-skill-key.vo';
import type { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import type { SkillFiles } from '@configuration/domain/value-objects/skill-files.vo';
import type { Skill } from '@configuration/domain/value-objects/skill.vo';
import type { StationUses } from '@configuration/domain/value-objects/station-uses.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

interface Props {
  readonly id: SkillDefinitionId;
  readonly teamId: TeamId;
  readonly key: DefinedSkillKey;
  readonly files: SkillFiles;
  readonly version: number;
}

interface State extends Props {
  readonly deleted: boolean;
}

export interface SkillFolder {
  readonly key: DefinedSkillKey;
  readonly files: SkillFiles;
}

const definedHere = (
  folder: SkillFolder,
  reading: SkillFolderReading,
): Skill => {
  const skill = reading.skillIn(folder.key, folder.files);

  if (skill.isBuiltIn) {
    throw new InvalidSkillError(
      skill.key.value,
      'is built in and cannot be defined by a team',
    );
  }

  return skill;
};

export class SkillDefinition extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static create(
    input: SkillFolder & {
      id: SkillDefinitionId;
      teamId: TeamId;
      reading: SkillFolderReading;
      by: ChangeActor;
    },
  ): SkillDefinition {
    const skill = definedHere(input, input.reading);

    const created = new SkillDefinition({
      id: input.id,
      teamId: input.teamId,
      key: skill.key,
      files: input.files,
      version: 0,
      deleted: false,
    });

    created.record(
      new SkillCreated(
        created.id,
        created.teamId,
        created.key,
        ConfigurationChange.created(created.whatChanged, input.by),
      ),
    );

    return created;
  }

  static rehydrate(input: Props): SkillDefinition {
    if (input.version < 1) {
      throw new InconsistentStateError(
        'skill definition',
        'was stored without a version',
      );
    }

    return new SkillDefinition({ ...input, deleted: false });
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new SkillDefinitionVersionConflictError(this.key.value);
    }
  }

  update(
    folder: SkillFolder,
    reading: SkillFolderReading,
    by: ChangeActor,
  ): SkillDefinition {
    this.guardLive();

    if (!folder.key.equals(this.key)) {
      const because = `cannot be renamed to ${folder.key.value}. Please replace it instead`;

      throw new ImmutableFieldError(
        'key',
        because,
        `Skill ${this.key.value} ${because}.`,
      );
    }

    definedHere(folder, reading);

    const updated = this.with({ files: folder.files });

    updated.record(
      new SkillUpdated(
        this.id,
        this.teamId,
        this.key,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return updated;
  }

  delete(uses: StationUses<SkillKey>, by: ChangeActor): SkillDefinition {
    this.guardLive();

    const using = uses.of(this.key.skill);

    if (!using.isEmpty) {
      throw new SkillInUseError(this.key.value, using);
    }

    const deleted = this.with({ deleted: true });

    deleted.record(this.deletedBy(by));

    return deleted;
  }

  cascadeDelete(by: ChangeActor): SkillDefinition {
    this.guardLive();

    const deleted = this.with({ deleted: true });

    deleted.record(this.deletedBy(by));

    return deleted;
  }

  get id(): SkillDefinitionId {
    return this.state.id;
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get key(): DefinedSkillKey {
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

  get isDeleted(): boolean {
    return this.state.deleted;
  }

  private deletedBy(by: ChangeActor): SkillDeleted {
    return new SkillDeleted(
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
    if (this.isDeleted) {
      throw new InconsistentStateError(
        'skill definition',
        'was changed after it was deleted',
      );
    }
  }
}
