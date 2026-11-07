import { Station } from '@lines/domain/entities/station.entity';
import { InvalidLinePlanError } from '@lines/domain/exceptions/invalid-line-plan.error';
import { InvalidStationChangeError } from '@lines/domain/exceptions/invalid-station-change.error';
import {
  LinePlan,
  type StationPlan,
} from '@lines/domain/value-objects/line-plan.vo';
import { StationColor } from '@lines/domain/value-objects/station-color.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { SkillKey } from '@shared-kernel/domain/value-objects/skill-key.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
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
      station({ skills: ['our-migrations', 'our-migrations'] }),
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
    expect(enabling.skills.map((each) => each.value)).toEqual([
      'frontend',
      'catalog.research@1.0.0',
    ]);
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
      expect((error as InvalidLinePlanError).flaw).toEqual({
        in: 'station',
        station: StationKey.of('implementation'),
        rule: field,
      });
    }
  });
});
