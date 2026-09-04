import { InvalidLinePlanError } from '@domain/exceptions/invalid-line-plan.error';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { Happening } from '@domain/value-objects/happening.vo';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { LinePlan, type StationPlan } from '@domain/value-objects/line-plan.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { describe, expect, it } from 'vitest';

const MERGED = Happening.of('github.pull_request.merged');

const station = (
  key: string,
  over: Partial<StationPlan> = {},
): StationPlan => ({
  key: StationKey.of(key),
  name: StationName.of(key),
  kind: 'work',
  color: StationColor.of('#a3a8b0'),
  description: null,
  harness: null,
  agentPrompt: null,
  tools: [],
  passesTo: [],
  ends: false,
  ...over,
});

const plan = (over: Partial<Parameters<typeof LinePlan.of>[0]> = {}) =>
  LinePlan.of({
    key: LineKey.of('default'),
    name: AssemblyLineName.of('Default'),
    stations: [station('backlog'), station('review')],
    ...over,
  });

describe('LinePlan', () => {
  it('describes a line, its stations and what words do to a task', () => {
    const held = plan({
      reactions: [
        {
          happening: MERGED,
          from: null,
          to: StationKey.of('review'),
          opens: false,
        },
      ],
    });

    expect(held.key.value).toBe('default');
    expect(held.stations).toHaveLength(2);
    expect(held.reactions).toHaveLength(1);
  });

  // A line with nowhere to stand is not a line.
  it('refuses one describing no stations at all', () => {
    expect(() => plan({ stations: [] })).toThrow(InvalidLinePlanError);
  });

  // The second would quietly never be reached.
  it('refuses one naming a station twice', () => {
    expect(() =>
      plan({ stations: [station('review'), station('review')] }),
    ).toThrow(/twice/);
  });

  // Written as keys, so they have to land on stations the plan describes.
  it('refuses work passing to a station it does not describe', () => {
    expect(() =>
      plan({
        stations: [
          station('backlog', { passesTo: [StationKey.of('nowhere')] }),
          station('review'),
        ],
      }),
    ).toThrow(/not a station on it/);
  });

  it('refuses a word taking a task to a station it does not describe', () => {
    expect(() =>
      plan({
        reactions: [
          {
            happening: MERGED,
            from: null,
            to: StationKey.of('nowhere'),
            opens: false,
          },
        ],
      }),
    ).toThrow(/not a station on it/);
  });

  it('refuses a word waiting at a station it does not describe', () => {
    expect(() =>
      plan({
        reactions: [
          {
            happening: MERGED,
            from: StationKey.of('nowhere'),
            to: StationKey.of('review'),
            opens: false,
          },
        ],
      }),
    ).toThrow(/not a station on it/);
  });

  it('says whether it names a station at all', () => {
    expect(plan().names(StationKey.of('review'))).toBe(true);
    expect(plan().names(StationKey.of('nowhere'))).toBe(false);
  });

  it('says which of the ones standing it no longer describes', () => {
    const dropped = plan().drops([
      { key: StationKey.of('review') },
      { key: StationKey.of('handover') },
    ]);

    expect(dropped.map((each) => each.value)).toEqual(['handover']);
  });
});
