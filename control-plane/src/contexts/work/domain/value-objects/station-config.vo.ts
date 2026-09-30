import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const SHA256_HEX = /^[0-9a-f]{64}$/;

const textOrder = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

interface ConfiguredProfile {
  readonly key: string;
  readonly settings: unknown;
}

interface ConfiguredRepository {
  readonly name: string;
  readonly setup: string | null;
}

interface ConfiguredSkill {
  readonly key: string;
  readonly digest: string;
}

export interface StationConfigParts {
  readonly prompt: string | null;
  readonly harness: string;
  readonly model: string | null;
  readonly effort: string | null;
  readonly profile: ConfiguredProfile | null;
  readonly image: string | null;
  readonly repositories: readonly ConfiguredRepository[];
  readonly skills: readonly ConfiguredSkill[];
  readonly tools: readonly string[];
  readonly decisions: boolean;
  readonly memories: boolean;
}

const CONFIG_PARTS = [
  'prompt',
  'harness',
  'model',
  'effort',
  'profile',
  'image',
  'repository',
  'skill',
  'tool',
  'decisions',
  'memories',
] as const;

type ConfigPart = (typeof CONFIG_PARTS)[number];

type ConfigChangeKind = 'added' | 'removed' | 'changed';

export interface ConfigChange {
  readonly part: ConfigPart;
  readonly name: string | null;
  readonly kind: ConfigChangeKind;
  readonly was: string | null;
  readonly now: string | null;
}

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort(textOrder)
        .map((key) => [
          key,
          canonical((value as Record<string, unknown>)[key]),
        ]),
    );
  }

  return value;
};

const canonicalText = (value: unknown): string =>
  JSON.stringify(canonical(value));

const ordered = (parts: StationConfigParts): StationConfigParts => ({
  prompt: parts.prompt,
  harness: parts.harness,
  model: parts.model,
  effort: parts.effort,
  profile: parts.profile
    ? { key: parts.profile.key, settings: canonical(parts.profile.settings) }
    : null,
  image: parts.image,
  repositories: [...parts.repositories]
    .map((each) => ({ name: each.name, setup: each.setup }))
    .sort((a, b) => textOrder(a.name, b.name)),
  skills: [...parts.skills]
    .map((each) => ({ key: each.key, digest: each.digest }))
    .sort((a, b) => textOrder(a.key, b.key)),
  tools: [...new Set(parts.tools)].sort(textOrder),
  decisions: parts.decisions,
  memories: parts.memories,
});

const valueChange = (
  part: ConfigPart,
  was: string | null,
  now: string | null,
  shown = true,
): ConfigChange[] => {
  if (was === now) {
    return [];
  }

  const kind: ConfigChangeKind =
    was === null ? 'added' : now === null ? 'removed' : 'changed';

  return [
    {
      part,
      name: null,
      kind,
      was: shown ? was : null,
      now: shown ? now : null,
    },
  ];
};

const namedChanges = <T>(
  part: ConfigPart,
  earlier: readonly T[],
  later: readonly T[],
  nameOf: (each: T) => string,
  shownOf: (each: T) => string | null,
  sameOf: (one: T, other: T) => boolean,
): ConfigChange[] => {
  const names = [
    ...new Set([...earlier.map(nameOf), ...later.map(nameOf)]),
  ].sort(textOrder);

  return names.flatMap((name): ConfigChange[] => {
    const was = earlier.find((each) => nameOf(each) === name);
    const now = later.find((each) => nameOf(each) === name);

    if (!was && now) {
      return [{ part, name, kind: 'added', was: null, now: shownOf(now) }];
    }

    if (was && !now) {
      return [{ part, name, kind: 'removed', was: shownOf(was), now: null }];
    }

    if (was && now && !sameOf(was, now)) {
      return [
        { part, name, kind: 'changed', was: shownOf(was), now: shownOf(now) },
      ];
    }

    return [];
  });
};

const switched = (value: boolean): string => (value ? 'on' : 'off');

export class StationConfig {
  private constructor(
    readonly parts: StationConfigParts,
    readonly fingerprint: string,
  ) {}

  static canonical(parts: StationConfigParts): string {
    return canonicalText(ordered(parts));
  }

  static of(
    parts: StationConfigParts,
    fingerprintOf: (canonical: string) => string,
  ): StationConfig {
    const kept = ordered(parts);

    return StationConfig.rehydrate(kept, fingerprintOf(canonicalText(kept)));
  }

  static rehydrate(
    parts: StationConfigParts,
    fingerprint: string,
  ): StationConfig {
    if (!SHA256_HEX.test(fingerprint)) {
      throw new InconsistentStateError(
        'run',
        'names its station config by something other than a SHA-256',
      );
    }

    if (!parts.harness.trim()) {
      throw new InconsistentStateError(
        'run',
        'was configured without a harness',
      );
    }

    return new StationConfig(ordered(parts), fingerprint);
  }

  changesFrom(earlier: StationConfig): readonly ConfigChange[] {
    if (this.sameAs(earlier)) {
      return [];
    }

    const was = earlier.parts;
    const now = this.parts;

    return [
      ...valueChange('prompt', was.prompt, now.prompt, false),
      ...valueChange('harness', was.harness, now.harness),
      ...valueChange('model', was.model, now.model),
      ...valueChange('effort', was.effort, now.effort),
      ...(was.profile?.key !== now.profile?.key
        ? valueChange(
            'profile',
            was.profile?.key ?? null,
            now.profile?.key ?? null,
          )
        : was.profile &&
            now.profile &&
            canonicalText(was.profile.settings) !==
              canonicalText(now.profile.settings)
          ? [
              {
                part: 'profile' as const,
                name: now.profile.key,
                kind: 'changed' as const,
                was: null,
                now: null,
              },
            ]
          : []),
      ...valueChange('image', was.image, now.image),
      ...namedChanges(
        'repository',
        was.repositories,
        now.repositories,
        (each) => each.name,
        (each) => each.setup,
        (one, other) => one.setup === other.setup,
      ),
      ...namedChanges(
        'skill',
        was.skills,
        now.skills,
        (each) => each.key,
        () => null,
        (one, other) => one.digest === other.digest,
      ),
      ...namedChanges(
        'tool',
        was.tools,
        now.tools,
        (each) => each,
        () => null,
        () => true,
      ),
      ...valueChange(
        'decisions',
        switched(was.decisions),
        switched(now.decisions),
      ),
      ...valueChange(
        'memories',
        switched(was.memories),
        switched(now.memories),
      ),
    ];
  }

  sameAs(other: StationConfig): boolean {
    return this.fingerprint === other.fingerprint;
  }

  equals(other: StationConfig): boolean {
    return this.sameAs(other);
  }
}
