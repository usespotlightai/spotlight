import type { HarnessNote } from '@work/application/contracts/harness-profile.contract';
import type {
  HarnessSettings,
  PermissionRuleParts,
} from '@work/domain/value-objects/ready-profile';

export interface SetupFile {
  readonly path: string;
  readonly text: string;
}

export interface TranslatedProfile {
  readonly files: readonly SetupFile[];
  readonly env: Readonly<Record<string, string>>;
  readonly config: Readonly<Record<string, unknown>>;
  readonly session: Readonly<Record<string, unknown>> | null;
  readonly warnings: readonly HarnessNote[];
}

type NativeFormat = 'json' | 'toml';

export interface ProfileTranslator {
  readonly native: NativeFormat;
  translate(profile: HarnessSettings): TranslatedProfile;
}

type Json = Record<string, unknown>;

export const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export interface Layered {
  readonly value: Json;
  readonly replaced: readonly (readonly string[])[];
}

export const layered = (
  under: Json,
  over: Json,
  at: string[] = [],
): Layered => {
  const value: Json = { ...under };
  const replaced: (readonly string[])[] = [];

  for (const [key, given] of Object.entries(over)) {
    const held = value[key];

    if (isObject(held) && isObject(given)) {
      const deeper = layered(held, given, [...at, key]);
      value[key] = deeper.value;
      replaced.push(...deeper.replaced);
    } else {
      if (key in value) {
        replaced.push([...at, key]);
      }
      value[key] = given;
    }
  }

  return { value, replaced };
};

export const nativeObject = (
  profile: HarnessSettings,
  harness: string,
): Json => {
  const given = profile.native[harness];

  return isObject(given) ? given : {};
};

export const noteOn = (
  harness: string,
  rule: PermissionRuleParts,
  reason: string,
): HarnessNote => ({
  about: 'rule',
  harness,
  rule: { decision: rule.decision, kind: rule.kind, pattern: rule.pattern },
  reason,
});

export const noteOnNative = (
  harness: string,
  path: readonly string[],
  reason: string,
): HarnessNote => ({ about: 'native', harness, path, reason });

export const jsonFile = (path: string, value: Json): SetupFile => ({
  path,
  text: `${JSON.stringify(value, null, 2)}\n`,
});
