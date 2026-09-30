import { createHash } from 'node:crypto';
import {
  StationConfig,
  type StationConfigParts,
} from '@work/domain/value-objects/station-config.vo';
import { describe, expect, it } from 'vitest';

const sha256 = (text: string): string =>
  createHash('sha256').update(text, 'utf8').digest('hex');

const PARTS: StationConfigParts = {
  prompt: 'Review the change and say what you would change.',
  harness: 'claude-code',
  model: 'claude-sonnet-4-5',
  effort: 'high',
  profile: { key: 'careful', settings: { rules: ['be kind'], native: {} } },
  image: null,
  repositories: [{ name: 'acme/widgets', setup: 'npm ci' }],
  skills: [{ key: 'review', digest: 'a'.repeat(64) }],
  tools: ['github.comment'],
  decisions: true,
  memories: false,
};

const FINGERPRINT_BEFORE_JUDGES =
  '3d548c379d8e7d9a5be1412570a1240d8f65a876a8813260ef3ead58dbf38c7d';

const JUDGE = { rubricDigest: 'b'.repeat(64), sample: 0.2, trust: 0.6 };

const configured = (parts: Partial<StationConfigParts> = {}): StationConfig =>
  StationConfig.of({ ...PARTS, ...parts }, sha256);

describe('StationConfig', () => {
  it('fingerprints a station without a judge exactly as it did before judges existed', () => {
    expect(configured().fingerprint).toBe(FINGERPRINT_BEFORE_JUDGES);
  });

  it('leaves the judge out of the canonical form when there is none', () => {
    expect(StationConfig.canonical(PARTS)).not.toContain('judge');
  });

  it('fingerprints a judged station differently', () => {
    expect(configured({ judge: JUDGE }).fingerprint).not.toBe(
      FINGERPRINT_BEFORE_JUDGES,
    );
  });

  it('says a judge was added or removed without showing its settings', () => {
    const judged = configured({ judge: JUDGE });

    expect(judged.changesFrom(configured())).toEqual([
      { part: 'judge', name: null, kind: 'added', was: null, now: null },
    ]);
    expect(configured().changesFrom(judged)).toEqual([
      { part: 'judge', name: null, kind: 'removed', was: null, now: null },
    ]);
  });

  it('says the rubric changed without showing it, and shows the sample and trust it moved between', () => {
    const was = configured({ judge: JUDGE });
    const now = configured({
      judge: { rubricDigest: 'c'.repeat(64), sample: 0.5, trust: 0.8 },
    });

    expect(now.changesFrom(was)).toEqual([
      { part: 'judge', name: 'rubric', kind: 'changed', was: null, now: null },
      {
        part: 'judge',
        name: 'sample',
        kind: 'changed',
        was: '0.2',
        now: '0.5',
      },
      { part: 'judge', name: 'trust', kind: 'changed', was: '0.6', now: '0.8' },
    ]);
  });
});
