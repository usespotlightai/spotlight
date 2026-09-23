import { CreateSkillCommand } from '@configuration/application/commands/create-skill.command';
import { DeleteSkillCommand } from '@configuration/application/commands/delete-skill.command';
import { CreateSkillHandler } from '@configuration/application/commands/handlers/create-skill.handler';
import { DeleteSkillHandler } from '@configuration/application/commands/handlers/delete-skill.handler';
import { UpdateSkillHandler } from '@configuration/application/commands/handlers/update-skill.handler';
import { UpdateSkillCommand } from '@configuration/application/commands/update-skill.command';
import { CONFIGURATION_PUBLICATIONS } from '@configuration/application/integration-events/configuration.publications';
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
  SKILL_COMPILER,
  type SkillCompilerPort,
} from '@configuration/application/ports/skill-compiler.port';
import {
  SKILL_READER,
  type SkillReaderPort,
} from '@configuration/application/ports/skill-reader.port';
import { SKILL_RESOURCES } from '@configuration/application/ports/skill-resources.port';
import { TEAMS } from '@configuration/application/ports/teams.port';
import { ImportSkillHandler } from '@configuration/application/queries/handlers/import-skill.handler';
import { ConfigurationHandler } from '@configuration/application/queries/handlers/read-configuration.handler';
import { ReadSkillHandler } from '@configuration/application/queries/handlers/read-skill.handler';
import { TeamSkillsHandler } from '@configuration/application/queries/handlers/team-skills.handler';
import { ImportSkillQuery } from '@configuration/application/queries/import-skill.query';
import { ConfigurationQuery } from '@configuration/application/queries/read-configuration.query';
import { ReadSkillQuery } from '@configuration/application/queries/read-skill.query';
import { TeamSkillsQuery } from '@configuration/application/queries/team-skills.query';
import { AbandonTeamSkills } from '@configuration/application/services/abandon-team-skills.service';
import { SkillViews } from '@configuration/application/services/skill-views.service';
import { SkillsGiven } from '@configuration/application/services/skills-given.service';
import { CONFIGURATION_EVENT_TYPES } from '@configuration/domain/event-types';
import type { SkillDefinitionRepository } from '@configuration/domain/repositories/skill-definition.repository';
import { SKILL_DEFINITIONS } from '@configuration/domain/repositories/skill-definition.repository';
import { BuiltInSkills } from '@configuration/infrastructure/acl/built-in-skills.adapter';
import { DefinedConfiguration } from '@configuration/infrastructure/acl/defined-configuration.adapter';
import { TeamSkills } from '@configuration/infrastructure/acl/team-skills.adapter';
import { Teams } from '@configuration/infrastructure/acl/teams.adapter';
import { DrizzleAppliedSkills } from '@configuration/infrastructure/persistence/drizzle/readers/applied-skills.reader';
import { DrizzleIntegrationLinks } from '@configuration/infrastructure/persistence/drizzle/readers/integration-links.reader';
import { DrizzleSkillResources } from '@configuration/infrastructure/persistence/drizzle/readers/skill-resources.reader';
import { DrizzleSkillsHeld } from '@configuration/infrastructure/persistence/drizzle/readers/skills-held.reader';
import { DrizzleSkillDefinitions } from '@configuration/infrastructure/persistence/drizzle/repositories/skill-definitions.repository';
import { NoHeldSecrets } from '@configuration/infrastructure/secrets/no-held-secrets';
import { BuiltInSkillFiles } from '@configuration/infrastructure/skills/built-in-skill-files';
import { SkillCompiler } from '@configuration/infrastructure/skills/skill.compile';
import { TeamSkillFiles } from '@configuration/infrastructure/skills/team-skill-files';
import { configurationSubscribers } from '@configuration/presentation/events/configuration.subscribers';
import { ConfigurationController } from '@configuration/presentation/http/controllers/configuration.controller';
import { SkillController } from '@configuration/presentation/http/controllers/skill.controller';
import { SkillResourceController } from '@configuration/presentation/http/controllers/skill-resource.controller';
import {
  TEAM_DIRECTORY,
  type TeamDirectoryPort,
} from '@identity/application/ports/team-directory.port';
import {
  TEAM_HOLDINGS,
  type TeamHoldingsPort,
} from '@identity/application/ports/team-holdings.port';
import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import type { Provider, Type } from '@nestjs/common';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventPublications } from '@platform/events/event-publications';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { EventTypes } from '@platform/events/event-types';
import { ID_GENERATOR } from '@shared-kernel/application/ports/id-generator.port';
import { IDEMPOTENT_CREATES } from '@shared-kernel/application/ports/idempotent-creates.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { TRANSACTION } from '@shared-kernel/application/ports/transaction.port';
import {
  BUILT_IN_SKILLS,
  SHIPPED_SKILL_KEYS,
} from '@work/application/ports/built-in-skills.port';
import {
  GIVEN_SKILLS,
  type GivenSkillsPort,
} from '@work/application/ports/given-skills.port';
import { TEAM_SKILLS } from '@work/application/ports/team-skills.port';

