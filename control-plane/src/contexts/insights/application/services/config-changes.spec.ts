import type {
  ConfigInOrder,
  ConfigPart,
  StationConfigView,
} from '@insights/application/ports/work.port';
import {
  type ConfigPair,
  configChangesOf,
  fingerprintsToRead,
} from '@insights/application/services/config-changes';
import { describe, expect, it } from 'vitest';

const viewOf = (fingerprint: string): StationConfigView => ({
  prompt: fingerprint,
  harness: 'claude-code',
  model: null,
  effort: null,
  profile: null,
  image: null,
  repositories: [],
  skills: [],
  tools: [],
  decisions: false,
  memories: false,
});

const changeFrom = (was: string, now: string): ConfigPart => ({
  part: 'prompt',
  name: null,
  kind: 'changed',
  was,
  now,
});

const inOrder = (
  fingerprints: readonly string[],
  known: ReadonlySet<string>,
): readonly ConfigInOrder[] => {
  const found = fingerprints.filter((each) => known.has(each));

  return found.map((fingerprint, at) => {
    const earlier = found[at - 1];

    return {
      fingerprint,
      config: viewOf(fingerprint),
      changes: earlier ? [changeFrom(earlier, fingerprint)] : [],
    };
  });
};

describe('config changes', () => {
  const pairs: readonly ConfigPair[] = [
    { previous: 'a1', next: 'a2' },
    { previous: 'b1', next: 'b2' },
    { previous: null, next: 'c1' },
    { previous: 'a2', next: 'a3' },
    { previous: 'b2', next: 'b2' },
    { previous: 'b2', next: 'b3' },
  ];

  it('looks up the change of each requested pair, with pairs from several stations interleaved', () => {
    const changes = configChangesOf(
      inOrder(
        fingerprintsToRead(pairs),
        new Set(['a1', 'a2', 'a3', 'b1', 'b2', 'b3', 'c1']),
      ),
    );

    expect(changes.between({ previous: 'a1', next: 'a2' })).toEqual([
      changeFrom('a1', 'a2'),
    ]);
    expect(changes.between({ previous: 'b1', next: 'b2' })).toEqual([
      changeFrom('b1', 'b2'),
    ]);
    expect(changes.between({ previous: 'a2', next: 'a3' })).toEqual([
      changeFrom('a2', 'a3'),
    ]);
    expect(changes.between({ previous: 'b2', next: 'b3' })).toEqual([
      changeFrom('b2', 'b3'),
    ]);
    expect(changes.between({ previous: null, next: 'c1' })).toEqual([]);
    expect(changes.between({ previous: 'b2', next: 'b2' })).toEqual([]);
    expect(changes.between({ previous: 'a1', next: 'a3' })).toEqual([]);
    expect(changes.configOf('b3')).toEqual(viewOf('b3'));
  });

  it('answers nothing for pairs naming an unknown fingerprint', () => {
    const changes = configChangesOf(
      inOrder(fingerprintsToRead(pairs), new Set(['a1', 'a3', 'b1', 'b2'])),
    );

    expect(changes.between({ previous: 'a1', next: 'a2' })).toEqual([]);
    expect(changes.between({ previous: 'a2', next: 'a3' })).toEqual([]);
    expect(changes.between({ previous: 'b2', next: 'b3' })).toEqual([]);
    expect(changes.between({ previous: 'b1', next: 'b2' })).toEqual([
      changeFrom('b1', 'b2'),
    ]);
    expect(changes.configOf('a2')).toBeNull();
    expect(changes.configOf(null)).toBeNull();
  });
});
