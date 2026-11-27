import { ProblemException } from '@platform/http/resources/problem.exception';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

const REQUEST = 'request';

const rejectAt = (field: readonly string[], reason: string): never => {
  throw ProblemException.invalid(REQUEST, [
    ConfigurationProblem.of({ path: '', at: FieldPath.of(field), reason }),
  ]);
};

const isFields = (body: unknown): body is Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body);

export const fieldsOf = (body: unknown): Record<string, unknown> =>
  isFields(body) ? body : {};

export const textAt = (
  body: unknown,
  field: string,
  reason: string,
): string => {
  const value = fieldsOf(body)[field];

  return typeof value === 'string' ? value : rejectAt([field], reason);
};

const countAt = (
  fields: Record<string, unknown>,
  at: readonly string[],
  reason: string,
): number => {
  const count = fields[at[at.length - 1]];

  return typeof count === 'number' ? count : rejectAt(at, reason);
};

const optionalTextAt = (
  fields: Record<string, unknown>,
  at: readonly string[],
  reason: string,
): string | null => {
  const text = fields[at[at.length - 1]];

  if (text === undefined || text === null) {
    return null;
  }

  return typeof text === 'string' ? text : rejectAt(at, reason);
};

const KEYED_FIELDS = ['secrets', 'skills', 'harnessProfiles'] as const;

interface ChangedIntegrationRequest {
  readonly key: string;
  readonly definition: Readonly<Record<string, unknown>> | null;
}

interface ChangedHookRequest {
  readonly key: string;
  readonly lines: readonly string[];
  readonly stations: readonly string[];
}

type ChangedRequest = Partial<
  Record<(typeof KEYED_FIELDS)[number], readonly string[]>
> & {
  readonly integrations?: readonly ChangedIntegrationRequest[];
  readonly hooks?: readonly ChangedHookRequest[];
};

const isTexts = (value: unknown): value is readonly string[] =>
  Array.isArray(value) && value.every((each) => typeof each === 'string');

const textsAt = (
  fields: Record<string, unknown>,
  at: readonly string[],
): readonly string[] => {
  const value = fields[at[at.length - 1]];

  if (value === undefined || value === null) {
    return [];
  }

  return isTexts(value) ? value : rejectAt(at, 'Must be a list of keys.');
};

const hookAt = (hook: unknown, index: number): ChangedHookRequest => {
  const fields = fieldsOf(hook);
  const at = ['changed', 'hooks', String(index)];

  return {
    key:
      typeof fields.key === 'string'
        ? fields.key
        : rejectAt([...at, 'key'], 'Must be the key of the hook.'),
    lines: textsAt(fields, [...at, 'lines']),
    stations: textsAt(fields, [...at, 'stations']),
  };
};

const integrationAt = (
  integration: unknown,
  index: number,
): ChangedIntegrationRequest => {
  const fields = fieldsOf(integration);
  const at = ['changed', 'integrations', String(index)];
  const definition = fields.definition;

  return {
    key:
      typeof fields.key === 'string'
        ? fields.key
        : rejectAt([...at, 'key'], 'Must be the key of the integration.'),
    definition: definitionAt(definition, [...at, 'definition']),
  };
};

const MAX_DEFINITION_BYTES = 16 * 1024;

const definitionAt = (
  definition: unknown,
  at: readonly string[],
): Record<string, unknown> | null => {
  if (definition === undefined || definition === null) {
    return null;
  }

  if (!isFields(definition)) {
    return rejectAt(at, 'Must be the integration’s definition as planned.');
  }

  return Buffer.byteLength(JSON.stringify(definition)) > MAX_DEFINITION_BYTES
    ? rejectAt(at, 'Must be at most 16 KiB as JSON.')
    : definition;
};

const listAt = <T>(
  changed: Record<string, unknown>,
  field: string,
  each: (item: unknown, index: number) => T,
): readonly T[] => {
  const items = changed[field];

  if (items === undefined || items === null) {
    return [];
  }

  return Array.isArray(items)
    ? items.map(each)
    : rejectAt(['changed', field], 'Must be a list.');
};

export const changedIn = (body: unknown): ChangedRequest => {
  const changed = fieldsOf(fieldsOf(body).changed);

  return {
    ...Object.fromEntries(
      KEYED_FIELDS.map((field) => [
        field,
        textsAt(changed, ['changed', field]),
      ]),
    ),
    integrations: listAt(changed, 'integrations', integrationAt),
    hooks: listAt(changed, 'hooks', hookAt),
  };
};

export const repeatsIn = (body: unknown): number => {
  const fields = fieldsOf(body);
  const repeats = fields.repeats;

  return repeats === undefined || repeats === null
    ? 1
    : countAt(fields, ['repeats'], 'Repeats must be a number.');
};

export const referenceIn = (
  body: unknown,
): {
  readonly commit: string | null;
  readonly pullRequest: number | null;
} => {
  const reference = fieldsOf(fieldsOf(body).reference);
  const pullRequest = reference.pullRequest;

  return {
    commit: optionalTextAt(
      reference,
      ['reference', 'commit'],
      'Commit must be a hex SHA or left out.',
    ),
    pullRequest:
      pullRequest === undefined || pullRequest === null
        ? null
        : countAt(
            reference,
            ['reference', 'pullRequest'],
            'Pull request must be a number or left out.',
          ),
  };
};