const CONFIGURATION_EVENTS = Symbol('CONFIGURATION_EVENTS');

const CONFIGURATION_HOLDINGS = Symbol('CONFIGURATION_HOLDINGS');

export const CONFIGURATION_CONTROLLERS: readonly Type[] = [
  ConfigurationController,
  SkillController,
  SkillResourceController,
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
  { provide: SKILL_COMPILER, useClass: SkillCompiler },
  { provide: SKILL_DEFINITIONS, useClass: DrizzleSkillDefinitions },
  { provide: SKILL_RESOURCES, useClass: DrizzleSkillResources },
  {
    provide: SkillsGiven,
    inject: [GIVEN_SKILLS],
    useFactory: (given: GivenSkillsPort) => new SkillsGiven(given),
  },
  {
    provide: SkillViews,
    inject: [TEAM_DIRECTORY, SKILL_COMPILER],
    useFactory: (teams: TeamDirectoryPort, compiler: SkillCompilerPort) =>
      new SkillViews(teams, compiler),
  },
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
  ...bindCommandHandler(CreateSkillCommand, CreateSkillHandler, [
    WORKSPACE_ACCESS,
    TEAM_DIRECTORY,
    SKILL_COMPILER,
    SKILL_DEFINITIONS,
    IDEMPOTENT_CREATES,
    ID_GENERATOR,
    TRANSACTION,
  ]),
  ...bindCommandHandler(UpdateSkillCommand, UpdateSkillHandler, [
    WORKSPACE_ACCESS,
    SKILL_COMPILER,
    SKILL_DEFINITIONS,
    TRANSACTION,
  ]),
  ...bindCommandHandler(DeleteSkillCommand, DeleteSkillHandler, [
    WORKSPACE_ACCESS,
    SKILL_DEFINITIONS,
    SkillsGiven,
    TRANSACTION,
  ]),
  ...bindQueryHandler(ReadSkillQuery, ReadSkillHandler, [
    WORKSPACE_ACCESS,
    SKILL_RESOURCES,
    SkillViews,
  ]),
  ...bindQueryHandler(ImportSkillQuery, ImportSkillHandler, [
    WORKSPACE_ACCESS,
    TEAM_DIRECTORY,
    SKILL_RESOURCES,
    SkillViews,
  ]),
];

const published: Provider[] = [
  { provide: APPLIED_CONFIGURATION, useClass: DrizzleAppliedSkills },
  DrizzleSkillsHeld,
  {
    provide: CONFIGURATION_HOLDINGS,
    inject: [TEAM_HOLDINGS, DrizzleSkillsHeld],
    useFactory: (holdings: TeamHoldingsPort, skills: DrizzleSkillsHeld) => {
      holdings.register(skills);
      return true;
    },
  },
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
    inject: [
      EventTypes,
      EventPublications,
      EventSubscribers,
      INTEGRATION_LINKS,
      SKILL_DEFINITIONS,
      TRANSACTION,
    ],
    useFactory: (
      types: EventTypes,
      publications: EventPublications,
      subscribers: EventSubscribers,
      links: IntegrationLinksPort,
      skills: SkillDefinitionRepository,
      transaction: TransactionPort,
    ) => {
      types.register('configuration', CONFIGURATION_EVENT_TYPES);
      publications.register(CONFIGURATION_PUBLICATIONS);
      subscribers.register(
        configurationSubscribers(
          links,
          new AbandonTeamSkills(skills, transaction),
        ),
      );
      return true;
    },
  },
  ...upstream,
  ...adapters,
  ...handlers,
  ...published,
];
