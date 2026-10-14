import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  bestTermShown,
  causeActionShown,
  causeMeaningShown,
  causeTitleShown,
  endingShown,
  frontierNote,
  iterationStateShown,
  noBestShown,
  objectiveNote,
  objectiveShown,
  type PullRequestReason,
  pullRequestReasonShown,
  pullRequestStateShown,
  reflectionOutcomeShown,
  searchStateShown,
  verdictShown,
  warningShown,
} from '@/lib/search-words';

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

const worded = (said: string, code: string) => {
  expect(said, code).toBeTruthy();
  expect(said, code).not.toBe(code);
  expect(said.includes('undefined'), `${code} has no words`).toBe(false);
};

const reason = (code: string): PullRequestReason => ({
  code: code as PullRequestReason['code'],
  message: '',
  attribute: null,
  expression: null,
  wanted: null,
});

describe('search words cover every code the API can answer', () => {
  it('words every state and ending of a search, and every iteration state', () => {
    for (const schema of ['SearchResponseDto', 'SearchDetailResponseDto']) {
      for (const state of codesOf(schema, 'state')) {
        worded(searchStateShown(state as never), state);
      }
      for (const ending of codesOf(schema, 'ending')) {
        worded(endingShown(ending as never), ending);
      }
    }
    for (const state of codesOf('SearchIterationResponseDto', 'state')) {
      worded(iterationStateShown(state as never), state);
    }
  });

  it('words every state of a config pull request and every reason it was refused', () => {
    for (const schema of [
      'CandidatePullRequestResponseDto',
      'ConfigPullRequestResponseDto',
    ]) {
      for (const state of codesOf(schema, 'state')) {
        worded(pullRequestStateShown(state as never), state);
      }
    }
    for (const code of codesOf('ConfigPullRequestReasonResponseDto', 'code')) {
      worded(pullRequestReasonShown(reason(code)), code);
    }
  });

  it('words every verdict of a replay check, and every reason it went undecided', () => {
    for (const verdict of codesOf('ReplayCheckResponseDto', 'verdict')) {
      worded(verdictShown(verdict as never), verdict);
    }
    for (const why of codesOf('ReplayCheckResponseDto', 'undecidedBecause')) {
      worded(verdictShown('undecided', why as never), why);
    }
  });

  it('words every warning a search estimate can give', () => {
    worded(warningShown({ kind: 'noise-unmeasured' }), 'noise-unmeasured');
    worded(
      warningShown({
        kind: 'noisy',
        spread: 0.2,
        minGain: 0.05,
        suggestedRepeats: 5,
        neededRepeats: 5,
      }),
      'noisy',
    );
    worded(warningShown({ kind: 'saturated', rate: 0.97 }), 'saturated');
    worded(
      warningShown({ kind: 'judge-unstable', agreement: 0.6, compared: 10 }),
      'judge-unstable',
    );
    worded(
      warningShown({ kind: 'flaky-checks', flaky: 2, rechecked: 9 }),
      'flaky-checks',
    );
    worded(
      warningShown({
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
      worded(objectiveShown(objective as never), objective);
      worded(objectiveNote(objective as never), objective);
      worded(bestTermShown(objective as never), objective);
      worded(frontierNote(objective as never), objective);
      worded(noBestShown(objective as never), objective);
    }
  });

  it('words every cause a reflection can find, with what a person can do', () => {
    for (const cause of codesOf('SearchCauseResponseDto', 'cause')) {
      worded(causeTitleShown(cause as never), cause);
      worded(causeMeaningShown(cause as never), cause);
      worded(causeActionShown(cause as never), cause);
    }
    for (const outcome of codesOf('SearchReflectionResponseDto', 'outcome')) {
      worded(reflectionOutcomeShown(outcome as never), outcome);
    }
  });
});
