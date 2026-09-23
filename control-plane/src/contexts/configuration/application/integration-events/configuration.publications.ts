import type { SkillDefined } from '@configuration/domain/events/skill-defined.event';
import type { SkillRedefined } from '@configuration/domain/events/skill-redefined.event';
import type { SkillRetired } from '@configuration/domain/events/skill-retired.event';
import {
  SKILL_DEFINED,
  type SkillDefinedIntegrationEvent,
} from '@shared-kernel/application/integration-events/skill-defined.integration-event';
import {
  SKILL_REDEFINED,
  type SkillRedefinedIntegrationEvent,
} from '@shared-kernel/application/integration-events/skill-redefined.integration-event';
import {
  SKILL_RETIRED,
  type SkillRetiredIntegrationEvent,
} from '@shared-kernel/application/integration-events/skill-retired.integration-event';
import { publishing } from '@shared-kernel/application/ports/event-publication.port';

const skillFields = (event: SkillDefined | SkillRedefined | SkillRetired) => ({
  skillId: event.id.value,
  teamId: event.teamId.value,
  key: event.key.value,
});

export const CONFIGURATION_PUBLICATIONS = [
  publishing<SkillDefined>(
    'configuration.skill-defined',
    (event): SkillDefinedIntegrationEvent => ({
      kind: SKILL_DEFINED,
      ...skillFields(event),
    }),
  ),
  publishing<SkillRedefined>(
    'configuration.skill-redefined',
    (event): SkillRedefinedIntegrationEvent => ({
      kind: SKILL_REDEFINED,
      ...skillFields(event),
    }),
  ),
  publishing<SkillRetired>(
    'configuration.skill-retired',
    (event): SkillRetiredIntegrationEvent => ({
      kind: SKILL_RETIRED,
      ...skillFields(event),
    }),
  ),
] as const;
