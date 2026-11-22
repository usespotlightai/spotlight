import type { DecisionInput } from '@change-review/application/commands/record-run-decisions.command';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import {
  FieldPath,
  type FieldSegment,
} from '@shared-kernel/domain/value-objects/field-path.vo';

type Fields = Readonly<Record<string, unknown>>;

type TextField = 'kind' | 'title' | 'why';

type TextsField = 'alternatives' | 'paths';

export type DecisionsInput =
  | { readonly decisions: readonly DecisionInput[] }
  | { readonly problems: readonly ConfigurationProblem[] };

const problemAt = (
  segments: readonly FieldSegment[],
  reason: string,
): ConfigurationProblem =>
  ConfigurationProblem.of({ path: '', at: FieldPath.of(segments), reason });

const fieldsOf = (value: unknown): Fields | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Fields)
    : null;

const textAt = (
  fields: Fields,
  field: TextField,
  at: number,
  problems: ConfigurationProblem[],
): string => {
  const value = fields[field];

  if (typeof value !== 'string') {
    problems.push(problemAt(['decisions', at, field], 'must be a string'));
    return '';
  }

  return value;
};

const textsAt = (
  fields: Fields,
  field: TextsField,
  at: number,
  problems: ConfigurationProblem[],
): string[] => {
  const value = fields[field] ?? [];

  if (!Array.isArray(value) || value.some((each) => typeof each !== 'string')) {
    problems.push(
      problemAt(['decisions', at, field], 'must be a list of strings'),
    );
    return [];
  }

  return value as string[];
};

const decisionAt = (
  raw: unknown,
  at: number,
  problems: ConfigurationProblem[],
): DecisionInput => {
  const fields = fieldsOf(raw);

  if (!fields) {
    problems.push(problemAt(['decisions', at], 'must be an object'));
    return { kind: '', title: '', why: '', alternatives: [], paths: [] };
  }

  return {
    kind: textAt(fields, 'kind', at, problems),
    title: textAt(fields, 'title', at, problems),
    why: textAt(fields, 'why', at, problems),
    alternatives: textsAt(fields, 'alternatives', at, problems),
    paths: textsAt(fields, 'paths', at, problems),
  };
};

/** Reads the decisions a runner sends, or what makes the body the wrong shape. Each decision checks its own rules. */
export const decisionsInput = (body: unknown): DecisionsInput => {
  const raw = fieldsOf(body)?.decisions;

  if (!Array.isArray(raw)) {
    return {
      problems: [problemAt(['decisions'], 'must be a list of decisions')],
    };
  }

  const problems: ConfigurationProblem[] = [];
  const decisions = raw.map((each, at) => decisionAt(each, at, problems));

  return problems.length > 0 ? { problems } : { decisions };
};
