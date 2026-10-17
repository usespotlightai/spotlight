import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { Station } from '@work/domain/entities/station.entity';
import {
  HANDING_OVER,
  OPENING_PULL_REQUESTS,
  USING_TOOLS,
} from '@work/domain/services/built-in-skills';
import {
  describedTools,
  enabledAt,
  skillsForTools,
} from '@work/domain/services/enabled-for-run';
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

describe('enabledAt', () => {
  it('enables how to hand over, and nothing else, at a station that enables nothing', () => {
    const enabled = enabledAt(station([]), [], []);

    expect(values(enabled.tools)).toEqual([]);
    expect(enabled.builtInSkills).toEqual([HANDING_OVER]);
    expect(enabled.teamSkills).toEqual([]);
  });

  it('enables the skill of using each of Spotlight’s own tools with the tool', () => {
    const enabled = enabledAt(
      station(['pull-request', 'linear.comment']),
      [],
      [],
    );

    expect(values(enabled.tools)).toEqual(['pull-request', 'linear.comment']);
    expect(enabled.builtInSkills).toEqual([
      HANDING_OVER,
      OPENING_PULL_REQUESTS,
    ]);
  });

  it('enables the team’s skills the station names, and the tools they bring, once each', () => {
    const enabled = enabledAt(
      station(['grafana.search'], ['grafana-dashboards']),
      [
        skill('grafana-dashboards', ['grafana.search', 'grafana.dashboard']),
        skill('our-migrations'),
      ],
      [],
    );

    expect(values(enabled.tools)).toEqual([
      'grafana.search',
      'grafana.dashboard',
    ]);
    expect(values(enabled.builtInSkills)).toEqual(['spotlight-handover']);
    expect(keysOf(enabled.teamSkills)).toEqual(['grafana-dashboards']);
  });

  it('enables nothing of a skill the station names that is not ready', () => {
    const enabled = enabledAt(station([], ['grafana-dashboards']), [], []);

    expect(values(enabled.tools)).toEqual([]);
    expect(enabled.builtInSkills).toEqual([HANDING_OVER]);
    expect(enabled.teamSkills).toEqual([]);
  });

  it('enables the skill of opening pull requests where a team’s skill brings the tool', () => {
    const enabled = enabledAt(
      station([], ['shipping']),
      [skill('shipping', ['pull-request'])],
      [],
    );

    expect(values(enabled.tools)).toEqual(['pull-request']);
    expect(values(enabled.builtInSkills)).toEqual([
      'spotlight-handover',
      'spotlight-pull-request',
    ]);
    expect(keysOf(enabled.teamSkills)).toEqual(['shipping']);
  });
});

describe('enabledAt, for a station that names a harness profile', () => {
  const careful = {
    key: ProfileKey.of('careful'),
    rules: [],
    mcpServers: [],
    native: {},
    injectedSecrets: [],
  };

  it('enables the profile the team has for the run', () => {
    const enabled = enabledAt(station([], [], 'careful'), [], [careful]);

    expect(enabled.profile).toBe(careful);
    expect(enabled.refusals).toEqual([]);
  });

  it('refuses the run where the team has no such profile, and says so', () => {
    const enabled = enabledAt(station([], [], 'reckless'), [], [careful]);

    expect(enabled.profile).toBeNull();
    expect(enabled.refusals.map((each) => each.description)).toEqual([
      'harness_profile_unknown: Harness profile reckless is not in this team. Station: Implementation',
    ]);
  });

  it('enables no profile and refuses nothing where the station names none', () => {
    const enabled = enabledAt(station([]), [], [careful]);

    expect(enabled.profile).toBeNull();
    expect(enabled.refusals).toEqual([]);
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

describe('skillsForTools', () => {
  const declared = (tool: string) =>
    DeclaredTool.of({ tool: Tool.of(tool), description: 'Does it.' });

  it('enables the skill of finding and calling tools with an integration’s tool or the catalog’s', () => {
    expect(skillsForTools([declared('linear.comment')])).toEqual([USING_TOOLS]);
    expect(skillsForTools([declared('catalog.web-search@1.1.0')])).toEqual([
      USING_TOOLS,
    ]);
  });

  it('enables nothing for Spotlight’s own tools, or for none', () => {
    expect(skillsForTools([declared('pull-request')])).toEqual([]);
    expect(skillsForTools([])).toEqual([]);
  });
});
