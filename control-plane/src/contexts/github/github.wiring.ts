import { ConnectGitHubCommand } from '@github/application/commands/connect-github.command';
import { ConnectGitHubHandler } from '@github/application/commands/handlers/connect-github.handler';
import { GITHUB_EVENT_MAPPERS } from '@github/application/integration-events/github.event-mappers';
import { GITHUB_APP } from '@github/application/ports/github-app.port';
import { GITHUB_WEBHOOKS } from '@github/application/ports/github-webhooks.port';
import { INSTALLATION_ADMINISTRATION } from '@github/application/ports/installation-administration.port';
import {
  INSTALLATIONS,
  type InstallationsPort,
} from '@github/application/ports/installations.port';
import { PULL_REQUESTS } from '@github/application/ports/pull-request.port';
import { PULL_REQUEST_COMMENTS } from '@github/application/ports/pull-request-comments.port';
import { PULL_REQUEST_REACTIONS } from '@github/application/ports/pull-request-reactions.port';
import { PULL_REQUEST_REVIEWS } from '@github/application/ports/pull-request-reviews.port';
import {
  REPOSITORY_ACCESS,
  RepositoryAccessPort,
} from '@github/application/ports/repository-access.port';
import { REPOSITORY_CATALOG } from '@github/application/ports/repository-catalog.port';
import { REPOSITORY_CONTENTS } from '@github/application/ports/repository-contents.port';
import { REPOSITORY_GIT } from '@github/application/ports/repository-git.port';
import { REVIEW_COMMENTS } from '@github/application/ports/review-comments.port';
import {
  WEBHOOK_SIGNATURE,
  type WebhookSignaturePort,
} from '@github/application/ports/webhook-signature.port';
import {
  WEBHOOK_TRANSLATION,
  type WebhookTranslationPort,
} from '@github/application/ports/webhook-translation.port';
import { WORKSPACE_CONNECTIONS } from '@github/application/ports/workspace-connections.port';
import { ListRepositoriesHandler } from '@github/application/queries/handlers/list-repositories.handler';
import { ReadGitHubHandler } from '@github/application/queries/handlers/read-github.handler';
import { ListRepositoriesQuery } from '@github/application/queries/list-repositories.query';
import { ReadGitHubQuery } from '@github/application/queries/read-github.query';
import { GitHubWebhooks } from '@github/application/services/github-webhooks.service';
import { Installations } from '@github/application/services/installations.service';
import { RecordPullRequests } from '@github/application/services/record-pull-requests.service';
import { WorkspaceConnections } from '@github/application/services/workspace-connections.service';
import { GITHUB_PAYLOAD_TYPES } from '@github/domain/payload-types';
import { GitHubAppAccess } from '@github/infrastructure/github/github-app.access';
import { GitHubAppIdentity } from '@github/infrastructure/github/github-app.identity';
import { GitHubGitTransport } from '@github/infrastructure/github/github-git.transport';
import { GitHubInstallationAdministration } from '@github/infrastructure/github/github-installation.administration';
import { GitHubPullRequestComments } from '@github/infrastructure/github/github-pull-request-comments';
import { GitHubPullRequestReactions } from '@github/infrastructure/github/github-pull-request-reactions';
import { GitHubPullRequestReviews } from '@github/infrastructure/github/github-pull-request-reviews';
import { GitHubPullRequests } from '@github/infrastructure/github/github-pull-requests';
import { GitHubRepositoryCatalog } from '@github/infrastructure/github/github-repository.catalog';
import { GitHubRepositoryContents } from '@github/infrastructure/github/github-repository-contents';
import { GitHubReviewComments } from '@github/infrastructure/github/github-review-comments';
import { GitHubWebhookSignature } from '@github/infrastructure/github/github-webhook.signature';
import { DrizzleGitHubConnections } from '@github/infrastructure/persistence/drizzle/repositories/github-connection.repository';
import { DrizzlePullRequests } from '@github/infrastructure/persistence/drizzle/repositories/pull-request.repository';
import { GitHubWebhookTranslation } from '@github/infrastructure/webhooks/github-webhook.translation';
import { githubSubscribers } from '@github/presentation/events/github.subscribers';
import { GitHubConnectionController } from '@github/presentation/http/controllers/github-connection.controller';
import { RepositoryController } from '@github/presentation/http/controllers/repository.controller';
import { PurgePullRequestsWorker } from '@github/presentation/workers/purge-pull-requests.worker';
import {
  LINKED_ACCOUNTS,
  type LinkedAccountsPort,
} from '@identity/application/ports/linked-accounts.port';
import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
import { WORKSPACE_READER } from '@identity/application/ports/workspace-reader.port';
import type { Provider, Type } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import { type Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import { PayloadTypes } from '@platform/events/payload-types';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';

const GITHUB_EVENTS = Symbol('GITHUB_EVENTS');

export const GITHUB_CONTROLLERS: readonly Type[] = [
  RepositoryController,
  GitHubConnectionController,
];

export const GITHUB_PROVIDERS: readonly Provider[] = [
  {
    provide: GITHUB_EVENTS,
    inject: [
      PayloadTypes,
      IntegrationEventMappers,
      EventSubscribers,
      RecordPullRequests,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
      subscribers: EventSubscribers,
      recording: RecordPullRequests,
    ) => {
      types.register('github', GITHUB_PAYLOAD_TYPES);
      mappers.register(GITHUB_EVENT_MAPPERS);
      subscribers.register(githubSubscribers(recording));
      return true;
    },
  },

  DrizzlePullRequests,

  {
    provide: RecordPullRequests,
    inject: [
      DrizzlePullRequests,
      DrizzleGitHubConnections,
      TRANSACTION,
      CLOCK,
      LOGGER,
    ],
    useFactory: (
      pullRequests: DrizzlePullRequests,
      connections: DrizzleGitHubConnections,
      transaction: TransactionPort,
      clock: ClockPort,
      logger: LoggerPort,
    ) =>
      new RecordPullRequests(
        pullRequests,
        connections,
        transaction,
        clock,
        logger,
      ),
  },

  {
    provide: PurgePullRequestsWorker,
    inject: [RecordPullRequests, LOGGER],
    useFactory: (recording: RecordPullRequests, logger: LoggerPort) =>
      new PurgePullRequestsWorker(recording, logger),
  },
  {
    provide: PULL_REQUEST_COMMENTS,
    inject: [REPOSITORY_ACCESS],
    useFactory: (access: RepositoryAccessPort) =>
      new GitHubPullRequestComments(access),
  },
  {
    provide: PULL_REQUEST_REACTIONS,
    inject: [REPOSITORY_ACCESS],
    useFactory: (access: RepositoryAccessPort) =>
      new GitHubPullRequestReactions(access),
  },

  {
    provide: PULL_REQUEST_REVIEWS,
    inject: [REPOSITORY_ACCESS, LINKED_ACCOUNTS],
    useFactory: (access: RepositoryAccessPort, accounts: LinkedAccountsPort) =>
      new GitHubPullRequestReviews(access, accounts),
  },

  {
    provide: WORKSPACE_CONNECTIONS,
    inject: [DrizzleGitHubConnections],
    useFactory: (connections: DrizzleGitHubConnections) =>
      new WorkspaceConnections(connections),
  },

  {
    provide: WEBHOOK_SIGNATURE,
    inject: [ENV],
    useFactory: (env: Env) => new GitHubWebhookSignature(env),
  },

  DrizzleGitHubConnections,

  {
    provide: WEBHOOK_TRANSLATION,
    useFactory: () => new GitHubWebhookTranslation(),
  },

  {
    provide: GITHUB_WEBHOOKS,
    inject: [
      WEBHOOK_TRANSLATION,
      WEBHOOK_SIGNATURE,
      DrizzleGitHubConnections,
      DOMAIN_EVENT_DISPATCHER,
      RecordPullRequests,
      LOGGER,
    ],
    useFactory: (
      translation: WebhookTranslationPort,
      signature: WebhookSignaturePort,
      connections: DrizzleGitHubConnections,
      events: DomainEventDispatcher,
      recording: RecordPullRequests,
      logger: LoggerPort,
    ) =>
      new GitHubWebhooks(
        translation,
        signature,
        connections,
        events,
        recording,
        logger,
      ),
  },

  {
    provide: INSTALLATIONS,
    inject: [DrizzleGitHubConnections],
    useFactory: (connections: DrizzleGitHubConnections) =>
      new Installations(connections),
  },

  {
    provide: INSTALLATION_ADMINISTRATION,
    inject: [ENV, LINKED_ACCOUNTS],
    useFactory: (env: Env, accounts: LinkedAccountsPort) =>
      new GitHubInstallationAdministration(env, accounts),
  },

  {
    provide: REPOSITORY_ACCESS,
    inject: [ENV, INSTALLATIONS],
    useFactory: (env: Env, installations: InstallationsPort) =>
      new GitHubAppAccess(env, installations),
  },

  {
    provide: GITHUB_APP,
    inject: [ENV],
    useFactory: (env: Env) => new GitHubAppIdentity(env),
  },

  {
    provide: PULL_REQUESTS,
    inject: [REPOSITORY_ACCESS],
    useFactory: (access: RepositoryAccessPort) =>
      new GitHubPullRequests(access),
  },

  {
    provide: REVIEW_COMMENTS,
    inject: [REPOSITORY_ACCESS],
    useFactory: (access: RepositoryAccessPort) =>
      new GitHubReviewComments(access),
  },

  {
    provide: REPOSITORY_CATALOG,
    inject: [REPOSITORY_ACCESS],
    useFactory: (access: RepositoryAccessPort) =>
      new GitHubRepositoryCatalog(access),
  },

  {
    provide: REPOSITORY_CONTENTS,
    inject: [REPOSITORY_ACCESS],
    useFactory: (access: RepositoryAccessPort) =>
      new GitHubRepositoryContents(access),
  },

  {
    provide: REPOSITORY_GIT,
    inject: [REPOSITORY_ACCESS],
    useFactory: (access: RepositoryAccessPort) =>
      new GitHubGitTransport(access),
  },

  ...bindQueryHandler(ListRepositoriesQuery, ListRepositoriesHandler, [
    WORKSPACE_READER,
    WORKSPACE_CONNECTIONS,
    REPOSITORY_CATALOG,
  ]),

  ...bindQueryHandler(ReadGitHubQuery, ReadGitHubHandler, [
    WORKSPACE_READER,
    WORKSPACE_CONNECTIONS,
    GITHUB_APP,
  ]),

  ...bindCommandHandler(ConnectGitHubCommand, ConnectGitHubHandler, [
    WORKSPACE_ACCESS,
    DrizzleGitHubConnections,
    INSTALLATION_ADMINISTRATION,
    TRANSACTION,
  ]),
];
