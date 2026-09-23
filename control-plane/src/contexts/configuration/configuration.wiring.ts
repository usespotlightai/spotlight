import {
  APPLIED_CONFIGURATION,
  type AppliedConfigurationPort,
} from '@configuration/application/ports/applied-configuration.port';
import { CONFIGURATION_READER } from '@configuration/application/ports/configuration-reader.port';
import {
  HELD_SECRETS,
  type HeldSecretsPort,
} from '@configuration/application/ports/held-secrets.port';
import {
  INTEGRATION_LINKS,
  type IntegrationLinksPort,
} from '@configuration/application/ports/integration-links.port';
import {
  INTEGRATION_READER,
  type IntegrationReaderPort,
} from '@configuration/application/ports/integration-reader.port';
import {
  SKILL_READER,
  type SkillReaderPort,
} from '@configuration/application/ports/skill-reader.port';
import { TEAMS } from '@configuration/application/ports/teams.port';
import { ConfigurationHandler } from '@configuration/application/queries/handlers/read-configuration.handler';
import { TeamSkillsHandler } from '@configuration/application/queries/handlers/team-skills.handler';
import { ConfigurationQuery } from '@configuration/application/queries/read-configuration.query';
import { TeamSkillsQuery } from '@configuration/application/queries/team-skills.query';
import { CONFIGURATION_EVENT_TYPES } from '@configuration/domain/event-types';
import { BuiltInSkills } from '@configuration/infrastructure/acl/built-in-skills.adapter';
import { DefinedConfiguration } from '@configuration/infrastructure/acl/defined-configuration.adapter';
import { TeamSkills } from '@configuration/infrastructure/acl/team-skills.adapter';
import { Teams } from '@configuration/infrastructure/acl/teams.adapter';
import { DrizzleIntegrationLinks } from '@configuration/infrastructure/persistence/drizzle/readers/integration-links.reader';
import { NoHeldSecrets } from '@configuration/infrastructure/secrets/no-held-secrets';
import { BuiltInSkillFiles } from '@configuration/infrastructure/skills/built-in-skill-files';
import { NoAppliedSkills } from '@configuration/infrastructure/skills/no-applied-skills';
import { TeamSkillFiles } from '@configuration/infrastructure/skills/team-skill-files';
import { configurationSubscribers } from '@configuration/presentation/events/configuration.subscribers';
import { ConfigurationController } from '@configuration/presentation/http/controllers/configuration.controller';
import { SkillController } from '@configuration/presentation/http/controllers/skill.controller';
import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import type { Provider, Type } from '@nestjs/common';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { EventTypes } from '@platform/events/event-types';
import {
  BUILT_IN_SKILLS,
  SHIPPED_SKILL_KEYS,
} from '@work/application/ports/built-in-skills.port';
import { TEAM_SKILLS } from '@work/application/ports/team-skills.port';

const CONFIGURATION_EVENTS = Symbol('CONFIGURATION_EVENTS');

export const CONFIGURATION_CONTROLLERS: readonly Type[] = [
  ConfigurationController,
  SkillController,
];

const upstream: Provider[] = [
  {
    provide: TEAMS,
    inject: [WORKSPACE_ACCESS],
    useFactory: (access: WorkspaceAccessPort) => new Teams(access),
  },
];

const adapters: Provider[] = [
  {
    provide: BUILT_IN_SKILLS,
    inject: [SHIPPED_SKILL_KEYS],
    useFactory: (keys: readonly string[]) =>
      new BuiltInSkills(new BuiltInSkillFiles(keys)),
  },
  { provide: SKILL_READER, useFactory: () => new TeamSkillFiles() },
  { provide: HELD_SECRETS, useFactory: () => new NoHeldSecrets() },
  {
    provide: CONFIGURATION_READER,
    inject: [INTEGRATION_READER],
    useFactory: (reader: IntegrationReaderPort) =>
      new DefinedConfiguration(reader),
  },
  { provide: INTEGRATION_LINKS, useClass: DrizzleIntegrationLinks },
];

const handlers: Provider[] = [
  ...bindQueryHandler(ConfigurationQuery, ConfigurationHandler, [
    TEAMS,
    CONFIGURATION_READER,
    INTEGRATION_LINKS,
  ]),
  ...bindQueryHandler(TeamSkillsQuery, TeamSkillsHandler, [
    TEAMS,
    APPLIED_CONFIGURATION,
    SKILL_READER,
  ]),
];

const published: Provider[] = [
  { provide: APPLIED_CONFIGURATION, useFactory: () => new NoAppliedSkills() },
  {
    provide: TEAM_SKILLS,
    inject: [APPLIED_CONFIGURATION, SKILL_READER, HELD_SECRETS],
    useFactory: (
      applied: AppliedConfigurationPort,
      reader: SkillReaderPort,
      secrets: HeldSecretsPort,
    ) => new TeamSkills(applied, reader, secrets),
  },
];

export const CONFIGURATION_PROVIDERS: readonly Provider[] = [
  {
    provide: CONFIGURATION_EVENTS,
    inject: [EventTypes, EventSubscribers, INTEGRATION_LINKS],
    useFactory: (
      types: EventTypes,
      subscribers: EventSubscribers,
      links: IntegrationLinksPort,
    ) => {
      types.register('configuration', CONFIGURATION_EVENT_TYPES);
      subscribers.register(configurationSubscribers(links));
      return true;
    },
  },
  ...upstream,
  ...adapters,
  ...handlers,
  ...published,
];
