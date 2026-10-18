import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { EntryReasonResponseDto } from '@/lib/api';
import {
  formatChecks,
  formatGainSignificance,
  formatReason,
  formatResult,
  formatRunOutcome,
  formatState,
  formatUncompared,
  formatUnpaired,
  formatUnreplayableReason,
} from '@/lib/replay-words';

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

const reason = (
  code: EntryReasonResponseDto['code'],
  detail: string | null = null,
): EntryReasonResponseDto => ({ code, detail, steps: [], hunks: [] });

const worded = (text: string, code: string) => {
  expect(text, code).toBeTruthy();
  expect(text, code).not.toBe(code);
  expect(text.endsWith(`: ${code}`), `${code} has no words`).toBe(false);
};

describe('replay words cover every code the API can answer', () => {
  it('words every reason a change was not judged side by side', () => {
    for (const code of codesOf('EntryPairResponseDto', 'unpaired')) {
      worded(formatUnpaired(code as never), code);
    }
  });

  it('words every reason, and every detail a reason carries as a code', () => {
    for (const code of codesOf('EntryReasonResponseDto', 'code')) {
      worded(
        formatReason(reason(code as EntryReasonResponseDto['code'])),
        code,
      );
    }
    for (const skip of codesOf('EntryChecksResponseDto', 'why')) {
      worded(formatReason(reason('check-skipped', skip)), skip);
      worded(
        formatChecks({ state: 'unchecked', failedAt: [], why: skip as never }),
        skip,
      );
    }
    for (const code of codesOf(
      'ReplayEntryResponseDto',
      'unreplayableReason',
    )) {
      worded(formatReason(reason('unreplayable', code)), code);
      worded(formatUnreplayableReason(code as never), code);
    }
    for (const failure of codesOf('ReplayEntryResponseDto', 'failure')) {
      worded(formatReason(reason('run-failed', failure)), failure);
    }
    for (const unjudged of codesOf('EntryJudgeResponseDto', 'unjudged')) {
      worded(formatReason(reason('unjudged', unjudged)), unjudged);
    }
  });

  it('words every state, result, check state and reason a score went uncompared', () => {
    for (const state of codesOf('ReplayResponseDto', 'state')) {
      worded(formatState(state as never), state);
    }
    for (const result of codesOf('ReplayEntryResponseDto', 'result')) {
      expect(formatResult(result as never), result).toBeTruthy();
    }
    for (const state of codesOf('EntryChecksResponseDto', 'state')) {
      expect(
        formatChecks({ state: state as never, failedAt: [], why: null }),
        state,
      ).toBeTruthy();
    }
    for (const why of codesOf(
      'EntryComparisonResponseDto',
      'scoreUncompared',
    )) {
      worded(formatUncompared(why as never), why);
    }
  });

  it('words every way a set’s run can have turned out', () => {
    for (const outcome of codesOf('ReplaySetEntryResponseDto', 'outcome')) {
      worded(formatRunOutcome(outcome as never), outcome);
    }
  });

  it('words every significance a gain estimate can give', () => {
    for (const significance of codesOf(
      'GainEstimateResponseDto',
      'significance',
    )) {
      worded(formatGainSignificance(significance as never), significance);
    }
  });
});
