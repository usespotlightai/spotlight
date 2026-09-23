import { AcceptInviteCommand } from '@identity/application/commands/accept-invite.command';
import { ChangeMemberRoleCommand } from '@identity/application/commands/change-member-role.command';
import { CreateWorkspaceCommand } from '@identity/application/commands/create-workspace.command';
import { AcceptInviteHandler } from '@identity/application/commands/handlers/accept-invite.handler';
import { ChangeMemberRoleHandler } from '@identity/application/commands/handlers/change-member-role.handler';
import { CreateWorkspaceHandler } from '@identity/application/commands/handlers/create-workspace.handler';
import { InviteToTeamHandler } from '@identity/application/commands/handlers/invite-to-team.handler';
import { RevokeInviteHandler } from '@identity/application/commands/handlers/revoke-invite.handler';
import { InviteToTeamCommand } from '@identity/application/commands/invite-to-team.command';
import { RevokeInviteCommand } from '@identity/application/commands/revoke-invite.command';
import { IDENTITY_PUBLICATIONS } from '@identity/application/integration-events/identity.publications';
import { INVITE_MAIL } from '@identity/application/ports/invite-mail.port';
import { INVITE_READER } from '@identity/application/ports/invite-reader.port';
import { MEMBER_READER } from '@identity/application/ports/member-reader.port';
import { PERSON_READER } from '@identity/application/ports/person-reader.port';
import { TEAM_DIRECTORY } from '@identity/application/ports/team-directory.port';
import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
import {
  WORKSPACE_READER,
  type WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import { GetWorkspaceQuery } from '@identity/application/queries/get-workspace.query';
import { GetWorkspaceHandler } from '@identity/application/queries/handlers/get-workspace.handler';
import { ListInvitesHandler } from '@identity/application/queries/handlers/list-invites.handler';
import { ListMembersHandler } from '@identity/application/queries/handlers/list-members.handler';
import { ListWorkspacesHandler } from '@identity/application/queries/handlers/list-workspaces.handler';
import { ReadInviteHandler } from '@identity/application/queries/handlers/read-invite.handler';
import { ListInvitesQuery } from '@identity/application/queries/list-invites.query';
import { ListMembersQuery } from '@identity/application/queries/list-members.query';
import { ListWorkspacesQuery } from '@identity/application/queries/list-workspaces.query';
import { ReadInviteQuery } from '@identity/application/queries/read-invite.query';
import { FirstTeam } from '@identity/application/services/first-team.service';
import { InviteMemberships } from '@identity/application/services/invite-memberships.service';
import { TeamAdministration } from '@identity/application/services/team-administration.service';
import { TeamDirectory } from '@identity/application/services/team-directory.service';
import { WorkspaceAccess } from '@identity/application/services/workspace-access.service';
import { IDENTITY_EVENT_TYPES } from '@identity/domain/event-types';
import { InviteByMail } from '@identity/infrastructure/mail/invite.mail';
import type { MailTransport } from '@identity/infrastructure/mail/mail.transport';
import { SmtpMail } from '@identity/infrastructure/mail/smtp.transport';
import { WrittenDownMail } from '@identity/infrastructure/mail/written-down.mail';
import { DrizzleInviteReader } from '@identity/infrastructure/persistence/drizzle/readers/invite.reader';
import { DrizzleMemberReader } from '@identity/infrastructure/persistence/drizzle/readers/member.reader';
import { DrizzlePersonReader } from '@identity/infrastructure/persistence/drizzle/readers/person.reader';
import { DrizzleViewableWorkspaces } from '@identity/infrastructure/persistence/drizzle/readers/viewable-workspaces.reader';
import { DrizzleWorkspaceReader } from '@identity/infrastructure/persistence/drizzle/readers/workspace.reader';
import { DrizzleInviteRepository } from '@identity/infrastructure/persistence/drizzle/repositories/invite.repository';
import { DrizzleTeamRepository } from '@identity/infrastructure/persistence/drizzle/repositories/team.repository';
import { DrizzleWorkspaceRepository } from '@identity/infrastructure/persistence/drizzle/repositories/workspace.repository';
import { identitySubscribers } from '@identity/presentation/events/identity.subscribers';
import {
  InviteController,
  TeamInviteController,
} from '@identity/presentation/http/controllers/invite.controller';
import { TeamController } from '@identity/presentation/http/controllers/team.controller';
import { WorkspaceController } from '@identity/presentation/http/controllers/workspace.controller';
import type { Provider, Type } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventPublications } from '@platform/events/event-publications';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { EventTypes } from '@platform/events/event-types';
import { CLOCK } from '@shared-kernel/application/ports/clock.port';
import { ID_GENERATOR } from '@shared-kernel/application/ports/id-generator.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import { TOKEN_MINT } from '@shared-kernel/application/ports/token-mint.port';

const IDENTITY_EVENTS = Symbol('IDENTITY_EVENTS');

export const IDENTITY_CONTROLLERS: readonly Type[] = [
  WorkspaceController,
  TeamController,
  TeamInviteController,
  InviteController,
];

const adapters: Provider[] = [
  DrizzleWorkspaceRepository,
  DrizzleTeamRepository,
  DrizzleInviteRepository,
  DrizzleViewableWorkspaces,
  { provide: WORKSPACE_READER, useClass: DrizzleWorkspaceReader },
  { provide: PERSON_READER, useClass: DrizzlePersonReader },
  { provide: MEMBER_READER, useClass: DrizzleMemberReader },
  { provide: INVITE_READER, useClass: DrizzleInviteReader },
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
  ...bindCommandHandler(CreateWorkspaceCommand, CreateWorkspaceHandler, [
    DrizzleWorkspaceRepository,
    ID_GENERATOR,
  ]),
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
      DrizzleWorkspaceRepository,
      DrizzleTeamRepository,
    ],
    useFactory: (
      types: EventTypes,
      publications: EventPublications,
      subscribers: EventSubscribers,
      workspaces: DrizzleWorkspaceRepository,
      teams: DrizzleTeamRepository,
    ) => {
      types.register('identity', IDENTITY_EVENT_TYPES);
      publications.register(IDENTITY_PUBLICATIONS);
      subscribers.register(
        identitySubscribers(
          new InviteMemberships(workspaces, teams),
          new FirstTeam(teams),
        ),
      );
      return true;
    },
  },
  {
    provide: WORKSPACE_ACCESS,
    inject: [
      DrizzleViewableWorkspaces,
      WORKSPACE_READER,
      DrizzleWorkspaceRepository,
    ],
    useFactory: (
      visibility: DrizzleViewableWorkspaces,
      members: WorkspaceReaderPort,
      workspaces: DrizzleWorkspaceRepository,
    ) => new WorkspaceAccess(visibility, members, workspaces),
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
