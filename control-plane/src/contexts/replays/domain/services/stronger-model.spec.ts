import {
  strongerBlockOf,
  strongerProblemsOf,
} from '@replays/domain/services/stronger-model';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { describe, expect, it } from 'vitest';

const LIVE = StationBlock.of({
  key: 'build',
  name: 'Build',
  kind: 'work',
  harness: 'claude-code',
  model: 'sonnet',
  effort: 'medium',
  prompt: 'Build it.',
});

const OFFER = {
  models: ['sonnet', 'opus'],
  efforts: ['low', 'medium', 'high', 'max'],
};

const fields = (problems: readonly { field: string }[]) =>
  problems.map((each) => each.field);

describe('strongerBlockOf', () => {
  it('replays the live block with the model or effort asked for, the rest kept', () => {
    expect(
      strongerBlockOf(LIVE, { model: 'opus', effort: null }).value,
    ).toEqual({ ...LIVE.value, model: 'opus' });
    expect(
      strongerBlockOf(LIVE, { model: null, effort: 'high' }).value,
    ).toEqual({ ...LIVE.value, effort: 'high' });
  });
});

describe('strongerProblemsOf', () => {
  it('takes a model the harness’s runners offer and an effort higher than the live one', () => {
    expect(
      strongerProblemsOf(LIVE, { model: 'opus', effort: 'max' }, OFFER),
    ).toEqual([]);
    expect(
      strongerProblemsOf(
        StationBlock.of({ key: 'build' }),
        { model: null, effort: 'medium' },
        OFFER,
      ),
    ).toEqual([]);
  });

  it('refuses asking for nothing other than the live config has', () => {
    expect(
      fields(strongerProblemsOf(LIVE, { model: null, effort: null }, OFFER)),
    ).toEqual(['model']);
    expect(
      fields(
        strongerProblemsOf(LIVE, { model: 'sonnet', effort: 'medium' }, OFFER),
      ),
    ).toEqual(['model']);
  });

  it('refuses a model nobody offers, and an effort no higher than the live one or unknown to the harness', () => {
    expect(
      fields(
        strongerProblemsOf(
          LIVE,
          { model: 'gpt-unknown', effort: 'low' },
          OFFER,
        ),
      ),
    ).toEqual(['model', 'effort']);
    expect(
      fields(strongerProblemsOf(LIVE, { model: null, effort: 'turbo' }, OFFER)),
    ).toEqual(['effort']);
  });

  it('counts a live config with no effort as its harness’s lowest, so only a higher effort is stronger', () => {
    const unset = StationBlock.of({ ...LIVE.value, effort: null });

    expect(
      fields(strongerProblemsOf(unset, { model: null, effort: 'low' }, OFFER)),
    ).toEqual(['effort']);
    expect(
      fields(
        strongerProblemsOf(unset, { model: null, effort: 'medium' }, OFFER),
      ),
    ).toEqual([]);
  });

  it('refuses a stronger model on a harness Spotlight does not know', () => {
    expect(
      fields(strongerProblemsOf(LIVE, { model: 'opus', effort: null }, null)),
    ).toEqual(['model']);
  });
});
