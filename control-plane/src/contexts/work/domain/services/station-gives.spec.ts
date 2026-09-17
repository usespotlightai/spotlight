import { Station } from '@work/domain/entities/station.entity';
import { InvalidLinePlanError } from '@work/domain/exceptions/invalid-line-plan.error';
import { InvalidStationChangeError } from '@work/domain/exceptions/invalid-station-change.error';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import {
  LinePlan,
  type StationPlan,
} from '@work/domain/value-objects/line-plan.vo';
import { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { describe, expect, it } from 'vitest';

const station = (over: { tools?: string[]; skills?: string[] } = {}) =>
  Station.of({
    id: StationId.of('station_1'),
    key: StationKey.of('implementation'),
    name: StationName.of('Implementation'),
    position: 1,
    color: StationColor.of('#a3a8b0'),
    tools: (over.tools ?? []).map((each) => Tool.of(each)),
    skills: (over.skills ?? []).map((each) => SkillKey.of(each)),
  });

const laid = (key: string, over: Partial<StationPlan> = {}): StationPlan => ({
  key: StationKey.of(key),
  name: StationName.of(key),
  kind: 'work',
  color: StationColor.of('#a3a8b0'),
  description: null,
  harness: null,
  model: null,
  effort: null,
  agentPrompt: null,
  check: null,
  tools: [],
  skills: [],
  passesTo: [],
  ends: false,
  ...over,
});

const planned = (over: {
  tools?: readonly string[];
  skills?: readonly string[];
}) =>
  LinePlan.of({
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      laid('backlog', { kind: 'backlog' }),
      laid('implementation', {
        tools: (over.tools ?? []).map((each) => Tool.of(each)),
        skills: (over.skills ?? []).map((each) => SkillKey.of(each)),
      }),
      laid('completed', { kind: 'completed' }),
    ],
  });

describe('what a station gives', () => {
  it('names each skill once', () => {
    expect(() =>
      station({ skills: ['our-migrations', 'our-migrations'] }),
    ).toThrow(InvalidStationChangeError);
    expect(() =>
      station().givesSkills([
        SkillKey.of('our-migrations'),
        SkillKey.of('our-migrations'),
      ]),
    ).toThrow(/our-migrations twice/);
  });

  it('names none of Spotlight’s own skills, which are given wherever they apply', () => {
    expect(() => station({ skills: ['spotlight-handover'] })).toThrow(
      /Spotlight’s own/,
    );
  });

  it('names each tool once', () => {
    expect(() => station({ tools: ['pull-request', 'pull-request'] })).toThrow(
      /pull-request twice/,
    );
  });

  it('keeps what it gives through other changes', () => {
    const giving = station({ tools: ['pull-request'], skills: ['frontend'] });
    const renamed = giving.rename(StationName.of('Build'));

    expect(renamed.skills).toEqual([SkillKey.of('frontend')]);
    expect(renamed.tools).toEqual([Tool.of('pull-request')]);
  });

  it('is refused the same way where a line file describes it', () => {
    expect(() => planned({ skills: ['frontend', 'frontend'] })).toThrow(
      InvalidLinePlanError,
    );
    expect(() => planned({ tools: ['pull-request', 'pull-request'] })).toThrow(
      /has implementation, which names the tool pull-request twice/,
    );
    expect(() => planned({ skills: ['spotlight-handover'] })).toThrow(
      /Spotlight’s own/,
    );
  });

  it('is refused at the station that gives it, and at what it gives', () => {
    const refusedFor = (given: Parameters<typeof planned>[0]) => {
      try {
        planned(given);
      } catch (error) {
        return error;
      }
    };

    for (const [given, field] of [
      [{ skills: ['frontend', 'frontend'] }, 'skills'],
      [{ tools: ['pull-request', 'pull-request'] }, 'tools'],
    ] as const) {
      const refused = refusedFor(given);

      expect(refused).toBeInstanceOf(InvalidLinePlanError);
      expect((refused as InvalidLinePlanError).part).toEqual({
        of: 'station',
        station: 'implementation',
        field,
      });
    }
  });
});
