import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatBestTerm,
  formatCauseAction,
  formatCauseMeaning,
  formatCauseTitle,
  formatCheckResult,
  formatIterationState,
  formatNoBest,
  formatObjective,
  formatPullRequestReason,
  formatPullRequestState,
  formatReflectionResult,
  formatSearchState,
  formatStopReason,
  formatWarning,
  frontierNote,
  objectiveNote,
  type PullRequestReason,
} from '@/lib/search-words';
import { tooltipText } from '@/lib/tooltip-note';

type Schema = {
  readonly properties: Readonly<
    Record<string, { readonly enum?: readonly (string | null)[] }>
  >;
};

const schemas = (
  JSON.parse(
    readFileSync(
      resolve(__dirname, '../../../control-plane/openapi.json'),
      'utf8',
    ),
  ) as { components: { schemas: Readonly<Record<string, Schema>> } }
).components.schemas;

const codesOf = (schema: string, property: string): string[] => {
  const codes = schemas[schema]?.properties[property]?.enum;

  if (!codes) {
    throw new Error(`${schema}.${property} names no codes`);
  }

  return codes.filter((each): each is string => each !== null);
};

const worded = (text: string, code: string) => {
  expect(text, code).toBeTruthy();
  expect(text, code).not.toBe(code);
  expect(text.includes('undefined'), `${code} has no words`).toBe(false);
};

const reason = (code: string): PullRequestReason => ({
  code: code as PullRequestReason['code'],
  message: '',
  attribute: null,
  expression: null,
  wanted: null,
});

describe('search words cover every code the API can answer', () => {
  it('words every state and stop reason of a search, and every iteration state', () => {
    for (const schema of ['SearchResponseDto', 'SearchDetailResponseDto']) {
      for (const state of codesOf(schema, 'state')) {
        worded(formatSearchState(state as never), state);
      }
      for (const reason of codesOf(schema, 'stopReason')) {
        worded(formatStopReason(reason as never), reason);
      }
    }
    for (const state of codesOf('SearchIterationResponseDto', 'state')) {
      worded(formatIterationState(state as never), state);
    }
  });

  it('words every state of a config pull request and every reason it failed', () => {
    for (const schema of [
      'CandidatePullRequestResponseDto',
      'ConfigPullRequestResponseDto',
    ]) {
      for (const state of codesOf(schema, 'state')) {
        worded(formatPullRequestState(state as never), state);
      }
    }
    for (const code of codesOf('ConfigPullRequestReasonResponseDto', 'code')) {
      worded(formatPullRequestReason(reason(code)), code);
    }
  });

  it('words every result of a replay check, and every reason it went undecided', () => {
    for (const result of codesOf('ReplayCheckResponseDto', 'result')) {
      worded(formatCheckResult(result as never), result);
    }
    for (const why of codesOf('ReplayCheckResponseDto', 'undecidedBecause')) {
      worded(formatCheckResult('undecided', why as never), why);
    }
  });

  it('words every warning a search estimate can give', () => {
    worded(formatWarning({ kind: 'noise-unmeasured' }), 'noise-unmeasured');
    worded(
      formatWarning({
        kind: 'noisy',
        spread: 0.2,
        minGain: 0.05,
        suggestedRepeats: 5,
        neededRepeats: 5,
      }),
      'noisy',
    );
    worded(formatWarning({ kind: 'saturated', rate: 0.97 }), 'saturated');
    worded(
      formatWarning({ kind: 'judge-unstable', agreement: 0.6, compared: 10 }),
      'judge-unstable',
    );
    worded(
      formatWarning({ kind: 'flaky-checks', flaky: 2, rechecked: 9 }),
      'flaky-checks',
    );
    worded(
      formatWarning({
        kind: 'no-headroom',
        gain: 0,
        low: -0.1,
        high: 0.1,
        answered: 6,
      }),
      'no-headroom',
    );
    expect(
      [
        'NoiseUnmeasuredWarningResponseDto',
        'NoisyWarningResponseDto',
        'SaturatedWarningResponseDto',
        'JudgeUnstableWarningResponseDto',
        'FlakyChecksWarningResponseDto',
        'NoHeadroomWarningResponseDto',
      ]
        .flatMap((schema) => codesOf(schema, 'kind'))
        .sort(),
    ).toEqual([
      'flaky-checks',
      'judge-unstable',
      'no-headroom',
      'noise-unmeasured',
      'noisy',
      'saturated',
    ]);
  });

  it('words every objective a search can aim for', () => {
    for (const objective of codesOf('SearchEstimateResponseDto', 'objective')) {
      worded(formatObjective(objective as never), objective);
      worded(objectiveNote(objective as never), objective);
      worded(formatBestTerm(objective as never), objective);
      worded(tooltipText(frontierNote(objective as never)), objective);
      worded(formatNoBest(objective as never), objective);
    }
  });

  it('words every cause a reflection can find, with what a person can do', () => {
    for (const cause of codesOf('FailureCauseResponseDto', 'cause')) {
      worded(formatCauseTitle(cause as never), cause);
      worded(formatCauseMeaning(cause as never), cause);
      worded(formatCauseAction(cause as never), cause);
    }
    for (const result of codesOf('SearchReflectionResponseDto', 'result')) {
      worded(formatReflectionResult(result as never), result);
    }
  });
});
