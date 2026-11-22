import type {
  DeclaredService,
  ServiceHealth,
} from '@work/domain/services/compose-services';
import { parse } from 'yaml';

/** The file beside a Compose file that Compose fills its ${NAME}s in from. */
export const COMPOSE_ENV_FILE = '.env';

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const scalar = (value: unknown): string | null =>
  typeof value === 'string' ||
  typeof value === 'number' ||
  typeof value === 'boolean'
    ? String(value)
    : null;

/** Reads KEY=value lines, as Compose reads the .env file beside a Compose file. */
export const envFileOf = (text: string): ReadonlyMap<string, string> => {
  const values = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const match = /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(
      trimmed,
    );
    if (!match) {
      continue;
    }
    const [, key, raw] = match as unknown as [string, string, string];
    const quoted = /^(['"])(.*)\1$/.exec(raw);
    values.set(key, quoted ? (quoted[2] ?? '') : raw.replace(/\s+#.*$/, ''));
  }
  return values;
};

/**
 * Fills in ${NAME}, ${NAME:-default}, ${NAME-default} and $NAME from the .env file, as Compose does, and $$ as a
 * plain $. A name the file does not set reads as its default, or as nothing.
 */
export const interpolated = (
  text: string,
  env: ReadonlyMap<string, string>,
): string =>
  text.replace(
    /\$\$|\$\{([A-Za-z_][A-Za-z0-9_]*)(?:(:?[-?])([^}]*))?\}|\$([A-Za-z_][A-Za-z0-9_]*)/g,
    (
      whole,
      braced?: string,
      operator?: string,
      fallback?: string,
      bare?: string,
    ) => {
      if (whole === '$$') {
        return '$';
      }
      const name = braced ?? bare ?? '';
      const value = env.get(name);
      const unset =
        value === undefined || (operator?.startsWith(':') && !value);
      if (unset && operator?.endsWith('-')) {
        return fallback ?? '';
      }
      return value ?? '';
    },
  );

/** Splits a command written as one string as a shell would, keeping quoted words whole. */
export const words = (command: string): string[] => {
  const found: string[] = [];
  let current = '';
  let quote: string | null = null;
  let started = false;

  for (const char of command) {
    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      started = true;
    } else if (/\s/.test(char)) {
      if (started) {
        found.push(current);
        current = '';
        started = false;
      }
    } else {
      current += char;
      started = true;
    }
  }
  if (started) {
    found.push(current);
  }
  return found;
};

const DURATION_UNITS: Record<string, number> = {
  us: 0.001,
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
};

/** Reads a Compose duration such as 10s or 1m30s, in whole milliseconds. */
export const durationMs = (value: unknown): number | null => {
  const text = scalar(value);
  if (text === null || !/^(\d+(\.\d+)?(us|ms|s|m|h))+$/.test(text)) {
    return null;
  }
  let total = 0;
  for (const [, amount, unit] of text.matchAll(
    /(\d+(?:\.\d+)?)(us|ms|s|m|h)/g,
  )) {
    total += Number(amount) * (DURATION_UNITS[unit] ?? 0);
  }
  return Math.round(total);
};

const commandOf = (value: unknown): string[] | null => {
  if (typeof value === 'string') {
    return words(value);
  }
  if (Array.isArray(value)) {
    const parts = value.map(scalar);
    return parts.every((each) => each !== null) ? parts : null;
  }
  return null;
};

const envOf = (
  value: unknown,
): { readonly name: string; readonly value: string }[] => {
  const pairs: [string, string][] = [];
  if (Array.isArray(value)) {
    for (const each of value) {
      const text = scalar(each);
      if (text === null) {
        continue;
      }
      const at = text.indexOf('=');
      if (at > 0) {
        pairs.push([text.slice(0, at), text.slice(at + 1)]);
      }
    }
  } else if (isObject(value)) {
    for (const [name, raw] of Object.entries(value)) {
      const text = raw === null ? null : scalar(raw);
      if (text !== null) {
        pairs.push([name, text]);
      }
    }
  }
  return pairs.map(([name, each]) => ({ name, value: each }));
};

type Health = ServiceHealth;

const NO_HEALTH_CHECK: Health = { test: ['NONE'] };

/** Reads a healthcheck: undefined where the image's own check counts. */
const healthOf = (value: unknown): Health | undefined => {
  if (!isObject(value)) {
    return undefined;
  }
  if (value.disable === true) {
    return NO_HEALTH_CHECK;
  }

  let test: string[] | null = null;
  if (typeof value.test === 'string') {
    test = ['CMD-SHELL', value.test];
  } else if (Array.isArray(value.test)) {
    test = commandOf(value.test);
  }
  if (test?.[0] === 'NONE') {
    return NO_HEALTH_CHECK;
  }
  if (!test || test.length === 0) {
    return undefined;
  }

  const timed = (
    key: 'intervalMs' | 'timeoutMs' | 'startPeriodMs',
    raw: unknown,
  ) => {
    const ms = durationMs(raw);
    return ms === null ? {} : { [key]: ms };
  };
  const retries =
    typeof value.retries === 'number' &&
    Number.isInteger(value.retries) &&
    value.retries >= 0
      ? { retries: value.retries }
      : {};

  return {
    test,
    ...timed('intervalMs', value.interval),
    ...timed('timeoutMs', value.timeout),
    ...timed('startPeriodMs', value.start_period),
    ...retries,
  };
};

const dependsOnOf = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.flatMap((each) => (typeof each === 'string' ? [each] : []));
  }
  return isObject(value) ? Object.keys(value) : [];
};

/** Fills in the ${NAME}s of every value, never of a key, as Compose does once the file is parsed. */
const interpolatedValues = (
  value: unknown,
  env: ReadonlyMap<string, string>,
): unknown => {
  if (typeof value === 'string') {
    return interpolated(value, env);
  }
  if (Array.isArray(value)) {
    return value.map((each) => interpolatedValues(each, env));
  }
  if (isObject(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, each]) => [
        key,
        interpolatedValues(each, env),
      ]),
    );
  }
  return value;
};

/**
 * Reads the services a Compose file declares, with its anchors and merge keys, filling in its ${NAME}s from the
 * .env file beside it once the file is parsed, as Compose does, so a value can hold anything. It translates the
 * file's format and decides nothing: which services a run starts is the domain's to say. Null where the file is
 * not YAML.
 */
export const declaredServicesOf = (
  text: string,
  env: ReadonlyMap<string, string> = new Map(),
): DeclaredService[] | null => {
  let document: unknown;
  try {
    document = interpolatedValues(parse(text, { merge: true }), env);
  } catch {
    return null;
  }
  if (!isObject(document) || !isObject(document.services)) {
    return [];
  }

  return Object.entries(document.services).flatMap(([name, raw]) =>
    isObject(raw)
      ? [
          {
            name,
            image: typeof raw.image === 'string' ? raw.image : null,
            builds: raw.build !== undefined,
            profiled: raw.profiles !== undefined,
            command: raw.command === undefined ? null : commandOf(raw.command),
            env: envOf(raw.environment),
            health: healthOf(raw.healthcheck) ?? null,
            dependsOn: dependsOnOf(raw.depends_on),
          },
        ]
      : [],
  );
};
