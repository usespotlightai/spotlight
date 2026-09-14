import { Skill } from '@domain/entities/skill.entity';
import {
  secretsMissing,
  secretsWrittenIn,
  skillToolsUnoffered,
  stationSkillsUndefined,
  stationToolsUnoffered,
} from '@domain/services/configuration-gaps';
import { LineKey } from '@domain/value-objects/line-key.vo';
import { LineName } from '@domain/value-objects/line-name.vo';
import { LinePlan, type StationPlan } from '@domain/value-objects/line-plan.vo';
import { SecretName } from '@domain/value-objects/secret-name.vo';
import { SkillKey } from '@domain/value-objects/skill-key.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationKey } from '@domain/value-objects/station-key.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { Tool } from '@domain/value-objects/tool.vo';
import { describe, expect, it } from 'vitest';

const GRAFANA = Skill.defined({
  key: SkillKey.of('grafana-dashboards'),
  description: 'Reading dashboards.',
  instructions: 'Search first.',
  secrets: [
    { name: SecretName.of('GRAFANA_TOKEN'), description: 'Read-only token' },
  ],
  tools: [Tool.of('grafana.search'), Tool.of('pull-request')],
});

const stationPlan = (over: Partial<StationPlan>): StationPlan => ({
  key: StationKey.of('implementation'),
  name: StationName.of('Implementation'),
  kind: 'work',
  color: StationColor.of('#a3a8b0'),
  description: null,
  harness: null,
  model: null,
  effort: null,
  agentPrompt: null,
  tools: [],
  skills: [],
  passesTo: [],
  ends: false,
  ...over,
});

const PLAN = LinePlan.of({
  key: LineKey.of('delivery'),
  name: LineName.of('Delivery'),
  stations: [
    stationPlan({
      key: StationKey.of('backlog'),
      name: StationName.of('Backlog'),
      kind: 'backlog',
    }),
    stationPlan({
      tools: [Tool.of('pull-request'), Tool.of('linear.close')],
      skills: [SkillKey.of('grafana-dashboards'), SkillKey.of('frontend')],
    }),
    stationPlan({
      key: StationKey.of('completed'),
      name: StationName.of('Completed'),
      kind: 'completed',
    }),
  ],
});

describe('configuration gaps', () => {
  it('finds each secret a skill needs that the vault does not hold', () => {
    expect(secretsMissing([GRAFANA], [])).toEqual([
      { skill: GRAFANA.key, secret: SecretName.of('GRAFANA_TOKEN') },
    ]);
    expect(secretsMissing([GRAFANA], [SecretName.of('GRAFANA_TOKEN')])).toEqual(
      [],
    );
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
    expect(skillToolsUnoffered([GRAFANA], [])).toEqual([
      { skill: GRAFANA.key, tool: Tool.of('grafana.search'), at: 0 },
    ]);
    expect(skillToolsUnoffered([GRAFANA], [Tool.of('grafana.search')])).toEqual(
      [],
    );
  });

  it('finds each tool a station gives that nothing offers, where it is written', () => {
    expect(stationToolsUnoffered([PLAN], [])).toEqual([
      { line: PLAN.key, station: 1, tool: Tool.of('linear.close'), at: 1 },
    ]);
  });

  it('finds each skill a station names that the team does not define, where it is written', () => {
    expect(stationSkillsUndefined([PLAN], [GRAFANA])).toEqual([
      { line: PLAN.key, station: 1, skill: SkillKey.of('frontend'), at: 1 },
    ]);
  });
});
