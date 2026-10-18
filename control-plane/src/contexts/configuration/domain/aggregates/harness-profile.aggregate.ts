import { HarnessProfileCreated } from '@configuration/domain/events/harness-profile-created.event';
import { HarnessProfileDeleted } from '@configuration/domain/events/harness-profile-deleted.event';
import { HarnessProfileUpdated } from '@configuration/domain/events/harness-profile-updated.event';
import { HarnessProfileInUseError } from '@configuration/domain/exceptions/harness-profile-in-use.error';
import { HarnessProfileVersionConflictError } from '@configuration/domain/exceptions/harness-profile-version-conflict.error';
import { MissingSecretsError } from '@configuration/domain/exceptions/missing-secrets.error';
import { missingSecrets } from '@configuration/domain/services/missing-secrets';
import type { HarnessProfileId } from '@configuration/domain/value-objects/harness-profile-id.vo';
import type { ProfileKey } from '@configuration/domain/value-objects/profile-key.vo';
import type { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import type { StationUses } from '@configuration/domain/value-objects/station-uses.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { ImmutableFieldError } from '@shared-kernel/domain/exceptions/immutable-field.error';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { ChangeActor } from '@shared-kernel/domain/value-objects/change-actor.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

interface Props {
  readonly id: HarnessProfileId;
  readonly teamId: TeamId;
  readonly key: ProfileKey;
  readonly settings: ProfileSettings;
  readonly version: number;
}

interface State extends Props {
  readonly deleted: boolean;
}

export interface ParsedProfile {
  readonly key: ProfileKey;
  readonly settings: ProfileSettings;
}

const rejectMissing = (
  parsed: ParsedProfile,
  existing: readonly SecretName[],
): void => {
  const missing = missingSecrets(parsed.settings, existing);

  if (missing.length > 0) {
    throw new MissingSecretsError(parsed.key.value, missing);
  }
};

export class HarnessProfile extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static create(
    input: ParsedProfile & {
      id: HarnessProfileId;
      teamId: TeamId;
      by: ChangeActor;
      existingSecrets: readonly SecretName[];
    },
  ): HarnessProfile {
    rejectMissing(input, input.existingSecrets);

    const created = new HarnessProfile({
      id: input.id,
      teamId: input.teamId,
      key: input.key,
      settings: input.settings,
      version: 0,
      deleted: false,
    });

    created.record(
      new HarnessProfileCreated(
        created.id,
        created.teamId,
        created.key,
        ConfigurationChange.created(created.whatChanged, input.by),
      ),
    );

    return created;
  }

  static rehydrate(input: Props): HarnessProfile {
    if (input.version < 1) {
      throw new InconsistentStateError(
        'harness profile',
        'was stored without a version',
      );
    }

    return new HarnessProfile({ ...input, deleted: false });
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new HarnessProfileVersionConflictError(this.key.value);
    }
  }

  update(
    parsed: ParsedProfile,
    by: ChangeActor,
    existingSecrets: readonly SecretName[],
  ): HarnessProfile {
    this.guardLive();

    if (!parsed.key.equals(this.key)) {
      const because = `cannot be renamed to ${parsed.key.value}. Please replace it instead`;

      throw new ImmutableFieldError(
        'key',
        because,
        `Harness profile ${this.key.value} ${because}.`,
      );
    }

    rejectMissing(parsed, existingSecrets);

    const updated = this.with({ settings: parsed.settings });

    updated.record(
      new HarnessProfileUpdated(
        this.id,
        this.teamId,
        this.key,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return updated;
  }

  delete(named: StationUses, by: ChangeActor): HarnessProfile {
    this.guardLive();

    const using = named.of(this.key);

    if (!using.isEmpty) {
      throw new HarnessProfileInUseError(this.key.value, using);
    }

    return this.cascadeDelete(by);
  }

  cascadeDelete(by: ChangeActor): HarnessProfile {
    this.guardLive();

    const deleted = this.with({ deleted: true });

    deleted.record(
      new HarnessProfileDeleted(
        this.id,
        this.teamId,
        this.key,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return deleted;
  }

  get id(): HarnessProfileId {
    return this.state.id;
  }

  get teamId(): TeamId {
    return this.state.teamId;
  }

  get key(): ProfileKey {
    return this.state.key;
  }

  get settings(): ProfileSettings {
    return this.state.settings;
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

  private get whatChanged() {
    return {
      resource: 'harness-profile' as const,
      id: this.id.value,
      key: this.key.value,
    };
  }

  private with(change: Partial<State>): HarnessProfile {
    const next = new HarnessProfile({ ...this.state, ...change });

    next.inheritEvents(this);

    return next;
  }

  private guardLive(): void {
    if (this.isDeleted) {
      throw new InconsistentStateError(
        'harness profile',
        'was changed after it was deleted',
      );
    }
  }
}
