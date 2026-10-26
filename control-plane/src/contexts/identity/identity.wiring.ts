import { AcceptInviteCommand } from '@identity/application/commands/accept-invite.command';
import { AddTeamMemberCommand } from '@identity/application/commands/add-team-member.command';
import { ChangeMemberRoleCommand } from '@identity/application/commands/change-member-role.command';
import { CreateTeamCommand } from '@identity/application/commands/create-team.command';
import { CreateWorkspaceCommand } from '@identity/application/commands/create-workspace.command';
import { CreateWorkspaceWithTeamCommand } from '@identity/application/commands/create-workspace-with-team.command';
import { DeleteTeamCommand } from '@identity/application/commands/delete-team.command';
import { DeleteWorkspaceCommand } from '@identity/application/commands/delete-workspace.command';
import { ExchangeWorkloadTokenCommand } from '@identity/application/commands/exchange-workload-token.command';
import { AcceptInviteHandler } from '@identity/application/commands/handlers/accept-invite.handler';
import { AddTeamMemberHandler } from '@identity/application/commands/handlers/add-team-member.handler';
import { ChangeMemberRoleHandler } from '@identity/application/commands/handlers/change-member-role.handler';
import { CreateOidcTrustHandler } from '@identity/application/commands/handlers/create-oidc-trust.handler';
import { CreateTeamHandler } from '@identity/application/commands/handlers/create-team.handler';
import { CreateWorkspaceHandler } from '@identity/application/commands/handlers/create-workspace.handler';
import { CreateWorkspaceTokenHandler } from '@identity/application/commands/handlers/create-workspace-token.handler';
import { CreateWorkspaceWithTeamHandler } from '@identity/application/commands/handlers/create-workspace-with-team.handler';
import { DeleteOidcTrustHandler } from '@identity/application/commands/handlers/delete-oidc-trust.handler';
import { DeleteTeamHandler } from '@identity/application/commands/handlers/delete-team.handler';
import { DeleteWorkspaceHandler } from '@identity/application/commands/handlers/delete-workspace.handler';
import { DeleteWorkspaceTokenHandler } from '@identity/application/commands/handlers/delete-workspace-token.handler';
import { ExchangeWorkloadTokenHandler } from '@identity/application/commands/handlers/exchange-workload-token.handler';
import { InviteToWorkspaceHandler } from '@identity/application/commands/handlers/invite-to-workspace.handler';
import { ResendInviteHandler } from '@identity/application/commands/handlers/resend-invite.handler';
import { RevokeInviteHandler } from '@identity/application/commands/handlers/revoke-invite.handler';
import { UpdateOidcTrustHandler } from '@identity/application/commands/handlers/update-oidc-trust.handler';
import { UpdateTeamHandler } from '@identity/application/commands/handlers/update-team.handler';
import { UpdateWorkspaceHandler } from '@identity/application/commands/handlers/update-workspace.handler';
import { UpdateWorkspaceTokenHandler } from '@identity/application/commands/handlers/update-workspace-token.handler';
import { InviteToWorkspaceCommand } from '@identity/application/commands/invite-to-workspace.command';
import {
  CreateOidcTrustCommand,
  DeleteOidcTrustCommand,
  UpdateOidcTrustCommand,
} from '@identity/application/commands/oidc-trust.commands';
import { ResendInviteCommand } from '@identity/application/commands/resend-invite.command';
import { RevokeInviteCommand } from '@identity/application/commands/revoke-invite.command';
import { UpdateTeamCommand } from '@identity/application/commands/update-team.command';
import { UpdateWorkspaceCommand } from '@identity/application/commands/update-workspace.command';
import {
  CreateWorkspaceTokenCommand,
  DeleteWorkspaceTokenCommand,
  UpdateWorkspaceTokenCommand,
} from '@identity/application/commands/workspace-token.commands';
import { IDENTITY_EVENT_MAPPERS } from '@identity/application/integration-events/identity.event-mappers';
import {
  CONFIGURATION_AUDIT,
  type ConfigurationAuditPort,
} from '@identity/application/ports/configuration-audit.port';
import { GITHUB_ACTIONS_TRUSTS } from '@identity/application/ports/github-actions-trusts.port';
import { IDENTITY_DEFINITIONS } from '@identity/application/ports/identity-definitions.port';
import {
  IDENTITY_RESOURCES,
  type IdentityResourcesPort,
} from '@identity/application/ports/identity-resources.port';
import {
  INVITE_MAIL,
  type InviteMailPort,
} from '@identity/application/ports/invite-mail.port';
import { INVITE_READER } from '@identity/application/ports/invite-reader.port';
import { MEMBER_DIRECTORY } from '@identity/application/ports/member-directory.port';
import { MEMBER_READER } from '@identity/application/ports/member-reader.port';
import { OIDC_TRUST_CONFIGURATION } from '@identity/application/ports/oidc-trust-configuration.port';
import { OIDC_TRUST_READER } from '@identity/application/ports/oidc-trust-reader.port';
import {
  OIDC_TRUST_USAGE,
  type OidcTrustUsagePort,
} from '@identity/application/ports/oidc-trust-usage.port';
import {
  PERSON_READER,
  type PersonReaderPort,
} from '@identity/application/ports/person-reader.port';
import { RUN_TOKENS } from '@identity/application/ports/run-tokens.port';
import { SIGNUP_SURVEYS } from '@identity/application/ports/signup-surveys.port';
import { TEAM_DEPENDENTS } from '@identity/application/ports/team-dependents.port';
import { TEAM_DIRECTORY } from '@identity/application/ports/team-directory.port';
import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import { WORKSPACE_DEPENDENTS } from '@identity/application/ports/workspace-dependents.port';
import { WORKSPACE_READER } from '@identity/application/ports/workspace-reader.port';
import { WORKSPACE_SETUP_STATUS } from '@identity/application/ports/workspace-setup-status.port';
import { GetWorkspaceQuery } from '@identity/application/queries/get-workspace.query';
import { GetWorkspaceHandler } from '@identity/application/queries/handlers/get-workspace.handler';
import { ImportTeamHandler } from '@identity/application/queries/handlers/import-team.handler';
import { ImportWorkspaceHandler } from '@identity/application/queries/handlers/import-workspace.handler';
import { ListConfigurationChangesHandler } from '@identity/application/queries/handlers/list-configuration-changes.handler';
import { ListMembersHandler } from '@identity/application/queries/handlers/list-members.handler';
import { ListOidcTrustsHandler } from '@identity/application/queries/handlers/list-oidc-trusts.handler';
import { ListTeamResourcesHandler } from '@identity/application/queries/handlers/list-team-resources.handler';
import { ListWorkspaceInvitesHandler } from '@identity/application/queries/handlers/list-workspace-invites.handler';
import { ListWorkspaceMembersHandler } from '@identity/application/queries/handlers/list-workspace-members.handler';
import { ListWorkspaceResourcesHandler } from '@identity/application/queries/handlers/list-workspace-resources.handler';
import { ListWorkspacesHandler } from '@identity/application/queries/handlers/list-workspaces.handler';
import {
  ImportOidcTrustHandler,
  ListOidcTrustResourcesHandler,
  ReadOidcTrustHandler,
} from '@identity/application/queries/handlers/oidc-trust.handlers';
import { ReadInviteHandler } from '@identity/application/queries/handlers/read-invite.handler';
import { ReadTeamHandler } from '@identity/application/queries/handlers/read-team.handler';
import { ReadWorkspaceHandler } from '@identity/application/queries/handlers/read-workspace.handler';
import {
  ImportWorkspaceTokenHandler,
  ListWorkspaceTokenResourcesHandler,
  ReadWorkspaceTokenHandler,
} from '@identity/application/queries/handlers/workspace-token.handlers';
import { ImportTeamQuery } from '@identity/application/queries/import-team.query';
import { ImportWorkspaceQuery } from '@identity/application/queries/import-workspace.query';
import { ListConfigurationChangesQuery } from '@identity/application/queries/list-configuration-changes.query';
import { ListMembersQuery } from '@identity/application/queries/list-members.query';
import { ListOidcTrustsQuery } from '@identity/application/queries/list-oidc-trusts.query';
import { ListTeamResourcesQuery } from '@identity/application/queries/list-team-resources.query';
import { ListWorkspaceInvitesQuery } from '@identity/application/queries/list-workspace-invites.query';
import { ListWorkspaceMembersQuery } from '@identity/application/queries/list-workspace-members.query';
import { ListWorkspaceResourcesQuery } from '@identity/application/queries/list-workspace-resources.query';
import { ListWorkspacesQuery } from '@identity/application/queries/list-workspaces.query';
import {
  ImportOidcTrustQuery,
  ListOidcTrustResourcesQuery,
  ReadOidcTrustQuery,
} from '@identity/application/queries/oidc-trust.queries';
import { ReadInviteQuery } from '@identity/application/queries/read-invite.query';
import { ReadTeamQuery } from '@identity/application/queries/read-team.query';
import { ReadWorkspaceQuery } from '@identity/application/queries/read-workspace.query';
import {
  ImportWorkspaceTokenQuery,
  ListWorkspaceTokenResourcesQuery,
  ReadWorkspaceTokenQuery,
} from '@identity/application/queries/workspace-token.queries';
import { DependentsRegistry } from '@identity/application/services/dependents-registry.service';
import { FirstTeam } from '@identity/application/services/first-team.service';
import { GitHubActionsTrusts } from '@identity/application/services/github-actions-trusts.service';
import { InviteMemberships } from '@identity/application/services/invite-memberships.service';
import { InviteSending } from '@identity/application/services/invite-sending.service';
import { IssuedTokens } from '@identity/application/services/issued-tokens.service';
import { OidcTrustConfiguration } from '@identity/application/services/oidc-trust-configuration.service';
import { RunTokens } from '@identity/application/services/run-tokens.service';
import { TeamAdministration } from '@identity/application/services/team-administration.service';
import { TeamDirectory } from '@identity/application/services/team-directory.service';
import { TokenAuthenticator } from '@identity/application/services/token-authenticator.service';
import { WorkspaceAccess } from '@identity/application/services/workspace-access.service';
import { WorkspaceAdministration } from '@identity/application/services/workspace-administration.service';
import { IDENTITY_PAYLOAD_TYPES } from '@identity/domain/payload-types';
import { IdentityDefinitions } from '@identity/infrastructure/definitions/identity-definitions';
import { OutboxWorkspaceSetupStatus } from '@identity/infrastructure/events/outbox-workspace-setup-status';
import { InviteByMail } from '@identity/infrastructure/mail/invite.mail';
import { LogMailTransport } from '@identity/infrastructure/mail/log.transport';
import type { MailTransport } from '@identity/infrastructure/mail/mail.transport';
import { SmtpMail } from '@identity/infrastructure/mail/smtp.transport';
import { DrizzleConfigurationAudit } from '@identity/infrastructure/persistence/drizzle/configuration-audit';
import { DrizzleOidcTrustUsage } from '@identity/infrastructure/persistence/drizzle/oidc-trust-usage';
import { DrizzleIdentityResources } from '@identity/infrastructure/persistence/drizzle/readers/identity-resources.reader';
import { DrizzleInviteReader } from '@identity/infrastructure/persistence/drizzle/readers/invite.reader';
import { DrizzleMemberReader } from '@identity/infrastructure/persistence/drizzle/readers/member.reader';
import { DrizzleMemberDirectory } from '@identity/infrastructure/persistence/drizzle/readers/member-directory.reader';
import { DrizzleOidcTrustReader } from '@identity/infrastructure/persistence/drizzle/readers/oidc-trust.reader';
import { DrizzlePersonReader } from '@identity/infrastructure/persistence/drizzle/readers/person.reader';
import { DrizzleViewableWorkspaces } from '@identity/infrastructure/persistence/drizzle/readers/viewable-workspaces.reader';
import { DrizzleWorkspaceReader } from '@identity/infrastructure/persistence/drizzle/readers/workspace.reader';
import { DrizzleOidcTrustRepository } from '@identity/infrastructure/persistence/drizzle/repositories/oidc-trust.repository';
import { DrizzleTeamRepository } from '@identity/infrastructure/persistence/drizzle/repositories/team.repository';
import { DrizzleWorkspaceRepository } from '@identity/infrastructure/persistence/drizzle/repositories/workspace.repository';
import { DrizzleWorkspaceInviteRepository } from '@identity/infrastructure/persistence/drizzle/repositories/workspace-invite.repository';
import { DrizzleWorkspaceTokenRepository } from '@identity/infrastructure/persistence/drizzle/repositories/workspace-token.repository';
import { DrizzleSignupSurveys } from '@identity/infrastructure/persistence/drizzle/signup-surveys';
import { identityProjections } from '@identity/presentation/events/identity.projections';
import { identitySubscribers } from '@identity/presentation/events/identity.subscribers';
import { ConfigurationChangeController } from '@identity/presentation/http/controllers/configuration-change.controller';
import {
  InviteController,
  WorkspaceInviteController,
} from '@identity/presentation/http/controllers/invite.controller';
import { OidcTrustController } from '@identity/presentation/http/controllers/oidc-trust.controller';
import { OidcTrustResourceController } from '@identity/presentation/http/controllers/oidc-trust-resource.controller';
import { TeamController } from '@identity/presentation/http/controllers/team.controller';
import { TeamResourceController } from '@identity/presentation/http/controllers/team-resource.controller';
import { WorkloadTokenExchangeController } from '@identity/presentation/http/controllers/workload-token-exchange.controller';
import { WorkspaceController } from '@identity/presentation/http/controllers/workspace.controller';
import { WorkspaceResourceController } from '@identity/presentation/http/controllers/workspace-resource.controller';
import { WorkspaceTokenResourceController } from '@identity/presentation/http/controllers/workspace-token-resource.controller';
import { ExpiredTokensWorker } from '@identity/presentation/workers/expired-tokens.worker';
import type { Provider, Type } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventProjections } from '@platform/events/event-projections';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import { PayloadTypes } from '@platform/events/payload-types';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import {
  ID_GENERATOR,
  type IdGeneratorPort,
} from '@shared-kernel/application/ports/id-generator.port';
import { IDEMPOTENT_CREATES } from '@shared-kernel/application/ports/idempotent-creates.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import {
  TOKEN_ISSUER,
  type TokenIssuer,
} from '@shared-kernel/application/ports/token-issuer.port';
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
  OidcTrustResourceController,
  WorkloadTokenExchangeController,
  WorkspaceController,
  ConfigurationChangeController,
  OidcTrustController,
  TeamController,
  WorkspaceInviteController,
  InviteController,
];

