import { ChooseIntegrationsCommand } from '@configuration/application/commands/choose-integrations.command';
import { ChooseIntegrationsHandler } from '@configuration/application/commands/handlers/choose-integrations.handler';
import { MoveConfigurationHandler } from '@configuration/application/commands/handlers/move-configuration.handler';
import { PinConfigurationHandler } from '@configuration/application/commands/handlers/pin-configuration.handler';
import { ReadConfigurationHandler } from '@configuration/application/commands/handlers/read-configuration.handler';
import { MoveConfigurationCommand } from '@configuration/application/commands/move-configuration.command';
import { PinConfigurationCommand } from '@configuration/application/commands/pin-configuration.command';
import { ReadConfigurationCommand } from '@configuration/application/commands/read-configuration.command';
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
  LINES,
  type LinesPort,
} from '@configuration/application/ports/lines.port';
import {
  SKILL_READER,
  type SkillReaderPort,
} from '@configuration/application/ports/skill-reader.port';
import {
  TEAMS,
  type TeamsPort,
} from '@configuration/application/ports/teams.port';
import { ConfigurationHandler } from '@configuration/application/queries/handlers/read-configuration.handler';
import { TeamSkillsHandler } from '@configuration/application/queries/handlers/team-skills.handler';
import { ConfigurationQuery } from '@configuration/application/queries/read-configuration.query';
import { TeamSkillsQuery } from '@configuration/application/queries/team-skills.query';
import { ConfigurationNotices } from '@configuration/application/services/configuration-notices.service';
import { ConfigurationProposals } from '@configuration/application/services/configuration-proposals.service';
import { ConfigurationTarget } from '@configuration/application/services/configuration-target.service';
import { HeldConfiguration } from '@configuration/application/services/held-configuration.service';
import { PendingConfiguration } from '@configuration/application/services/pending-configuration.service';
import { ProposeConfigurationChange } from '@configuration/application/services/propose-configuration-change.service';
import { ReadConfiguration } from '@configuration/application/services/read-configuration.service';
import { RepositoryProvisioning } from '@configuration/application/services/repository-provisioning.service';
import { WriteConfiguration } from '@configuration/application/services/write-configuration.service';
import { CONFIGURATION_EVENT_TYPES } from '@configuration/domain/event-types';
import { BuiltInSkills } from '@configuration/infrastructure/acl/built-in-skills.adapter';
import { Lines } from '@configuration/infrastructure/acl/lines.adapter';
import { TeamSkills } from '@configuration/infrastructure/acl/team-skills.adapter';
import { Teams } from '@configuration/infrastructure/acl/teams.adapter';
import { DrizzleAppliedConfigurationReader } from '@configuration/infrastructure/persistence/drizzle/readers/applied-configuration.reader';
import { DrizzleConfigurationReader } from '@configuration/infrastructure/persistence/drizzle/readers/configuration.reader';
import { DrizzleIntegrationLinks } from '@configuration/infrastructure/persistence/drizzle/readers/integration-links.reader';
import { DrizzleConfigurationHome } from '@configuration/infrastructure/persistence/drizzle/repositories/configuration-home.repository';
import { DrizzleTeamConfiguration } from '@configuration/infrastructure/persistence/drizzle/repositories/team-configuration.repository';
import { NoHeldSecrets } from '@configuration/infrastructure/secrets/no-held-secrets';
import { BuiltInSkillFiles } from '@configuration/infrastructure/skills/built-in-skill-files';
import { TeamSkillFiles } from '@configuration/infrastructure/skills/team-skill-files';
import { configurationSubscribers } from '@configuration/presentation/events/configuration.subscribers';
import { ConfigurationController } from '@configuration/presentation/http/controllers/configuration.controller';
import { SkillController } from '@configuration/presentation/http/controllers/skill.controller';
import { ConfigurationStatus } from '@configuration/presentation/ports/configuration-status.adapter';
import {
  PULL_REQUESTS,
  type PullRequestPort,
} from '@github/application/ports/pull-request.port';
import {
  REPOSITORY_CATALOG,
  type RepositoryCatalogPort,
} from '@github/application/ports/repository-catalog.port';
import {
  REPOSITORY_CONTENTS,
  type RepositoryContentsPort,
} from '@github/application/ports/repository-contents.port';
import {
  WORKSPACE_CONNECTIONS,
  type WorkspaceConnectionsPort,
} from '@github/application/ports/workspace-connections.port';
import {
  TEAM_DIRECTORY,
  type TeamDirectoryPort,
} from '@identity/application/ports/team-directory.port';
import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import type { Provider, Type } from '@nestjs/common';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { EventTypes } from '@platform/events/event-types';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';
import {
  BUILT_IN_SKILLS,
  SHIPPED_SKILL_KEYS,
} from '@work/application/ports/built-in-skills.port';
import { CONFIGURATION_PROPOSALS } from '@work/application/ports/configuration-proposals.port';
import { CONFIGURATION_STATUS } from '@work/application/ports/configuration-status.port';
import {
  CONFIGURED_LINES,
  type ConfiguredLinesPort,
} from '@work/application/ports/configured-lines.port';
import {
  SETUP_SETTLING,
  type SetupSettlingPort,
} from '@work/application/ports/setup-settling.port';
import { STARTER_INTEGRATIONS } from '@work/application/ports/starter-integrations.port';
import { TEAM_SKILLS } from '@work/application/ports/team-skills.port';

