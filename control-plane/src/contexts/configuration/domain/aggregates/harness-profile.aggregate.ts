import { HarnessProfileDefined } from '@configuration/domain/events/harness-profile-defined.event';
import { HarnessProfileRedefined } from '@configuration/domain/events/harness-profile-redefined.event';
import { HarnessProfileRetired } from '@configuration/domain/events/harness-profile-retired.event';
import { HarnessProfileInUseError } from '@configuration/domain/exceptions/harness-profile-in-use.error';
import { HarnessProfileKeyFixedError } from '@configuration/domain/exceptions/harness-profile-key-fixed.error';
import { HarnessProfileVersionConflictError } from '@configuration/domain/exceptions/harness-profile-version-conflict.error';
import { MissingSecretsError } from '@configuration/domain/exceptions/missing-secrets.error';
import { missingSecrets } from '@configuration/domain/services/missing-secrets';
import type { HarnessProfileId } from '@configuration/domain/value-objects/harness-profile-id.vo';
import type { ProfileKey } from '@configuration/domain/value-objects/profile-key.vo';
import type { ProfileSettings } from '@configuration/domain/value-objects/profile-settings.vo';
import type { StationUses } from '@configuration/domain/value-objects/station-uses.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
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
  readonly retired: boolean;
}

export interface ReadProfile {
  readonly key: ProfileKey;
  readonly settings: ProfileSettings;
}

const rejectMissing = (
  read: ReadProfile,
  existing: readonly SecretName[],
): void => {
  const missing = missingSecrets(read.settings, existing);

  if (missing.length > 0) {
    throw new MissingSecretsError(read.key.value, missing);
  }
};

export class HarnessProfile extends EventRecorder {
  private constructor(private readonly state: State) {
    super();
  }

  static define(
    input: ReadProfile & {
      id: HarnessProfileId;
      teamId: TeamId;
      by: Attribution;
      existingSecrets: readonly SecretName[];
    },
  ): HarnessProfile {
    rejectMissing(input, input.existingSecrets);

    const defined = new HarnessProfile({
      id: input.id,
      teamId: input.teamId,
      key: input.key,
      settings: input.settings,
      version: 0,
      retired: false,
    });

    defined.record(
      new HarnessProfileDefined(
        defined.id,
        defined.teamId,
        defined.key,
        ConfigurationChange.created(defined.whatChanged, input.by),
      ),
    );

    return defined;
  }

  static rehydrate(input: Props): HarnessProfile {
    if (input.version < 1) {
      throw new InconsistentStateError(
        'harness profile',
        'was kept without a version',
      );
    }

    return new HarnessProfile({ ...input, retired: false });
  }

  assertVersion(version: number): void {
    if (version !== this.version) {
      throw new HarnessProfileVersionConflictError(this.key.value);
    }
  }

  redefinedAs(
    read: ReadProfile,
    by: Attribution,
    existingSecrets: readonly SecretName[],
  ): HarnessProfile {
    this.guardLive();

    if (!read.key.equals(this.key)) {
      throw new HarnessProfileKeyFixedError(
        this.key.value,
        `cannot be renamed to ${read.key.value}. Please replace it instead`,
      );
    }

    rejectMissing(read, existingSecrets);

    const redefined = this.with({ settings: read.settings });

    redefined.record(
      new HarnessProfileRedefined(
        this.id,
        this.teamId,
        this.key,
        ConfigurationChange.updated(this.whatChanged, by),
      ),
    );

    return redefined;
  }

  retire(named: StationUses, by: Attribution): HarnessProfile {
    this.guardLive();

    const using = named.of(this.key);

    if (!using.isEmpty) {
      throw new HarnessProfileInUseError(this.key.value, using);
    }

    return this.abandon(by);
  }

  abandon(by: Attribution): HarnessProfile {
    this.guardLive();

    const retired = this.with({ retired: true });

    retired.record(
      new HarnessProfileRetired(
        this.id,
        this.teamId,
        this.key,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return retired;
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

  get isRetired(): boolean {
    return this.state.retired;
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
    if (this.isRetired) {
      throw new InconsistentStateError(
        'harness profile',
        'was changed after it was retired',
      );
    }
  }
}
