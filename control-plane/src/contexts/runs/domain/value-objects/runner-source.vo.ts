import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export const RUNNER_SOURCE_KINDS = ['pool', 'trust'] as const;

export type RunnerSourceKind = (typeof RUNNER_SOURCE_KINDS)[number];

export interface RunnerSourceParts {
  readonly kind: RunnerSourceKind;
  readonly key: string;
  readonly platform: boolean;
}

// The pool or trust that a run's runner came in through. The run keeps the key, so it still shows where it ran after the pool or trust is gone.
export class RunnerSource {
  private constructor(
    readonly kind: RunnerSourceKind,
    readonly key: string,
    // The platform pool that Spotlight adds to each workspace.
    readonly platform: boolean,
  ) {}

  static of(parts: RunnerSourceParts): RunnerSource {
    if (parts.key.trim().length === 0) {
      throw new InconsistentStateError('runner source', 'has no key');
    }

    if (parts.platform && parts.kind !== 'pool') {
      throw new InconsistentStateError(
        'runner source',
        'is the platform pool, yet is a trust',
      );
    }

    return new RunnerSource(parts.kind, parts.key, parts.platform);
  }

  get parts(): RunnerSourceParts {
    return { kind: this.kind, key: this.key, platform: this.platform };
  }

  equals(other: RunnerSource): boolean {
    return (
      this.kind === other.kind &&
      this.key === other.key &&
      this.platform === other.platform
    );
  }
}
