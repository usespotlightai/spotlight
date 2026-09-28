import { AcceptInviteCommand } from '@identity/application/commands/accept-invite.command';
import { ChangeMemberRoleCommand } from '@identity/application/commands/change-member-role.command';
import { CreateTeamCommand } from '@identity/application/commands/create-team.command';
import { CreateWorkspaceCommand } from '@identity/application/commands/create-workspace.command';
import { DeleteTeamCommand } from '@identity/application/commands/delete-team.command';
import { DeleteWorkspaceCommand } from '@identity/application/commands/delete-workspace.command';
import { ExchangeWorkloadTokenCommand } from '@identity/application/commands/exchange-workload-token.command';
import { AcceptInviteHandler } from '@identity/application/commands/handlers/accept-invite.handler';
import { ChangeMemberRoleHandler } from '@identity/application/commands/handlers/change-member-role.handler';
import { CreateTeamHandler } from '@identity/application/commands/handlers/create-team.handler';
import { CreateWorkspaceHandler } from '@identity/application/commands/handlers/create-workspace.handler';
import { CreateWorkspaceTokenHandler } from '@identity/application/commands/handlers/create-workspace-token.handler';
import { CreateWorkspaceTokenTrustHandler } from '@identity/application/commands/handlers/create-workspace-token-trust.handler';
import { DeleteTeamHandler } from '@identity/application/commands/handlers/delete-team.handler';
import { DeleteWorkspaceHandler } from '@identity/application/commands/handlers/delete-workspace.handler';
import { DeleteWorkspaceTokenHandler } from '@identity/application/commands/handlers/delete-workspace-token.handler';
import { DeleteWorkspaceTokenTrustHandler } from '@identity/application/commands/handlers/delete-workspace-token-trust.handler';
import { ExchangeWorkloadTokenHandler } from '@identity/application/commands/handlers/exchange-workload-token.handler';
import { InviteToTeamHandler } from '@identity/application/commands/handlers/invite-to-team.handler';
import { OpenWorkspaceHandler } from '@identity/application/commands/handlers/open-workspace.handler';
import { RevokeInviteHandler } from '@identity/application/commands/handlers/revoke-invite.handler';
import { UpdateTeamHandler } from '@identity/application/commands/handlers/update-team.handler';
import { UpdateWorkspaceHandler } from '@identity/application/commands/handlers/update-workspace.handler';
import { UpdateWorkspaceTokenHandler } from '@identity/application/commands/handlers/update-workspace-token.handler';
import { UpdateWorkspaceTokenTrustHandler } from '@identity/application/commands/handlers/update-workspace-token-trust.handler';
import { InviteToTeamCommand } from '@identity/application/commands/invite-to-team.command';
import { OpenWorkspaceCommand } from '@identity/application/commands/open-workspace.command';
import { RevokeInviteCommand } from '@identity/application/commands/revoke-invite.command';
import { UpdateTeamCommand } from '@identity/application/commands/update-team.command';
import { UpdateWorkspaceCommand } from '@identity/application/commands/update-workspace.command';
import {
  CreateWorkspaceTokenCommand,
  DeleteWorkspaceTokenCommand,
  UpdateWorkspaceTokenCommand,
} from '@identity/application/commands/workspace-token.commands';
import {
  CreateWorkspaceTokenTrustCommand,
  DeleteWorkspaceTokenTrustCommand,
  UpdateWorkspaceTokenTrustCommand,
} from '@identity/application/commands/workspace-token-trust.commands';
import { IDENTITY_PUBLICATIONS } from '@identity/application/integration-events/identity.publications';
import {
  CONFIGURATION_AUDIT,
  type ConfigurationAuditPort,
} from '@identity/application/ports/configuration-audit.port';
import { IDENTITY_DEFINITIONS } from '@identity/application/ports/identity-definitions.port';
import {
  IDENTITY_RESOURCES,
  type IdentityResourcesPort,
} from '@identity/application/ports/identity-resources.port';
import { INVITE_MAIL } from '@identity/application/ports/invite-mail.port';
import { INVITE_READER } from '@identity/application/ports/invite-reader.port';
import { MEMBER_READER } from '@identity/application/ports/member-reader.port';
import { PERSON_READER } from '@identity/application/ports/person-reader.port';
import { TEAM_DIRECTORY } from '@identity/application/ports/team-directory.port';
import { TEAM_HOLDINGS } from '@identity/application/ports/team-holdings.port';
import { TOKEN_TRUST_CONFIGURATION } from '@identity/application/ports/token-trust-configuration.port';
import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
import { WORKSPACE_HOLDINGS } from '@identity/application/ports/workspace-holdings.port';
import { WORKSPACE_READER } from '@identity/application/ports/workspace-reader.port';
import { GetWorkspaceQuery } from '@identity/application/queries/get-workspace.query';
import { GetWorkspaceHandler } from '@identity/application/queries/handlers/get-workspace.handler';
import { ImportTeamHandler } from '@identity/application/queries/handlers/import-team.handler';
import { ImportWorkspaceHandler } from '@identity/application/queries/handlers/import-workspace.handler';
import { ListConfigurationChangesHandler } from '@identity/application/queries/handlers/list-configuration-changes.handler';
import { ListInvitesHandler } from '@identity/application/queries/handlers/list-invites.handler';
import { ListMembersHandler } from '@identity/application/queries/handlers/list-members.handler';
import { ListTeamResourcesHandler } from '@identity/application/queries/handlers/list-team-resources.handler';
import { ListWorkspaceResourcesHandler } from '@identity/application/queries/handlers/list-workspace-resources.handler';
import { ListWorkspacesHandler } from '@identity/application/queries/handlers/list-workspaces.handler';
import { ReadInviteHandler } from '@identity/application/queries/handlers/read-invite.handler';
import { ReadTeamHandler } from '@identity/application/queries/handlers/read-team.handler';
import { ReadWorkspaceHandler } from '@identity/application/queries/handlers/read-workspace.handler';
import {
  ImportWorkspaceTokenHandler,
  ListWorkspaceTokenResourcesHandler,
  ReadWorkspaceTokenHandler,
} from '@identity/application/queries/handlers/workspace-token.handlers';
import {
  ImportWorkspaceTokenTrustHandler,
  ListWorkspaceTokenTrustResourcesHandler,
  ReadWorkspaceTokenTrustHandler,
} from '@identity/application/queries/handlers/workspace-token-trust.handlers';
import { ImportTeamQuery } from '@identity/application/queries/import-team.query';
import { ImportWorkspaceQuery } from '@identity/application/queries/import-workspace.query';
import { ListConfigurationChangesQuery } from '@identity/application/queries/list-configuration-changes.query';
import { ListInvitesQuery } from '@identity/application/queries/list-invites.query';
import { ListMembersQuery } from '@identity/application/queries/list-members.query';
import { ListTeamResourcesQuery } from '@identity/application/queries/list-team-resources.query';
import { ListWorkspaceResourcesQuery } from '@identity/application/queries/list-workspace-resources.query';
import { ListWorkspacesQuery } from '@identity/application/queries/list-workspaces.query';
import { ReadInviteQuery } from '@identity/application/queries/read-invite.query';
import { ReadTeamQuery } from '@identity/application/queries/read-team.query';
import { ReadWorkspaceQuery } from '@identity/application/queries/read-workspace.query';
import {
  ImportWorkspaceTokenQuery,
  ListWorkspaceTokenResourcesQuery,
  ReadWorkspaceTokenQuery,
} from '@identity/application/queries/workspace-token.queries';
import {
  ImportWorkspaceTokenTrustQuery,
  ListWorkspaceTokenTrustResourcesQuery,
  ReadWorkspaceTokenTrustQuery,
} from '@identity/application/queries/workspace-token-trust.queries';
import { FirstTeam } from '@identity/application/services/first-team.service';
import { HoldingsRegistry } from '@identity/application/services/holdings-registry.service';
import { InviteMemberships } from '@identity/application/services/invite-memberships.service';
import { MintedTokens } from '@identity/application/services/minted-tokens.service';
import { TeamAdministration } from '@identity/application/services/team-administration.service';
import { TeamDirectory } from '@identity/application/services/team-directory.service';
import { TokenBearers } from '@identity/application/services/token-bearers.service';
import { TokenTrustConfiguration } from '@identity/application/services/token-trust-configuration.service';
import { WorkspaceAccess } from '@identity/application/services/workspace-access.service';
import { IDENTITY_EVENT_TYPES } from '@identity/domain/event-types';
import { IdentityDefinitions } from '@identity/infrastructure/definitions/identity-definitions';
import { InviteByMail } from '@identity/infrastructure/mail/invite.mail';
import type { MailTransport } from '@identity/infrastructure/mail/mail.transport';
import { SmtpMail } from '@identity/infrastructure/mail/smtp.transport';
import { WrittenDownMail } from '@identity/infrastructure/mail/written-down.mail';
import { DrizzleConfigurationAudit } from '@identity/infrastructure/persistence/drizzle/configuration-audit';
import { DrizzleIdentityResources } from '@identity/infrastructure/persistence/drizzle/readers/identity-resources.reader';
import { DrizzleInviteReader } from '@identity/infrastructure/persistence/drizzle/readers/invite.reader';
import { DrizzleMemberReader } from '@identity/infrastructure/persistence/drizzle/readers/member.reader';
import { DrizzlePersonReader } from '@identity/infrastructure/persistence/drizzle/readers/person.reader';
import { DrizzleViewableWorkspaces } from '@identity/infrastructure/persistence/drizzle/readers/viewable-workspaces.reader';
import { DrizzleWorkspaceReader } from '@identity/infrastructure/persistence/drizzle/readers/workspace.reader';
import { DrizzleInviteRepository } from '@identity/infrastructure/persistence/drizzle/repositories/invite.repository';
import { DrizzleTeamRepository } from '@identity/infrastructure/persistence/drizzle/repositories/team.repository';
import { DrizzleWorkspaceRepository } from '@identity/infrastructure/persistence/drizzle/repositories/workspace.repository';
import { DrizzleWorkspaceTokenRepository } from '@identity/infrastructure/persistence/drizzle/repositories/workspace-token.repository';
import { DrizzleWorkspaceTokenTrustRepository } from '@identity/infrastructure/persistence/drizzle/repositories/workspace-token-trust.repository';
import { identityProjections } from '@identity/presentation/events/identity.projections';
import { identitySubscribers } from '@identity/presentation/events/identity.subscribers';
import { ConfigurationChangeController } from '@identity/presentation/http/controllers/configuration-change.controller';
import {
  InviteController,
  TeamInviteController,
} from '@identity/presentation/http/controllers/invite.controller';
import { TeamController } from '@identity/presentation/http/controllers/team.controller';
import { TeamResourceController } from '@identity/presentation/http/controllers/team-resource.controller';
import { WorkloadTokenExchangeController } from '@identity/presentation/http/controllers/workload-token-exchange.controller';
import { WorkspaceController } from '@identity/presentation/http/controllers/workspace.controller';
import { WorkspaceResourceController } from '@identity/presentation/http/controllers/workspace-resource.controller';
import { WorkspaceTokenResourceController } from '@identity/presentation/http/controllers/workspace-token-resource.controller';
import { WorkspaceTokenTrustResourceController } from '@identity/presentation/http/controllers/workspace-token-trust-resource.controller';
import { ExpiredTokensWorker } from '@identity/presentation/workers/expired-tokens.worker';
import type { Provider, Type } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventProjections } from '@platform/events/event-projections';
import { EventPublications } from '@platform/events/event-publications';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { EventTypes } from '@platform/events/event-types';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import { ID_GENERATOR } from '@shared-kernel/application/ports/id-generator.port';
import { IDEMPOTENT_CREATES } from '@shared-kernel/application/ports/idempotent-creates.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import {
  TOKEN_MINT,
  type TokenMintPort,
} from '@shared-kernel/application/ports/token-mint.port';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';
import { WORKLOAD_TOKENS } from '@shared-kernel/application/ports/workload-tokens.port';
import { WORKSPACE_TOKEN_IDENTITY } from '@shared-kernel/application/ports/workspace-token-identity.port';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const IDENTITY_EVENTS = Symbol('IDENTITY_EVENTS');

