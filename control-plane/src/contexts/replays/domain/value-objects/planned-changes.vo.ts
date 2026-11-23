import { InvalidCandidateError } from '@replays/domain/exceptions/invalid-candidate.error';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';

type DependencyKind =
  | 'secret'
  | 'skill'
  | 'harness-profile'
  | 'integration'
  | 'hook';

export interface Dependency {
  readonly kind: DependencyKind;
  readonly key: string;
}

export interface PlannedHook {
  readonly key: string;
  readonly lines: readonly string[];
  readonly stations: readonly string[];
}

export interface PlannedIntegration {
  readonly key: string;
  readonly definition: Readonly<Record<string, unknown>> | null;
}

export interface PlannedChangesInput {
  readonly secrets?: readonly string[];
  readonly skills?: readonly string[];
  readonly harnessProfiles?: readonly string[];
  readonly integrations?: readonly PlannedIntegration[];
  readonly hooks?: readonly PlannedHook[];
}

const MAX_KEYS = 256;

const keysOf = (
  field: string,
  raw: readonly string[] | undefined,
): readonly string[] => {
  const plural = `${field}s`;
  const keys = [...new Set((raw ?? []).map((each) => each.trim()))].sort();

  if (keys.some((each) => each === '')) {
    throw new InvalidCandidateError(`must name each changed ${field}`);
  }
  if (keys.length > MAX_KEYS) {
    throw new InvalidCandidateError(
      `must change at most ${MAX_KEYS} ${plural} at once`,
    );
  }

  return keys;
};

const hooksOf = (
  raw: readonly PlannedHook[] | undefined,
): readonly PlannedHook[] => {
  const hooks = raw ?? [];
  const keys = keysOf(
    'hook',
    hooks.map((each) => each.key),
  );

  if (keys.length !== hooks.length) {
    throw new InvalidCandidateError('must change each hook once');
  }

  return keys.map((key) => {
    const hook = hooks.find((each) => each.key.trim() === key) as PlannedHook;

    return {
      key,
      lines: [...new Set(hook.lines)].sort(),
      stations: [...new Set(hook.stations)].sort(),
    };
  });
};

const integrationsOf = (
  raw: readonly PlannedIntegration[] | undefined,
): readonly PlannedIntegration[] => {
  const integrations = raw ?? [];
  const keys = keysOf(
    'integration',
    integrations.map((each) => each.key),
  );

  if (keys.length !== integrations.length) {
    throw new InvalidCandidateError('must change each integration once');
  }

  return keys.map((key) => ({
    key,
    definition:
      integrations.find((each) => each.key.trim() === key)?.definition ?? null,
  }));
};

export class PlannedChanges {
  private constructor(
    readonly secrets: readonly SecretName[],
    readonly skills: readonly string[],
    readonly harnessProfiles: readonly string[],
    readonly integrations: readonly PlannedIntegration[],
    readonly hooks: readonly PlannedHook[],
  ) {}

  static none(): PlannedChanges {
    return PlannedChanges.of({});
  }

  static of(input: PlannedChangesInput): PlannedChanges {
    return new PlannedChanges(
      keysOf('secret', input.secrets).map((each) => SecretName.of(each)),
      keysOf('skill', input.skills),
      keysOf('harness profile', input.harnessProfiles),
      integrationsOf(input.integrations),
      hooksOf(input.hooks),
    );
  }

  get isEmpty(): boolean {
    return this.written.every((each) => each.length === 0);
  }

  get value(): Required<PlannedChangesInput> {
    return {
      secrets: this.secrets.map((each) => each.value),
      skills: this.skills,
      harnessProfiles: this.harnessProfiles,
      integrations: this.integrations,
      hooks: this.hooks,
    };
  }

  private get written(): readonly (readonly unknown[])[] {
    return [
      this.secrets,
      this.skills,
      this.harnessProfiles,
      this.integrations,
      this.hooks,
    ];
  }
}
