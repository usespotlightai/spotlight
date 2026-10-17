import { KMSClient } from '@aws-sdk/client-kms';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
import {
  WORKSPACE_DEPENDENTS,
  type WorkspaceDependentsPort,
} from '@identity/application/ports/workspace-dependents.port';
import type { Provider, Type } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { PayloadTypes } from '@platform/events/payload-types';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { CreateSecretCommand } from '@secrets/application/commands/create-secret.command';
import { DeleteSecretCommand } from '@secrets/application/commands/delete-secret.command';
import { CreateSecretHandler } from '@secrets/application/commands/handlers/create-secret.handler';
import { DeleteSecretHandler } from '@secrets/application/commands/handlers/delete-secret.handler';
import { UpdateSecretHandler } from '@secrets/application/commands/handlers/update-secret.handler';
import { UpdateSecretCommand } from '@secrets/application/commands/update-secret.command';
import { CREDENTIAL_ENCRYPTION } from '@secrets/application/ports/credential-encryption.port';
import { DEFINED_SECRETS } from '@secrets/application/ports/defined-secrets.port';
import { RUN_GRANTS } from '@secrets/application/ports/run-grants.port';
import {
  RUN_SEALING,
  type RunSealingPort,
} from '@secrets/application/ports/run-sealing.port';
import { RUN_SECRET_FETCHES } from '@secrets/application/ports/run-secret-fetches.port';
import { SECRET_CONFIGURATION } from '@secrets/application/ports/secret-configuration.port';
import { SECRET_DEFINITIONS } from '@secrets/application/ports/secret-definitions.port';
import { SECRET_INJECTION } from '@secrets/application/ports/secret-injection.port';
import { SECRET_RESOURCES } from '@secrets/application/ports/secret-resources.port';
import {
  AWS_SECRETS_MANAGER,
  SECRET_STORE,
  type SecretSourcePort,
} from '@secrets/application/ports/secret-source.port';
import { SECRET_USES } from '@secrets/application/ports/secret-uses.port';
import { ImportSecretHandler } from '@secrets/application/queries/handlers/import-secret.handler';
import { ListSecretResourcesHandler } from '@secrets/application/queries/handlers/list-secret-resources.handler';
import { ReadSecretHandler } from '@secrets/application/queries/handlers/read-secret.handler';
import { ImportSecretQuery } from '@secrets/application/queries/import-secret.query';
import { ListSecretResourcesQuery } from '@secrets/application/queries/list-secret-resources.query';
import { ReadSecretQuery } from '@secrets/application/queries/read-secret.query';
import { AbandonWorkspaceSecrets } from '@secrets/application/services/abandon-workspace-secrets.service';
import { ForgetRunGrants } from '@secrets/application/services/forget-run-grants.service';
import { RunGrantEndings } from '@secrets/application/services/run-grant-endings.service';
import { RunGrantsUnitOfWork } from '@secrets/application/services/run-grants-unit-of-work';
import { RunSecretFetches } from '@secrets/application/services/run-secret-fetches.service';
import { SecretConfiguration } from '@secrets/application/services/secret-configuration.service';
import { SecretInjection } from '@secrets/application/services/secret-injection.service';
import { SecretSources } from '@secrets/application/services/secret-sources.service';
import { SecretUsesRegistry } from '@secrets/application/services/secret-uses-registry.service';
import { SECRETS_PAYLOAD_TYPES } from '@secrets/domain/payload-types';
import {
  RUN_GRANTS_REPOSITORY,
  type RunGrantsRepository,
} from '@secrets/domain/repositories/run-grants.repository';
import {
  SECRETS,
  type SecretRepository,
} from '@secrets/domain/repositories/secret.repository';
import { WorkspaceCredentialEncryption } from '@secrets/infrastructure/crypto/workspace-credential-encryption';
import { WorkspaceKeys } from '@secrets/infrastructure/crypto/workspace-keys';
import { SecretDefinitions } from '@secrets/infrastructure/definitions/secret-definitions';
import { AwsKeyManagement } from '@secrets/infrastructure/kms/aws-key-management';
import {
  KEY_MANAGEMENT,
  type KeyManagement,
} from '@secrets/infrastructure/kms/key-management';
import { LocalKeyManagement } from '@secrets/infrastructure/kms/local-key-management';
import { DrizzleSecretResources } from '@secrets/infrastructure/persistence/drizzle/readers/secret-resources.reader';
import { DrizzleRunGrants } from '@secrets/infrastructure/persistence/drizzle/repositories/run-grants.repository';
import { DrizzleSecrets } from '@secrets/infrastructure/persistence/drizzle/repositories/secrets.repository';
import { X25519RunSealing } from '@secrets/infrastructure/sealing/run-sealing';
import { AwsSecretsManagerSource } from '@secrets/infrastructure/sources/aws-secrets-manager.source';
import { BuiltInSecretStore } from '@secrets/infrastructure/sources/built-in-secret.store';
import { secretsSubscribers } from '@secrets/presentation/events/secrets.subscribers';
import { SecretResourceController } from '@secrets/presentation/http/controllers/secret-resource.controller';
import { ForgottenRunGrantsWorker } from '@secrets/presentation/workers/forgotten-run-grants.worker';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { ID_GENERATOR } from '@shared-kernel/application/ports/id-generator.port';
import { IDEMPOTENT_CREATES } from '@shared-kernel/application/ports/idempotent-creates.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';