export const IDENTITY_CONTROLLERS: readonly Type[] = [
  WorkspaceResourceController,
  TeamResourceController,
  WorkspaceTokenResourceController,
  WorkspaceTokenTrustResourceController,
  WorkloadTokenExchangeController,
  WorkspaceController,
  ConfigurationChangeController,
  TeamController,
  TeamInviteController,
  InviteController,
];

const adapters: Provider[] = [
  DrizzleWorkspaceRepository,
  DrizzleTeamRepository,
  DrizzleInviteRepository,
  DrizzleWorkspaceTokenRepository,
  DrizzleWorkspaceTokenTrustRepository,
  DrizzleViewableWorkspaces,
  { provide: WORKSPACE_READER, useClass: DrizzleWorkspaceReader },
  { provide: PERSON_READER, useClass: DrizzlePersonReader },
  { provide: MEMBER_READER, useClass: DrizzleMemberReader },
  { provide: INVITE_READER, useClass: DrizzleInviteReader },
  { provide: IDENTITY_DEFINITIONS, useClass: IdentityDefinitions },
  { provide: TEAM_HOLDINGS, useFactory: () => new HoldingsRegistry<TeamId>() },
  {
    provide: WORKSPACE_HOLDINGS,
    useFactory: () => new HoldingsRegistry<WorkspaceId>(),
  },
  { provide: IDENTITY_RESOURCES, useClass: DrizzleIdentityResources },
  { provide: CONFIGURATION_AUDIT, useClass: DrizzleConfigurationAudit },
  {
    provide: INVITE_MAIL,
    inject: [ENV, LOGGER],
    useFactory: (env: Env, logger: LoggerPort) => {
      const transport: MailTransport =
        SmtpMail.configured(env) ?? new WrittenDownMail(logger);

      return new InviteByMail(transport, env);
    },
  },
];

