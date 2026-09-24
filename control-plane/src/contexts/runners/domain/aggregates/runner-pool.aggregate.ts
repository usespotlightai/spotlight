import { RunnerPoolDefined } from '@runners/domain/events/runner-pool-defined.event';
import { RunnerPoolRedefined } from '@runners/domain/events/runner-pool-redefined.event';
import { RunnerPoolRetired } from '@runners/domain/events/runner-pool-retired.event';
import { InvalidRunnerPoolError } from '@runners/domain/exceptions/invalid-runner-pool.error';
import { RunnerPoolFixedError } from '@runners/domain/exceptions/runner-pool-fixed.error';
import { RunnerPoolMovedOnError } from '@runners/domain/exceptions/runner-pool-moved-on.error';
import type { MaxRuns } from '@runners/domain/value-objects/max-runs.vo';
import {
  type PoolAccess,
  type PoolMode,
  PullAccess,
  PushAccess,
} from '@runners/domain/value-objects/pool-access.vo';
import type { PoolKey } from '@runners/domain/value-objects/pool-key.vo';
import type { ProvisionSecret } from '@runners/domain/value-objects/provision-secret.vo';
import type { ProvisionUrl } from '@runners/domain/value-objects/provision-url.vo';
import type { RunnerLabels } from '@runners/domain/value-objects/runner-labels.vo';
import { RunnerPoolChangeDetail } from '@runners/domain/value-objects/runner-pool-change-detail.vo';
import type { RunnerPoolId } from '@runners/domain/value-objects/runner-pool-id.vo';
import { EventRecorder } from '@shared-kernel/domain/event-recorder';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Attribution } from '@shared-kernel/domain/value-objects/attribution.vo';
import { ConfigurationChange } from '@shared-kernel/domain/value-objects/configuration-change.vo';
import type { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export interface PoolDefinition {
  readonly key: PoolKey;
  readonly labels: RunnerLabels;
  readonly maxRuns: MaxRuns | null;
}

export type GivenAccess =
  | {
      readonly mode: 'pull';
      readonly tokenHash: TokenHash | null;
      readonly tokenVersion: number | null;
    }
  | {
      readonly mode: 'push';
      readonly url: ProvisionUrl;
      readonly secret: ProvisionSecret | null;
      readonly secretVersion: number | null;
    };

const SECRET_FIELD = 'provision.secret';

export class RunnerPool extends EventRecorder {
  private constructor(
    readonly id: RunnerPoolId,
    readonly workspaceId: WorkspaceId,
    readonly key: PoolKey,
    readonly labels: RunnerLabels,
    readonly maxRuns: MaxRuns | null,
    readonly access: PoolAccess,
    readonly version: number,
    readonly isRetired: boolean,
  ) {
    super();
  }

  static define(
    input: PoolDefinition & {
      id: RunnerPoolId;
      workspaceId: WorkspaceId;
      access: GivenAccess;
      by: Attribution;
    },
  ): RunnerPool {
    const defined = new RunnerPool(
      input.id,
      input.workspaceId,
      input.key,
      input.labels,
      input.maxRuns,
      RunnerPool.firstAccess(input.access),
      0,
      false,
    );

    defined.record(
      new RunnerPoolDefined(
        defined.id,
        defined.workspaceId,
        defined.key,
        ConfigurationChange.created(
          defined.whatChanged,
          input.by,
          RunnerPoolChangeDetail.defined(defined.mode),
        ),
      ),
    );

    return defined;
  }

  static rehydrate(
    input: PoolDefinition & {
      id: RunnerPoolId;
      workspaceId: WorkspaceId;
      access: PoolAccess;
      version: number;
    },
  ): RunnerPool {
    if (!Number.isInteger(input.version) || input.version < 0) {
      throw new InconsistentStateError(
        'runner pool',
        `has an impossible version (${input.version})`,
      );
    }

    return new RunnerPool(
      input.id,
      input.workspaceId,
      input.key,
      input.labels,
      input.maxRuns,
      input.access,
      input.version,
      false,
    );
  }

  private static firstAccess(given: GivenAccess): PoolAccess {
    if (given.mode === 'pull') {
      if (!given.tokenHash) {
        throw new InconsistentStateError(
          'runner pool',
          'was defined to pull with no token to claim with',
        );
      }

      return PullAccess.of(given.tokenHash, given.tokenVersion);
    }

    if (!given.secret) {
      throw new InvalidRunnerPoolError(
        SECRET_FIELD,
        'is given when a pool that provisions is defined, to sign its calls with',
      );
    }

    return PushAccess.of(given.url, given.secret, given.secretVersion);
  }

  get mode(): PoolMode {
    return this.access.mode;
  }

  get tokenHash(): TokenHash | null {
    return this.access.mode === 'pull' ? this.access.tokenHash : null;
  }

  get provision(): PushAccess | null {
    return this.access.mode === 'push' ? this.access : null;
  }

  belongsTo(workspaceId: WorkspaceId): boolean {
    return this.workspaceId.equals(workspaceId);
  }

  hasRoomFor(running: number): boolean {
    return !this.isRetired && (this.maxRuns?.allows(running) ?? true);
  }

  expecting(version: number): void {
    if (version !== this.version) {
      throw new RunnerPoolMovedOnError(this.id.value);
    }
  }

  redefinedAs(
    definition: PoolDefinition,
    given: GivenAccess,
    by: Attribution,
  ): RunnerPool {
    this.guardStanding();

    if (!definition.key.equals(this.key)) {
      throw new RunnerPoolFixedError(
        this.key.value,
        'key',
        `keeps its key for its whole life, since it is the pool's address; replace it to key a pool ${definition.key.value}`,
      );
    }

    if (given.mode !== this.mode) {
      throw new RunnerPoolFixedError(
        this.key.value,
        'provision',
        `${this.mode === 'push' ? 'provisions' : 'is pulled from'} for its whole life; replace it to ${given.mode === 'push' ? 'provision' : 'pull'} instead`,
      );
    }

    const access = this.nextAccess(given);
    const redefined = this.reshaped({
      labels: definition.labels,
      maxRuns: definition.maxRuns,
      access,
    });

    redefined.record(
      new RunnerPoolRedefined(
        this.id,
        this.workspaceId,
        this.key,
        ConfigurationChange.updated(
          this.whatChanged,
          by,
          RunnerPoolChangeDetail.redefined(this.mode, {
            rekeyed:
              access.mode === 'pull' &&
              this.access.mode === 'pull' &&
              !access.tokenHash.equals(this.access.tokenHash),
            secretRotated: given.mode === 'push' && given.secret !== null,
          }),
        ),
      ),
    );

    return redefined;
  }

  retired(by: Attribution): RunnerPool {
    this.guardStanding();

    const retired = this.reshaped({ retired: true });

    retired.record(
      new RunnerPoolRetired(
        this.id,
        this.workspaceId,
        this.key,
        ConfigurationChange.deleted(this.whatChanged, by),
      ),
    );

    return retired;
  }

  private nextAccess(given: GivenAccess): PoolAccess {
    if (given.mode === 'pull' && this.access.mode === 'pull') {
      if (!given.tokenHash && this.access.rotatesOn(given.tokenVersion)) {
        throw new InvalidRunnerPoolError(
          'token',
          'is given whenever tokenVersion changes, since that is how it is rotated; Spotlight issues one only when a pool is created without it',
        );
      }

      return PullAccess.of(
        given.tokenHash ?? this.access.tokenHash,
        given.tokenVersion,
      );
    }

    if (given.mode === 'push' && this.access.mode === 'push') {
      if (!given.secret && this.access.rotatesOn(given.secretVersion)) {
        throw new InvalidRunnerPoolError(
          SECRET_FIELD,
          'is given again whenever provision.secretVersion changes, since that is how it is rotated',
        );
      }

      return PushAccess.of(
        given.url,
        given.secret ?? this.access.secret,
        given.secretVersion,
      );
    }

    throw new InconsistentStateError(
      'runner pool',
      'was given access in a mode it does not have',
    );
  }

  private get whatChanged() {
    return {
      resource: 'runner-pool' as const,
      id: this.id.value,
      key: this.key.value,
    };
  }

  private guardStanding(): void {
    if (this.isRetired) {
      throw new InconsistentStateError(
        'runner pool',
        'was changed after it was retired',
      );
    }
  }

  private reshaped(part: {
    labels?: RunnerLabels;
    maxRuns?: MaxRuns | null;
    access?: PoolAccess;
    retired?: boolean;
  }): RunnerPool {
    const next = new RunnerPool(
      this.id,
      this.workspaceId,
      this.key,
      part.labels ?? this.labels,
      part.maxRuns !== undefined ? part.maxRuns : this.maxRuns,
      part.access ?? this.access,
      this.version,
      part.retired ?? this.isRetired,
    );

    next.inheritEvents(this);

    return next;
  }
}
