import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
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
  profile: null,
  agentPrompt: null,
  check: null,
  placement: RunnerPlacement.anywhere(),
  diffs: false,
  decisions: false,
  memories: false,
  judge: null,
  alerts: [],
  search: null,
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

describe('what a station enables', () => {
  it('names each skill once', () => {
    expect(() =>
      station({ skills: ['our-migrations', 'our-migrations'] }),
    ).toThrow(InvalidStationChangeError);
    expect(() =>
      station().enablesSkills([
        SkillKey.of('our-migrations'),
        SkillKey.of('our-migrations'),
      ]),
    ).toThrow(/our-migrations twice/);
  });

  it('names none of Spotlight’s own skills, which are enabled wherever they apply', () => {
    expect(() => station({ skills: ['spotlight-handover'] })).toThrow(
      /Spotlight already enables it/,
    );
  });

  it('names each tool once', () => {
    expect(() => station({ tools: ['pull-request', 'pull-request'] })).toThrow(
      /pull-request twice/,
    );
  });

  it('names a catalog tool or skill at one version only', () => {
    expect(() =>
      station({
        tools: ['catalog.web-search@1.0.0', 'catalog.web-search@1.1.0'],
      }),
    ).toThrow(/catalog.web-search twice/);
    expect(() =>
      station({ skills: ['catalog.research@1.0.0', 'catalog.research@2.0.0'] }),
    ).toThrow(/catalog.research twice/);
  });

  it('enables catalog tools and skills beside the team’s own', () => {
    const enabling = station({
      tools: ['pull-request', 'catalog.web-search@1.1.0'],
      skills: ['frontend', 'catalog.research@1.0.0'],
    });

    expect(enabling.tools.map((each) => each.value)).toEqual([
      'pull-request',
      'catalog.web-search@1.1.0',
    ]);
    expect(enabling.skills.map((each) => each.folder)).toEqual([
      'frontend',
      'spotlight-catalog-research',
    ]);
  });

  it('keeps what it enables through other changes', () => {
    const enabling = station({ tools: ['pull-request'], skills: ['frontend'] });
    const renamed = enabling.rename(StationName.of('Build'));

    expect(renamed.skills).toEqual([SkillKey.of('frontend')]);
    expect(renamed.tools).toEqual([Tool.of('pull-request')]);
  });

  it('is rejected the same way where a line file describes it', () => {
    expect(() => planned({ skills: ['frontend', 'frontend'] })).toThrow(
      InvalidLinePlanError,
    );
    expect(() => planned({ tools: ['pull-request', 'pull-request'] })).toThrow(
      /station implementation names tool pull-request twice/,
    );
    expect(() => planned({ skills: ['spotlight-handover'] })).toThrow(
      /Spotlight already enables it/,
    );
  });

  it('is rejected at the station that enables it, and at what it enables', () => {
    const errorFor = (input: Parameters<typeof planned>[0]) => {
      try {
        planned(input);
      } catch (error) {
        return error;
      }
    };

    for (const [input, field] of [
      [{ skills: ['frontend', 'frontend'] }, 'skills'],
      [{ tools: ['pull-request', 'pull-request'] }, 'tools'],
    ] as const) {
      const error = errorFor(input);

      expect(error).toBeInstanceOf(InvalidLinePlanError);
      expect((error as InvalidLinePlanError).part).toEqual({
        of: 'station',
        station: 'implementation',
        field,
      });
    }
  });
});