const services: Provider[] = [
  {
    provide: TeamAdministration,
    inject: [DrizzleTeamRepository, DrizzleWorkspaceRepository],
    useFactory: (
      teams: DrizzleTeamRepository,
      workspaces: DrizzleWorkspaceRepository,
    ) => new TeamAdministration(teams, workspaces),
  },
  {
    provide: MintedTokens,
    inject: [DrizzleWorkspaceTokenRepository, CLOCK, TRANSACTION],
    useFactory: (
      tokens: DrizzleWorkspaceTokenRepository,
      clock: ClockPort,
      transaction: TransactionPort,
    ) => new MintedTokens(tokens, clock, transaction),
  },
  {
    provide: ExpiredTokensWorker,
    inject: [MintedTokens, LOGGER],
    useFactory: (minted: MintedTokens, logger: LoggerPort) =>
      new ExpiredTokensWorker(minted, logger),
  },
];

const handlers: Provider[] = [
  ...bindQueryHandler(ListWorkspacesQuery, ListWorkspacesHandler, [
    WORKSPACE_READER,
  ]),
  ...bindQueryHandler(GetWorkspaceQuery, GetWorkspaceHandler, [
    WORKSPACE_READER,
  ]),
  ...bindQueryHandler(ListMembersQuery, ListMembersHandler, [MEMBER_READER]),
  ...bindQueryHandler(ListInvitesQuery, ListInvitesHandler, [INVITE_READER]),
  ...bindQueryHandler(ReadInviteQuery, ReadInviteHandler, [
    INVITE_READER,
    TOKEN_MINT,
  ]),
  ...bindCommandHandler(OpenWorkspaceCommand, OpenWorkspaceHandler, [
    DrizzleWorkspaceRepository,
    ID_GENERATOR,
  ]),
  ...bindCommandHandler(CreateWorkspaceCommand, CreateWorkspaceHandler, [
    IDENTITY_DEFINITIONS,
    DrizzleWorkspaceRepository,
    IDEMPOTENT_CREATES,
    ID_GENERATOR,
    TRANSACTION,
  ]),
  ...bindCommandHandler(UpdateWorkspaceCommand, UpdateWorkspaceHandler, [
    IDENTITY_DEFINITIONS,
    DrizzleWorkspaceRepository,
    TRANSACTION,
  ]),
  ...bindCommandHandler(DeleteWorkspaceCommand, DeleteWorkspaceHandler, [
    DrizzleWorkspaceRepository,
    IDENTITY_RESOURCES,
    WORKSPACE_HOLDINGS,
    TRANSACTION,
  ]),
  ...bindQueryHandler(ReadWorkspaceQuery, ReadWorkspaceHandler, [
    WORKSPACE_ACCESS,
    IDENTITY_RESOURCES,
  ]),
  ...bindQueryHandler(ImportWorkspaceQuery, ImportWorkspaceHandler, [
    WORKSPACE_ACCESS,
    IDENTITY_RESOURCES,
  ]),
  ...bindQueryHandler(
    ListWorkspaceResourcesQuery,
    ListWorkspaceResourcesHandler,
    [WORKSPACE_ACCESS, IDENTITY_RESOURCES],
  ),
  ...bindCommandHandler(CreateTeamCommand, CreateTeamHandler, [
    WORKSPACE_ACCESS,
    IDENTITY_DEFINITIONS,
    DrizzleTeamRepository,
    IDEMPOTENT_CREATES,
    ID_GENERATOR,
    TRANSACTION,
  ]),
  ...bindCommandHandler(UpdateTeamCommand, UpdateTeamHandler, [
    WORKSPACE_ACCESS,
    IDENTITY_DEFINITIONS,
    DrizzleTeamRepository,
    TRANSACTION,
  ]),
  ...bindCommandHandler(DeleteTeamCommand, DeleteTeamHandler, [
    WORKSPACE_ACCESS,
    DrizzleTeamRepository,
    TEAM_HOLDINGS,
    TRANSACTION,
  ]),
  ...bindQueryHandler(ReadTeamQuery, ReadTeamHandler, [
    WORKSPACE_ACCESS,
    IDENTITY_RESOURCES,
  ]),
  ...bindQueryHandler(ImportTeamQuery, ImportTeamHandler, [
    WORKSPACE_ACCESS,
    IDENTITY_RESOURCES,
  ]),
  ...bindQueryHandler(ListTeamResourcesQuery, ListTeamResourcesHandler, [
    WORKSPACE_ACCESS,
    IDENTITY_RESOURCES,
  ]),
  ...bindCommandHandler(
    CreateWorkspaceTokenCommand,
    CreateWorkspaceTokenHandler,
    [
      WORKSPACE_ACCESS,
      IDENTITY_DEFINITIONS,
      DrizzleWorkspaceTokenRepository,
      IDEMPOTENT_CREATES,
      ID_GENERATOR,
      TOKEN_MINT,
      CLOCK,
      TRANSACTION,
    ],
  ),
  ...bindCommandHandler(
    UpdateWorkspaceTokenCommand,
    UpdateWorkspaceTokenHandler,
    [
      WORKSPACE_ACCESS,
      IDENTITY_DEFINITIONS,
      DrizzleWorkspaceTokenRepository,
      TRANSACTION,
    ],
  ),
  ...bindCommandHandler(
    DeleteWorkspaceTokenCommand,
    DeleteWorkspaceTokenHandler,
    [WORKSPACE_ACCESS, DrizzleWorkspaceTokenRepository, TRANSACTION],
  ),
  ...bindQueryHandler(ReadWorkspaceTokenQuery, ReadWorkspaceTokenHandler, [
    WORKSPACE_ACCESS,
    IDENTITY_RESOURCES,
  ]),
  ...bindQueryHandler(ImportWorkspaceTokenQuery, ImportWorkspaceTokenHandler, [
    WORKSPACE_ACCESS,
    IDENTITY_RESOURCES,
  ]),
  ...bindQueryHandler(
    ListWorkspaceTokenResourcesQuery,
    ListWorkspaceTokenResourcesHandler,
    [WORKSPACE_ACCESS, IDENTITY_RESOURCES],
  ),
  ...bindCommandHandler(
    CreateWorkspaceTokenTrustCommand,
    CreateWorkspaceTokenTrustHandler,
    [
      WORKSPACE_ACCESS,
      IDENTITY_DEFINITIONS,
      DrizzleWorkspaceTokenTrustRepository,
      IDEMPOTENT_CREATES,
      ID_GENERATOR,
      TRANSACTION,
    ],
  ),
  ...bindCommandHandler(
    UpdateWorkspaceTokenTrustCommand,
    UpdateWorkspaceTokenTrustHandler,
    [
      WORKSPACE_ACCESS,
      IDENTITY_DEFINITIONS,
      DrizzleWorkspaceTokenTrustRepository,
      TRANSACTION,
    ],
  ),
  ...bindCommandHandler(
    DeleteWorkspaceTokenTrustCommand,
    DeleteWorkspaceTokenTrustHandler,
    [WORKSPACE_ACCESS, DrizzleWorkspaceTokenTrustRepository, TRANSACTION],
  ),
  ...bindQueryHandler(
    ReadWorkspaceTokenTrustQuery,
    ReadWorkspaceTokenTrustHandler,
    [WORKSPACE_ACCESS, IDENTITY_RESOURCES],
  ),
  ...bindQueryHandler(
    ImportWorkspaceTokenTrustQuery,
    ImportWorkspaceTokenTrustHandler,
    [WORKSPACE_ACCESS, IDENTITY_RESOURCES],
  ),
  ...bindQueryHandler(
    ListWorkspaceTokenTrustResourcesQuery,
    ListWorkspaceTokenTrustResourcesHandler,
    [WORKSPACE_ACCESS, IDENTITY_RESOURCES],
  ),
  ...bindCommandHandler(
    ExchangeWorkloadTokenCommand,
    ExchangeWorkloadTokenHandler,
    [
      DrizzleWorkspaceTokenTrustRepository,
      DrizzleWorkspaceTokenRepository,
      WORKLOAD_TOKENS,
      ID_GENERATOR,
      TOKEN_MINT,
      CLOCK,
      TRANSACTION,
    ],
  ),
  ...bindQueryHandler(
    ListConfigurationChangesQuery,
    ListConfigurationChangesHandler,
    [DrizzleWorkspaceRepository, CONFIGURATION_AUDIT],
  ),
  ...bindCommandHandler(InviteToTeamCommand, InviteToTeamHandler, [
    TeamAdministration,
    DrizzleInviteRepository,
    MEMBER_READER,
    PERSON_READER,
    TOKEN_MINT,
    INVITE_MAIL,
    ID_GENERATOR,
    CLOCK,
  ]),
  ...bindCommandHandler(RevokeInviteCommand, RevokeInviteHandler, [
    TeamAdministration,
    DrizzleInviteRepository,
    CLOCK,
  ]),
  ...bindCommandHandler(ChangeMemberRoleCommand, ChangeMemberRoleHandler, [
    DrizzleWorkspaceRepository,
  ]),
  ...bindCommandHandler(AcceptInviteCommand, AcceptInviteHandler, [
    DrizzleInviteRepository,
    DrizzleTeamRepository,
    DrizzleWorkspaceRepository,
    TOKEN_MINT,
    CLOCK,
  ]),
];

