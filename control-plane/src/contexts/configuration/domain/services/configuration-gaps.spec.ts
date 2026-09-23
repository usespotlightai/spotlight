import { Skill } from '@configuration/domain/entities/skill.entity';
import {
  credentialsMissing,
  secretsMissing,
  secretsWrittenIn,
  skillToolsUnoffered,
  stationSkillsUndefined,
  stationToolsUnoffered,
} from '@configuration/domain/services/configuration-gaps';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import { ToolName } from '@configuration/domain/value-objects/tool-name.vo';
import { SecretName } from '@shared-kernel/domain/value-objects/secret-name.vo';
import { describe, expect, it } from 'vitest';

const GRAFANA = Skill.defined({
  key: SkillKey.of('grafana-dashboards'),
  description: 'Reading dashboards.',
  instructions: 'Search first.',
  secrets: [
    { name: SecretName.of('GRAFANA_TOKEN'), description: 'Read-only token' },
  ],
  tools: [ToolName.of('grafana.search'), ToolName.of('pull-request')],
});

const STATION = {
  path: '.spotlight/lines/delivery/stations/implementation.md',
  tools: [ToolName.of('pull-request'), ToolName.of('linear.close')],
  skills: [SkillKey.of('grafana-dashboards'), SkillKey.of('frontend')],
};

const BUILT_IN = (tool: ToolName) => tool.value === 'pull-request';

describe('configuration gaps', () => {
  it('finds each secret a skill needs that the team does not hold', () => {
    expect(secretsMissing([GRAFANA], [])).toEqual([
      { skill: GRAFANA.key, secret: SecretName.of('GRAFANA_TOKEN') },
    ]);
    expect(secretsMissing([GRAFANA], [SecretName.of('GRAFANA_TOKEN')])).toEqual(
      [],
    );
  });

  it('finds each secret an integration reads that the team does not hold', () => {
    const integrations = [
      {
        path: '.spotlight/integrations/linear.yml',
        credentials: [
          SecretName.of('LINEAR_API_KEY'),
          SecretName.of('LINEAR_WEBHOOK_SECRET'),
        ],
      },
      { path: '.spotlight/integrations/github.yml', credentials: [] },
    ];

    expect(
      credentialsMissing(integrations, [SecretName.of('LINEAR_API_KEY')]),
    ).toEqual([
      {
        path: '.spotlight/integrations/linear.yml',
        secret: SecretName.of('LINEAR_WEBHOOK_SECRET'),
      },
    ]);
  });

  it('finds each skill that writes a secret into any of its files', () => {
    expect(
      secretsWrittenIn([
        {
          skill: GRAFANA.key,
          texts: ['Search first.', `Use \${{ secrets.GRAFANA_TOKEN }}`],
        },
        { skill: SkillKey.of('frontend'), texts: ['No secrets here.'] },
      ]),
    ).toEqual([{ skill: GRAFANA.key }]);
  });

  it('finds each tool a skill brings that nothing offers, counting Spotlight’s own', () => {
    expect(skillToolsUnoffered([GRAFANA], [], BUILT_IN)).toEqual([
      { skill: GRAFANA.key, tool: ToolName.of('grafana.search'), at: 0 },
    ]);
    expect(
      skillToolsUnoffered([GRAFANA], [ToolName.of('grafana.search')], BUILT_IN),
    ).toEqual([]);
  });

  it('finds each tool a station gives that nothing offers, where it is written', () => {
    expect(stationToolsUnoffered([STATION], [], BUILT_IN)).toEqual([
      {
        path: STATION.path,
        tool: ToolName.of('linear.close'),
        at: 1,
      },
    ]);
  });

  it('finds each skill a station names that the team does not define, where it is written', () => {
    expect(stationSkillsUndefined([STATION], [GRAFANA])).toEqual([
      {
        path: STATION.path,
        skill: SkillKey.of('frontend'),
        at: 1,
      },
    ]);
  });
});