const adapters: Provider[] = [
  DrizzleWorkspaceRepository,
  DrizzleTeamRepository,
  DrizzleWorkspaceInviteRepository,
  DrizzleWorkspaceTokenRepository,
  DrizzleOidcTrustRepository,
  DrizzleViewableWorkspaces,
  { provide: WORKSPACE_READER, useClass: DrizzleWorkspaceReader },
  { provide: WORKSPACE_SETUP_STATUS, useClass: OutboxWorkspaceSetupStatus },
  { provide: PERSON_READER, useClass: DrizzlePersonReader },
  { provide: MEMBER_READER, useClass: DrizzleMemberReader },
  { provide: OIDC_TRUST_READER, useClass: DrizzleOidcTrustReader },
  { provide: MEMBER_DIRECTORY, useClass: DrizzleMemberDirectory },
  { provide: INVITE_READER, useClass: DrizzleInviteReader },
  { provide: IDENTITY_DEFINITIONS, useClass: IdentityDefinitions },
  {
    provide: TEAM_DEPENDENTS,
    useFactory: () => new DependentsRegistry<TeamId>(),
  },
  {
    provide: WORKSPACE_DEPENDENTS,
    useFactory: () => new DependentsRegistry<WorkspaceId>(),
  },
  { provide: IDENTITY_RESOURCES, useClass: DrizzleIdentityResources },
  { provide: CONFIGURATION_AUDIT, useClass: DrizzleConfigurationAudit },
  { provide: OIDC_TRUST_USAGE, useClass: DrizzleOidcTrustUsage },
  { provide: SIGNUP_SURVEYS, useClass: DrizzleSignupSurveys },
  {
    provide: INVITE_MAIL,
    inject: [ENV, LOGGER],
    useFactory: (env: Env, logger: LoggerPort) => {
      const transport: MailTransport =
        SmtpMail.configured(env) ?? new LogMailTransport(logger);

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
    provide: WorkspaceAdministration,
    inject: [DrizzleWorkspaceRepository],
    useFactory: (workspaces: DrizzleWorkspaceRepository) =>
      new WorkspaceAdministration(workspaces),
  },
  {
    provide: InviteSending,
    inject: [PERSON_READER, INVITE_MAIL, LOGGER],
    useFactory: (
      people: PersonReaderPort,
      mail: InviteMailPort,
      logger: LoggerPort,
    ) => new InviteSending(people, mail, logger),
  },
  {
    provide: IssuedTokens,
    inject: [DrizzleWorkspaceTokenRepository, CLOCK, TRANSACTION],
    useFactory: (
      tokens: DrizzleWorkspaceTokenRepository,
      clock: ClockPort,
      transaction: TransactionPort,
    ) => new IssuedTokens(tokens, clock, transaction),
  },
  {
    provide: RUN_TOKENS,
    inject: [
      DrizzleWorkspaceTokenRepository,
      TOKEN_ISSUER,
      ID_GENERATOR,
      CLOCK,
      TRANSACTION,
    ],
    useFactory: (
      tokens: DrizzleWorkspaceTokenRepository,
      issuer: TokenIssuer,
      ids: IdGeneratorPort,
      clock: ClockPort,
      transaction: TransactionPort,
    ) => new RunTokens(tokens, issuer, ids, clock, transaction),
  },
  {
    provide: ExpiredTokensWorker,
    inject: [IssuedTokens, LOGGER],
    useFactory: (issuedTokens: IssuedTokens, logger: LoggerPort) =>
      new ExpiredTokensWorker(issuedTokens, logger),
  },
];

const handlers: Provider[] = [
  ...bindQueryHandler(ListWorkspacesQuery, ListWorkspacesHandler, [
    WORKSPACE_READER,
  ]),
  ...bindQueryHandler(GetWorkspaceQuery, GetWorkspaceHandler, [
    WORKSPACE_READER,
    WORKSPACE_SETUP_STATUS,
  ]),
  ...bindQueryHandler(ListMembersQuery, ListMembersHandler, [MEMBER_READER]),
  ...bindQueryHandler(ListWorkspaceMembersQuery, ListWorkspaceMembersHandler, [
    DrizzleWorkspaceRepository,
    MEMBER_READER,
  ]),
  ...bindQueryHandler(ListWorkspaceInvitesQuery, ListWorkspaceInvitesHandler, [
    WorkspaceAdministration,
    INVITE_READER,
    CLOCK,
  ]),
  ...bindQueryHandler(ReadInviteQuery, ReadInviteHandler, [
    INVITE_READER,
    TOKEN_ISSUER,
    CLOCK,
  ]),
  ...bindCommandHandler(
    CreateWorkspaceWithTeamCommand,
    CreateWorkspaceWithTeamHandler,
    [DrizzleWorkspaceRepository, SIGNUP_SURVEYS, ID_GENERATOR, TRANSACTION],
  ),
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
    WORKSPACE_DEPENDENTS,
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
    TEAM_DEPENDENTS,
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
      TOKEN_ISSUER,
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
  ...bindCommandHandler(CreateOidcTrustCommand, CreateOidcTrustHandler, [
    WORKSPACE_ACCESS,
    IDENTITY_DEFINITIONS,
    DrizzleOidcTrustRepository,
    IDEMPOTENT_CREATES,
    ID_GENERATOR,
    CLOCK,
    TRANSACTION,
  ]),
  ...bindCommandHandler(UpdateOidcTrustCommand, UpdateOidcTrustHandler, [
    WORKSPACE_ACCESS,
    IDENTITY_DEFINITIONS,
    DrizzleOidcTrustRepository,
    TRANSACTION,
  ]),
  ...bindCommandHandler(DeleteOidcTrustCommand, DeleteOidcTrustHandler, [
    WORKSPACE_ACCESS,
    DrizzleOidcTrustRepository,
    TRANSACTION,
  ]),
  ...bindQueryHandler(ReadOidcTrustQuery, ReadOidcTrustHandler, [
    WORKSPACE_ACCESS,
    IDENTITY_RESOURCES,
  ]),
  ...bindQueryHandler(ImportOidcTrustQuery, ImportOidcTrustHandler, [
    WORKSPACE_ACCESS,
    IDENTITY_RESOURCES,
  ]),
  ...bindQueryHandler(
    ListOidcTrustResourcesQuery,
    ListOidcTrustResourcesHandler,
    [WORKSPACE_ACCESS, IDENTITY_RESOURCES],
  ),
  ...bindCommandHandler(
    ExchangeWorkloadTokenCommand,
    ExchangeWorkloadTokenHandler,
    [
      DrizzleOidcTrustRepository,
      DrizzleWorkspaceTokenRepository,
      WORKLOAD_TOKENS,
      ID_GENERATOR,
      TOKEN_ISSUER,
      CLOCK,
      TRANSACTION,
    ],
  ),
  ...bindQueryHandler(
    ListConfigurationChangesQuery,
    ListConfigurationChangesHandler,
    [DrizzleWorkspaceRepository, CONFIGURATION_AUDIT],
  ),
  ...bindQueryHandler(ListOidcTrustsQuery, ListOidcTrustsHandler, [
    DrizzleWorkspaceRepository,
    OIDC_TRUST_READER,
  ]),
  ...bindCommandHandler(InviteToWorkspaceCommand, InviteToWorkspaceHandler, [
    WorkspaceAdministration,
    DrizzleWorkspaceInviteRepository,
    DrizzleTeamRepository,
    MEMBER_DIRECTORY,
    InviteSending,
    TOKEN_ISSUER,
    ID_GENERATOR,
    CLOCK,
  ]),
  ...bindCommandHandler(ResendInviteCommand, ResendInviteHandler, [
    WorkspaceAdministration,
    DrizzleWorkspaceInviteRepository,
    DrizzleTeamRepository,
    InviteSending,
    TOKEN_ISSUER,
    CLOCK,
  ]),
  ...bindCommandHandler(RevokeInviteCommand, RevokeInviteHandler, [
    WorkspaceAdministration,
    DrizzleWorkspaceInviteRepository,
    CLOCK,
  ]),
  ...bindCommandHandler(AddTeamMemberCommand, AddTeamMemberHandler, [
    TeamAdministration,
    DrizzleTeamRepository,
  ]),
  ...bindCommandHandler(ChangeMemberRoleCommand, ChangeMemberRoleHandler, [
    DrizzleWorkspaceRepository,
  ]),
  ...bindCommandHandler(AcceptInviteCommand, AcceptInviteHandler, [
    DrizzleWorkspaceInviteRepository,
    DrizzleWorkspaceRepository,
    TOKEN_ISSUER,
    CLOCK,
  ]),
];

const published: Provider[] = [
  {
    provide: IDENTITY_EVENTS,
    inject: [
      PayloadTypes,
      IntegrationEventMappers,
      EventSubscribers,
      EventProjections,
      DrizzleWorkspaceRepository,
      DrizzleTeamRepository,
      CONFIGURATION_AUDIT,
      OIDC_TRUST_USAGE,
      IssuedTokens,
      PERSON_READER,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
      subscribers: EventSubscribers,
      projections: EventProjections,
      workspaces: DrizzleWorkspaceRepository,
      teams: DrizzleTeamRepository,
      audit: ConfigurationAuditPort,
      usage: OidcTrustUsagePort,
      issuedTokens: IssuedTokens,
      people: PersonReaderPort,
    ) => {
      types.register('identity', IDENTITY_PAYLOAD_TYPES);
      mappers.register(IDENTITY_EVENT_MAPPERS);
      projections.register(identityProjections(audit, usage));
      subscribers.register(
        identitySubscribers(
          new InviteMemberships(workspaces, teams, people),
          new FirstTeam(teams),
          issuedTokens,
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
      DrizzleTeamRepository,
    ],
    useFactory: (
      visibility: DrizzleViewableWorkspaces,
      workspaces: DrizzleWorkspaceRepository,
      resources: IdentityResourcesPort,
      teams: DrizzleTeamRepository,
    ) => new WorkspaceAccess(visibility, workspaces, resources, teams),
  },
  {
    provide: WORKSPACE_TOKEN_IDENTITY,
    inject: [
      DrizzleWorkspaceTokenRepository,
      DrizzleOidcTrustRepository,
      TOKEN_ISSUER,
      CLOCK,
    ],
    useFactory: (
      tokens: DrizzleWorkspaceTokenRepository,
      trusts: DrizzleOidcTrustRepository,
      issuer: TokenIssuer,
      clock: ClockPort,
    ) => new TokenAuthenticator(tokens, trusts, issuer, clock),
  },
  {
    provide: GITHUB_ACTIONS_TRUSTS,
    inject: [
      WORKSPACE_ACCESS,
      DrizzleOidcTrustRepository,
      ID_GENERATOR,
      TRANSACTION,
      CLOCK,
    ],
    useFactory: (
      access: WorkspaceAccessPort,
      trusts: DrizzleOidcTrustRepository,
      ids: IdGeneratorPort,
      transaction: TransactionPort,
      clock: ClockPort,
    ) => new GitHubActionsTrusts(access, trusts, ids, transaction, clock),
  },
  {
    provide: OIDC_TRUST_CONFIGURATION,
    inject: [IDENTITY_RESOURCES],
    useFactory: (resources: IdentityResourcesPort) =>
      new OidcTrustConfiguration(resources),
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