const published: Provider[] = [
  {
    provide: IDENTITY_EVENTS,
    inject: [
      EventTypes,
      EventPublications,
      EventSubscribers,
      EventProjections,
      DrizzleWorkspaceRepository,
      DrizzleTeamRepository,
      CONFIGURATION_AUDIT,
      MintedTokens,
    ],
    useFactory: (
      types: EventTypes,
      publications: EventPublications,
      subscribers: EventSubscribers,
      projections: EventProjections,
      workspaces: DrizzleWorkspaceRepository,
      teams: DrizzleTeamRepository,
      audit: ConfigurationAuditPort,
      minted: MintedTokens,
    ) => {
      types.register('identity', IDENTITY_EVENT_TYPES);
      publications.register(IDENTITY_PUBLICATIONS);
      projections.register(identityProjections(audit));
      subscribers.register(
        identitySubscribers(
          new InviteMemberships(workspaces, teams),
          new FirstTeam(teams),
          minted,
        ),
      );
      return true;
    },
  },
  {
    provide: WORKSPACE_ACCESS,
    inject: [
      DrizzleViewableWorkspaces,
      DrizzleWorkspaceRepository,
      IDENTITY_RESOURCES,
    ],
    useFactory: (
      visibility: DrizzleViewableWorkspaces,
      workspaces: DrizzleWorkspaceRepository,
      resources: IdentityResourcesPort,
    ) => new WorkspaceAccess(visibility, workspaces, resources),
  },
  {
    provide: WORKSPACE_TOKEN_IDENTITY,
    inject: [
      DrizzleWorkspaceTokenRepository,
      DrizzleWorkspaceTokenTrustRepository,
      TOKEN_MINT,
      CLOCK,
    ],
    useFactory: (
      tokens: DrizzleWorkspaceTokenRepository,
      trusts: DrizzleWorkspaceTokenTrustRepository,
      mint: TokenMintPort,
      clock: ClockPort,
    ) => new TokenBearers(tokens, trusts, mint, clock),
  },
  {
    provide: TOKEN_TRUST_CONFIGURATION,
    inject: [IDENTITY_RESOURCES],
    useFactory: (resources: IdentityResourcesPort) =>
      new TokenTrustConfiguration(resources),
  },
  {
    provide: TEAM_DIRECTORY,
    inject: [DrizzleTeamRepository],
    useFactory: (teams: DrizzleTeamRepository) => new TeamDirectory(teams),
  },
];

export const IDENTITY_PROVIDERS: readonly Provider[] = [
  ...adapters,
  ...services,
  ...handlers,
  ...published,
];