const CONFIGURATION_EVENTS = Symbol('CONFIGURATION_EVENTS');

export const CONFIGURATION_CONTROLLERS: readonly Type[] = [
  ConfigurationController,
  SkillController,
];

const upstream: Provider[] = [
  {
    provide: TEAMS,
    inject: [WORKSPACE_ACCESS, TEAM_DIRECTORY, WORKSPACE_CONNECTIONS],
    useFactory: (
      access: WorkspaceAccessPort,
      directory: TeamDirectoryPort,
      connections: WorkspaceConnectionsPort,
    ) => new Teams(access, directory, connections),
  },
  {
    provide: LINES,
    inject: [CONFIGURED_LINES],
    useFactory: (lines: ConfiguredLinesPort) => new Lines(lines),
  },
];

const adapters: Provider[] = [
  {
    provide: BUILT_IN_SKILLS,
    inject: [SHIPPED_SKILL_KEYS],
    useFactory: (keys: readonly string[]) =>
      new BuiltInSkills(new BuiltInSkillFiles(keys)),
  },
  DrizzleTeamConfiguration,
  DrizzleConfigurationHome,
  { provide: SKILL_READER, useFactory: () => new TeamSkillFiles() },
  { provide: HELD_SECRETS, useFactory: () => new NoHeldSecrets() },
  { provide: CONFIGURATION_READER, useClass: DrizzleConfigurationReader },
  { provide: INTEGRATION_LINKS, useClass: DrizzleIntegrationLinks },
];

const services: Provider[] = [
  {
    provide: HeldConfiguration,
    inject: [REPOSITORY_CONTENTS],
    useFactory: (contents: RepositoryContentsPort) =>
      new HeldConfiguration(contents),
  },
  {
    provide: PendingConfiguration,
    inject: [REPOSITORY_CONTENTS, PULL_REQUESTS],
    useFactory: (
      contents: RepositoryContentsPort,
      pullRequests: PullRequestPort,
    ) => new PendingConfiguration(contents, pullRequests),
  },
  {
    provide: WriteConfiguration,
    inject: [PULL_REQUESTS],
    useFactory: (pullRequests: PullRequestPort) =>
      new WriteConfiguration(pullRequests),
  },
  {
    provide: ConfigurationTarget,
    inject: [DrizzleTeamConfiguration, DrizzleConfigurationHome],
    useFactory: (
      configurations: DrizzleTeamConfiguration,
      homes: DrizzleConfigurationHome,
    ) => new ConfigurationTarget(configurations, homes),
  },
  {
    provide: RepositoryProvisioning,
    inject: [REPOSITORY_CATALOG],
    useFactory: (catalog: RepositoryCatalogPort) =>
      new RepositoryProvisioning(catalog),
  },
  {
    provide: ReadConfiguration,
    inject: [
      REPOSITORY_CATALOG,
      HeldConfiguration,
      INTEGRATION_READER,
      SKILL_READER,
      HELD_SECRETS,
      LINES,
      DrizzleConfigurationHome,
      DrizzleTeamConfiguration,
      CLOCK,
      TRANSACTION,
    ],
    useFactory: (
      catalog: RepositoryCatalogPort,
      held: HeldConfiguration,
      integrations: IntegrationReaderPort,
      skills: SkillReaderPort,
      secrets: HeldSecretsPort,
      lines: LinesPort,
      homes: DrizzleConfigurationHome,
      configurations: DrizzleTeamConfiguration,
      clock: ClockPort,
      transaction: TransactionPort,
    ) =>
      new ReadConfiguration(
        catalog,
        held,
        integrations,
        skills,
        secrets,
        lines,
        homes,
        configurations,
        clock,
        transaction,
      ),
  },
  {
    provide: ProposeConfigurationChange,
    inject: [TEAMS, ConfigurationTarget, WriteConfiguration],
    useFactory: (
      teams: TeamsPort,
      target: ConfigurationTarget,
      writing: WriteConfiguration,
    ) => new ProposeConfigurationChange(teams, target, writing),
  },
];