const SECRETS_EVENTS = Symbol('SECRETS_EVENTS');

const SECRETS_DEPENDENTS = Symbol('SECRETS_DEPENDENTS');

export const SECRETS_CONTROLLERS: readonly Type[] = [SecretResourceController];

const keyManagementFor = (env: Env): KeyManagement =>
  env.SECRETS_KMS_KEY_ID
    ? new AwsKeyManagement(new KMSClient({}), env.SECRETS_KMS_KEY_ID)
    : new LocalKeyManagement(env.SPOTLIGHT_SECRETS_KEY ?? '');

export const SECRETS_PROVIDERS: readonly Provider[] = [
  {
    provide: RUN_GRANTS_REPOSITORY,
    inject: [DrizzleContext, DOMAIN_EVENT_DISPATCHER],
    useFactory: (context: DrizzleContext, events: DomainEventDispatcher) =>
      new DrizzleRunGrants(context, events),
  },
  {
    provide: RunGrantsUnitOfWork,
    inject: [RUN_GRANTS_REPOSITORY],
    useFactory: (grants: RunGrantsRepository) =>
      new RunGrantsUnitOfWork(grants),
  },
  {
    provide: ForgetRunGrants,
    inject: [RUN_GRANTS_REPOSITORY, RunGrantsUnitOfWork, CLOCK, LOGGER],
    useFactory: (
      grants: RunGrantsRepository,
      unitOfWork: RunGrantsUnitOfWork,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new ForgetRunGrants(grants, unitOfWork, clock, logger),
  },
  {
    provide: ForgottenRunGrantsWorker,
    inject: [ForgetRunGrants, LOGGER],
    useFactory: (forgetting: ForgetRunGrants, logger: LoggerPort) =>
      new ForgottenRunGrantsWorker(forgetting, logger),
  },
  DrizzleSecretResources,
  { provide: SECRET_RESOURCES, useExisting: DrizzleSecretResources },
  { provide: DEFINED_SECRETS, useExisting: DrizzleSecretResources },
  { provide: SECRET_DEFINITIONS, useClass: SecretDefinitions },

  {
    provide: KEY_MANAGEMENT,
    inject: [ENV],
    useFactory: keyManagementFor,
  },
  {
    provide: WorkspaceKeys,
    inject: [DrizzleContext, KEY_MANAGEMENT],
    useFactory: (context: DrizzleContext, kms: KeyManagement) =>
      new WorkspaceKeys(context, kms),
  },
  {
    provide: BuiltInSecretStore,
    inject: [DrizzleContext, WorkspaceKeys],
    useFactory: (context: DrizzleContext, keys: WorkspaceKeys) =>
      new BuiltInSecretStore(context, keys),
  },
  { provide: SECRET_STORE, useExisting: BuiltInSecretStore },
  {
    provide: SECRETS,
    inject: [DrizzleContext, DOMAIN_EVENT_DISPATCHER, BuiltInSecretStore],
    useFactory: (
      context: DrizzleContext,
      events: DomainEventDispatcher,
      values: BuiltInSecretStore,
    ) => new DrizzleSecrets(context, events, values),
  },
  {
    provide: SECRET_CONFIGURATION,
    inject: [SECRETS],
    useFactory: (secrets: SecretRepository) => new SecretConfiguration(secrets),
  },
  {
    provide: AWS_SECRETS_MANAGER,
    inject: [ENV],
    useFactory: (env: Env) =>
      new AwsSecretsManagerSource(
        env.SECRETS_AWS_SECRETS_MANAGER ? new SecretsManagerClient({}) : null,
      ),
  },
  {
    provide: CREDENTIAL_ENCRYPTION,
    inject: [WorkspaceKeys],
    useFactory: (keys: WorkspaceKeys) =>
      new WorkspaceCredentialEncryption(keys),
  },
  {
    provide: SecretSources,
    inject: [SECRET_STORE, AWS_SECRETS_MANAGER],
    useFactory: (store: SecretSourcePort, aws: SecretSourcePort) =>
      new SecretSources(store, aws),
  },
  { provide: RUN_SEALING, useClass: X25519RunSealing },
  {
    provide: RUN_SECRET_FETCHES,
    inject: [SECRETS, RunGrantsUnitOfWork, SecretSources, RUN_SEALING],
    useFactory: (
      secrets: SecretRepository,
      unitOfWork: RunGrantsUnitOfWork,
      sources: SecretSources,
      sealing: RunSealingPort,
    ) => new RunSecretFetches(secrets, unitOfWork, sources, sealing),
  },
  { provide: SECRET_USES, useFactory: () => new SecretUsesRegistry() },
  {
    provide: SECRET_INJECTION,
    inject: [
      SECRETS,
      RUN_GRANTS_REPOSITORY,
      RunGrantsUnitOfWork,
      SecretSources,
    ],
    useFactory: (
      secrets: SecretRepository,
      grants: RunGrantsRepository,
      unitOfWork: RunGrantsUnitOfWork,
      sources: SecretSources,
    ) => new SecretInjection(secrets, grants, unitOfWork, sources),
  },

  {
    provide: SECRETS_EVENTS,
    inject: [
      PayloadTypes,
      EventSubscribers,
      SECRETS,
      WorkspaceKeys,
      ForgetRunGrants,
      TRANSACTION,
    ],
    useFactory: (
      types: PayloadTypes,
      subscribers: EventSubscribers,
      secrets: SecretRepository,
      keys: WorkspaceKeys,
      runGrants: ForgetRunGrants,
      transaction: TransactionPort,
    ) => {
      types.register('secrets', SECRETS_PAYLOAD_TYPES);
      subscribers.register(
        secretsSubscribers({
          abandoning: new AbandonWorkspaceSecrets(secrets, transaction),
          keys,
          runGrants,
        }),
      );
      return true;
    },
  },
  {
    provide: SECRETS_DEPENDENTS,
    inject: [WORKSPACE_DEPENDENTS, DrizzleSecretResources],
    useFactory: (
      dependents: WorkspaceDependentsPort,
      secrets: DrizzleSecretResources,
    ) => {
      dependents.register(secrets);
      return true;
    },
  },
  {
    provide: RUN_GRANTS,
    inject: [RunGrantsUnitOfWork, CLOCK],
    useFactory: (unitOfWork: RunGrantsUnitOfWork, clock: ClockPort) =>
      new RunGrantEndings(unitOfWork, clock),
  },

  ...bindCommandHandler(CreateSecretCommand, CreateSecretHandler, [
    WORKSPACE_ACCESS,
    SECRET_DEFINITIONS,
    SECRETS,
    IDEMPOTENT_CREATES,
    ID_GENERATOR,
    CLOCK,
    TRANSACTION,
  ]),
  ...bindCommandHandler(UpdateSecretCommand, UpdateSecretHandler, [
    WORKSPACE_ACCESS,
    SECRET_DEFINITIONS,
    SECRETS,
    CLOCK,
    TRANSACTION,
  ]),
  ...bindCommandHandler(DeleteSecretCommand, DeleteSecretHandler, [
    WORKSPACE_ACCESS,
    SECRETS,
    SECRET_USES,
    TRANSACTION,
  ]),
  ...bindQueryHandler(ReadSecretQuery, ReadSecretHandler, [
    WORKSPACE_ACCESS,
    SECRET_RESOURCES,
  ]),
  ...bindQueryHandler(ImportSecretQuery, ImportSecretHandler, [
    WORKSPACE_ACCESS,
    SECRET_RESOURCES,
  ]),
  ...bindQueryHandler(ListSecretResourcesQuery, ListSecretResourcesHandler, [
    WORKSPACE_ACCESS,
    SECRET_RESOURCES,
  ]),
];
