import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { Station } from '@work/domain/entities/station.entity';
import {
  HANDING_OVER,
  OPENING_PULL_REQUESTS,
} from '@work/domain/services/built-in-skills';
import { describedTools, givenAt } from '@work/domain/services/given-to-run';
import { DeclaredTool } from '@work/domain/value-objects/declared-tool.vo';
import { ProfileKey } from '@work/domain/value-objects/profile-key.vo';
import type { ReadySkill } from '@work/domain/value-objects/ready-skill';
import { SkillKey } from '@work/domain/value-objects/skill-key.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { Tool } from '@work/domain/value-objects/tool.vo';
import { describe, expect, it } from 'vitest';

const station = (
  tools: string[],
  skills: string[] = [],
  profile: string | null = null,
) =>
  Station.of({
    id: StationId.of('station_1'),
    key: StationKey.of('implementation'),
    name: StationName.of('Implementation'),
    position: 1,
    color: StationColor.of('#a3a8b0'),
    harness: HarnessId.of('dev'),
    tools: tools.map((each) => Tool.of(each)),
    skills: skills.map((each) => SkillKey.of(each)),
    profile: profile ? ProfileKey.of(profile) : null,
  });

const skill = (key: string, tools: string[] = []) => ({
  key: SkillKey.of(key),
  description: `When to use ${key}.`,
  tools: tools.map((each) => Tool.of(each)),
});

const values = (named: readonly { value: string }[]) =>
  named.map((each) => each.value);

const keysOf = (skills: readonly ReadySkill[]) =>
  skills.map((each) => each.key.value);

describe('givenAt', () => {
  it('gives a run how to hand over, and nothing else, at a station that gives nothing', () => {
    const given = givenAt(station([]), [], []);

    expect(values(given.tools)).toEqual([]);
    expect(given.builtInSkills).toEqual([HANDING_OVER]);
    expect(given.teamSkills).toEqual([]);
  });

  it('gives the skill of using each of Spotlight’s own tools with the tool', () => {
    const given = givenAt(station(['pull-request', 'linear.comment']), [], []);

    expect(values(given.tools)).toEqual(['pull-request', 'linear.comment']);
    expect(given.builtInSkills).toEqual([HANDING_OVER, OPENING_PULL_REQUESTS]);
  });

  it('gives the team’s skills the station names, and the tools they bring, once each', () => {
    const given = givenAt(
      station(['grafana.search'], ['grafana-dashboards']),
      [
        skill('grafana-dashboards', ['grafana.search', 'grafana.dashboard']),
        skill('our-migrations'),
      ],
      [],
    );

    expect(values(given.tools)).toEqual([
      'grafana.search',
      'grafana.dashboard',
    ]);
    expect(values(given.builtInSkills)).toEqual(['spotlight-handover']);
    expect(keysOf(given.teamSkills)).toEqual(['grafana-dashboards']);
  });

  it('gives nothing of a skill the station names that is not ready', () => {
    const given = givenAt(station([], ['grafana-dashboards']), [], []);

    expect(values(given.tools)).toEqual([]);
    expect(given.builtInSkills).toEqual([HANDING_OVER]);
    expect(given.teamSkills).toEqual([]);
  });

  it('gives the skill of opening pull requests where a team’s skill brings the tool', () => {
    const given = givenAt(
      station([], ['shipping']),
      [skill('shipping', ['pull-request'])],
      [],
    );

    expect(values(given.tools)).toEqual(['pull-request']);
    expect(values(given.builtInSkills)).toEqual([
      'spotlight-handover',
      'spotlight-pull-request',
    ]);
    expect(keysOf(given.teamSkills)).toEqual(['shipping']);
  });
});

describe('givenAt, for a station that names a harness profile', () => {
  const careful = {
    key: ProfileKey.of('careful'),
    rules: [],
    mcpServers: [],
    native: {},
    wears: [],
  };

  it('gives the run the profile the team holds', () => {
    const given = givenAt(station([], [], 'careful'), [], [careful]);

    expect(given.profile).toBe(careful);
    expect(given.refusals).toEqual([]);
  });

  it('refuses the run where the team holds no such profile, and says so', () => {
    const given = givenAt(station([], [], 'reckless'), [], [careful]);

    expect(given.profile).toBeNull();
    expect(given.refusals.map((each) => each.saying)).toEqual([
      'harness_profile_unknown: Harness profile reckless is not in this team. Station: Implementation',
    ]);
  });

  it('gives no profile and refuses nothing where the station names none', () => {
    const given = givenAt(station([]), [], [careful]);

    expect(given.profile).toBeNull();
    expect(given.refusals).toEqual([]);
  });
});

describe('describedTools', () => {
  it('describes Spotlight’s own and those offered, and leaves out the rest', () => {
    const offered = DeclaredTool.of({
      tool: Tool.of('linear.comment'),
      description: 'Comment on the issue.',
    });

    const described = describedTools(
      [Tool.of('pull-request'), Tool.of('linear.comment'), Tool.of('linear.x')],
      [offered],
    );

    expect(described.map((each) => each.tool.value)).toEqual([
      'pull-request',
      'linear.comment',
    ]);
  });
});
