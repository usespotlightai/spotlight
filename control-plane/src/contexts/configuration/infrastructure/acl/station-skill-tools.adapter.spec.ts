import type { SkillResourceDto } from '@configuration/application/dto/skill-resource.dto';
import type {
  SkillRecord,
  SkillResourcesPort,
} from '@configuration/application/ports/skill-resources.port';
import type { SkillViews } from '@configuration/application/services/skill-views.service';
import { StationSkillTools } from '@configuration/infrastructure/acl/station-skill-tools.adapter';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');

const record = (key: string): SkillRecord => ({
  id: `skill_${key}`,
  version: 1,
  teamId: TEAM,
  key,
  files: {},
});

const adapterFor = (
  records: readonly SkillRecord[],
  broken: readonly string[] = [],
) => {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const resources = partial<SkillResourcesPort>({
    ofTeam: vi.fn(() => Promise.resolve(records)),
  });
  const views = partial<SkillViews>({
    onTeam: (each: SkillRecord) =>
      partial<SkillResourceDto>({
        tools: broken.includes(each.key) ? [] : [`${each.key}.search`],
        warnings: broken.includes(each.key)
          ? [
              ConfigurationProblem.of({
                path: `${each.key}/SKILL.md`,
                at: FieldPath.of(['name']),
                reason: 'is not valid',
              }),
            ]
          : [],
      }),
  });

  return { logger, tools: new StationSkillTools(resources, views, logger) };
};

describe('StationSkillTools', () => {
  it('returns the tools of each skill asked for', async () => {
    const { tools } = adapterFor([record('grafana'), record('other')]);

    await expect(tools.ofTeam(TEAM, ['grafana'])).resolves.toEqual(
      new Map([['grafana', ['grafana.search']]]),
    );
  });

  it('leaves out a skill that does not compile, and says so', async () => {
    const { tools, logger } = adapterFor(
      [record('grafana'), record('bad')],
      ['bad'],
    );

    const result = await tools.ofTeam(TEAM, ['grafana', 'bad']);

    expect([...result.keys()]).toEqual(['grafana']);
    expect(logger.warn).toHaveBeenCalledWith(
      { teamId: 'team_1', skill: 'bad' },
      'Skill bad skipped from station tools: is not valid',
    );
  });

  it('leaves out a skill the team does not have', async () => {
    const { tools, logger } = adapterFor([record('grafana')]);

    const result = await tools.ofTeam(TEAM, ['grafana', 'gone']);

    expect(result.has('gone')).toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
