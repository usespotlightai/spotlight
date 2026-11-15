import { createHash } from 'node:crypto';

import {
  type StationIdentityFacts,
  stationHashesOf,
} from '@replays/domain/services/station-identity';
import { describe, expect, it } from 'vitest';

const sha256 = (text: string): string =>
  createHash('sha256').update(text).digest('hex');

const FACTS: StationIdentityFacts = {
  fingerprint: 'a'.repeat(64),
  handoverWords: ['ship'],
  ends: false,
  check: 'npm test',
  diffs: true,
  judge: null,
  rubricHash: null,
  trialTools: [],
};

describe('stationHashesOf', () => {
  it('behaves differently when a replay of it can call other tools', () => {
    const without = stationHashesOf(FACTS, sha256);
    const withTool = stationHashesOf(
      { ...FACTS, trialTools: ['sentry.get-latest-event'] },
      sha256,
    );

    expect(withTool.behaviour).not.toBe(without.behaviour);
    expect(withTool.scoring).not.toBe(without.scoring);
  });

  it('behaves the same when only how it is scored changes', () => {
    expect(
      stationHashesOf({ ...FACTS, check: 'npm run lint' }, sha256).behaviour,
    ).toBe(stationHashesOf(FACTS, sha256).behaviour);
  });
});
