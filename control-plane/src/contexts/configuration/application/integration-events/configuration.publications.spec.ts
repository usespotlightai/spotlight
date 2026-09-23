import { CONFIGURATION_PUBLICATIONS } from '@configuration/application/integration-events/configuration.publications';
import { SkillDefined } from '@configuration/domain/events/skill-defined.event';
import { SkillRedefined } from '@configuration/domain/events/skill-redefined.event';
import { SkillRetired } from '@configuration/domain/events/skill-retired.event';
import { SkillDefinitionId } from '@configuration/domain/value-objects/skill-definition-id.vo';
import { SkillKey } from '@configuration/domain/value-objects/skill-key.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const published = (event: DomainEvent) =>
  CONFIGURATION_PUBLICATIONS.filter((each) => each.from === event.kind).map(
    (each) => each.publish(event),
  );

const SKILL = [
  SkillDefinitionId.of('skill_1'),
  TeamId.of('team_1'),
  SkillKey.of('grafana'),
] as const;

describe('CONFIGURATION_PUBLICATIONS', () => {
  it.each([
    [new SkillDefined(...SKILL), 'configuration.skill-defined.v1'],
    [new SkillRedefined(...SKILL), 'configuration.skill-redefined.v1'],
    [new SkillRetired(...SKILL), 'configuration.skill-retired.v1'],
  ])('publishes %o as plain data', (event, kind) => {
    expect(published(event)).toEqual([
      { kind, skillId: 'skill_1', teamId: 'team_1', key: 'grafana' },
    ]);
  });
});