const handlers: Provider[] = [
  ...bindCommandHandler(PinConfigurationCommand, PinConfigurationHandler, [
    TEAMS,
    DrizzleConfigurationHome,
    ConfigurationTarget,
    RepositoryProvisioning,
  ]),
  ...bindCommandHandler(MoveConfigurationCommand, MoveConfigurationHandler, [
    TEAMS,
    DrizzleConfigurationHome,
    DrizzleTeamConfiguration,
    ConfigurationTarget,
    RepositoryProvisioning,
    HeldConfiguration,
    WriteConfiguration,
  ]),
  ...bindCommandHandler(ReadConfigurationCommand, ReadConfigurationHandler, [
    TEAMS,
    ReadConfiguration,
  ]),
  ...bindCommandHandler(ChooseIntegrationsCommand, ChooseIntegrationsHandler, [
    ProposeConfigurationChange,
    STARTER_INTEGRATIONS,
  ]),
  ...bindQueryHandler(ConfigurationQuery, ConfigurationHandler, [
    TEAMS,
    CONFIGURATION_READER,
    INTEGRATION_LINKS,
  ]),
  ...bindQueryHandler(TeamSkillsQuery, TeamSkillsHandler, [
    TEAMS,
    DrizzleTeamConfiguration,
    SKILL_READER,
  ]),
];

const published: Provider[] = [
  {
    provide: APPLIED_CONFIGURATION,
    useClass: DrizzleAppliedConfigurationReader,
  },
  {
    provide: CONFIGURATION_PROPOSALS,
    inject: [
      TEAMS,
      DrizzleConfigurationHome,
      ConfigurationTarget,
      HeldConfiguration,
      PendingConfiguration,
      WriteConfiguration,
    ],
    useFactory: (
      teams: TeamsPort,
      homes: DrizzleConfigurationHome,
      target: ConfigurationTarget,
      held: HeldConfiguration,
      pending: PendingConfiguration,
      writing: WriteConfiguration,
    ) =>
      new ConfigurationProposals(teams, homes, target, held, pending, writing),
  },
  {
    provide: TEAM_SKILLS,
    inject: [DrizzleTeamConfiguration, SKILL_READER, HELD_SECRETS],
    useFactory: (
      configurations: DrizzleTeamConfiguration,
      reader: SkillReaderPort,
      secrets: HeldSecretsPort,
    ) => new TeamSkills(configurations, reader, secrets),
  },
  {
    provide: ConfigurationNotices,
    inject: [TEAMS, DrizzleConfigurationHome, ReadConfiguration],
    useFactory: (
      teams: TeamsPort,
      homes: DrizzleConfigurationHome,
      reading: ReadConfiguration,
    ) => new ConfigurationNotices(teams, homes, reading),
  },
];

export const CONFIGURATION_PROVIDERS: readonly Provider[] = [
  {
    provide: CONFIGURATION_EVENTS,
    inject: [
      EventTypes,
      EventSubscribers,
      SETUP_SETTLING,
      ConfigurationNotices,
      CONFIGURED_LINES,
      INTEGRATION_LINKS,
    ],
    useFactory: (
      types: EventTypes,
      subscribers: EventSubscribers,
      settling: SetupSettlingPort,
      notices: ConfigurationNotices,
      lines: ConfiguredLinesPort,
      links: IntegrationLinksPort,
    ) => {
      types.register('configuration', CONFIGURATION_EVENT_TYPES);
      subscribers.register(
        configurationSubscribers(settling, notices, lines, links),
      );
      return true;
    },
  },
  {
    provide: CONFIGURATION_STATUS,
    inject: [APPLIED_CONFIGURATION],
    useFactory: (applied: AppliedConfigurationPort) =>
      new ConfigurationStatus(applied),
  },
  ...upstream,
  ...adapters,
  ...services,
  ...handlers,
  ...published,
];
