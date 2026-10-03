import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { EntryReasonResponseDto } from '@/lib/api';
import {
  checksShown,
  gainVerdictShown,
  reasonShown,
  refusalShown,
  resultShown,
  stateShown,
  uncomparedShown,
  unpairedShown,
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

const worded = (said: string, code: string) => {
  expect(said, code).toBeTruthy();
  expect(said, code).not.toBe(code);
  expect(said.endsWith(`: ${code}`), `${code} has no words`).toBe(false);
};

describe('replay words cover every code the API can answer', () => {
  it('words every reason a change was not judged side by side', () => {
    for (const code of codesOf('EntryPairResponseDto', 'unpaired')) {
      worded(unpairedShown(code as never), code);
    }
  });

  it('words every reason, and every detail a reason carries as a code', () => {
    for (const code of codesOf('EntryReasonResponseDto', 'code')) {
      worded(reasonShown(reason(code as EntryReasonResponseDto['code'])), code);
    }
    for (const skip of codesOf('EntryChecksResponseDto', 'why')) {
      worded(reasonShown(reason('check-skipped', skip)), skip);
      worded(
        checksShown({ state: 'unchecked', failedAt: [], why: skip as never }),
        skip,
      );
    }
    for (const refusal of codesOf('ReplayEntryResponseDto', 'refusal')) {
      worded(reasonShown(reason('unreplayable', refusal)), refusal);
      worded(refusalShown(refusal as never), refusal);
    }
    for (const failure of codesOf('ReplayEntryResponseDto', 'failure')) {
      worded(reasonShown(reason('run-failed', failure)), failure);
    }
    for (const unjudged of codesOf('EntryJudgeResponseDto', 'unjudged')) {
      worded(reasonShown(reason('unjudged', unjudged)), unjudged);
    }
  });

  it('words every state, result, check state and reason a score went uncompared', () => {
    for (const state of codesOf('ReplayResponseDto', 'state')) {
      worded(stateShown(state as never), state);
    }
    for (const result of codesOf('ReplayEntryResponseDto', 'result')) {
      expect(resultShown(result as never), result).toBeTruthy();
    }
    for (const state of codesOf('EntryChecksResponseDto', 'state')) {
      expect(
        checksShown({ state: state as never, failedAt: [], why: null }),
        state,
      ).toBeTruthy();
    }
    for (const why of codesOf(
      'EntryComparisonResponseDto',
      'scoreUncompared',
    )) {
      worded(uncomparedShown(why as never), why);
    }
  });

  it('words every verdict a gain reading can give', () => {
    for (const verdict of codesOf('GainReadingResponseDto', 'verdict')) {
      worded(gainVerdictShown(verdict as never), verdict);
    }
  });
});
