import { KMSClient } from '@aws-sdk/client-kms';
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
import { ApiConventions } from '@platform/http/api-conventions';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { CreateSecretCommand } from '@secrets/application/commands/create-secret.command';
import { DeleteSecretCommand } from '@secrets/application/commands/delete-secret.command';
import { CreateSecretHandler } from '@secrets/application/commands/handlers/create-secret.handler';
import { DeleteSecretHandler } from '@secrets/application/commands/handlers/delete-secret.handler';
import { SetSecretValueHandler } from '@secrets/application/commands/handlers/set-secret-value.handler';
import { UpdateSecretHandler } from '@secrets/application/commands/handlers/update-secret.handler';
import { SetSecretValueCommand } from '@secrets/application/commands/set-secret-value.command';
import { UpdateSecretCommand } from '@secrets/application/commands/update-secret.command';
import { BOUND_SECRETS } from '@secrets/application/ports/bound-secrets.port';
import { CALL_SECRET_FETCHES } from '@secrets/application/ports/call-secret-fetches.port';
import { CREDENTIAL_ENCRYPTION } from '@secrets/application/ports/credential-encryption.port';
import { DEFINED_SECRETS } from '@secrets/application/ports/defined-secrets.port';
import { HOST_SECRET_FETCHES } from '@secrets/application/ports/host-secret-fetches.port';
import { RUN_GRANTS } from '@secrets/application/ports/run-grants.port';
import { RUN_SECRET_FETCHES } from '@secrets/application/ports/run-secret-fetches.port';
import { SANDBOX_ENV_REVEALS } from '@secrets/application/ports/sandbox-env-reveals.port';
import { SECRET_CONFIGURATION } from '@secrets/application/ports/secret-configuration.port';
import { SECRET_DEFINITIONS } from '@secrets/application/ports/secret-definitions.port';
import { SECRET_INJECTION } from '@secrets/application/ports/secret-injection.port';
import { SECRET_READINESS } from '@secrets/application/ports/secret-readiness.port';
import {
  SECRET_RESOURCES,
  type SecretResourcesPort,
} from '@secrets/application/ports/secret-resources.port';
import {
  SECRET_SEALING,
  type SecretSealingPort,
} from '@secrets/application/ports/secret-sealing.port';
import {
  SECRET_STORE,
  type SecretStorePort,
} from '@secrets/application/ports/secret-store.port';
import { SECRET_USE_LOCKS } from '@secrets/application/ports/secret-use-locks.port';
import { SECRET_USES } from '@secrets/application/ports/secret-uses.port';
import { WORKSPACE_SECRETS } from '@secrets/application/ports/workspace-secrets.port';
import { ImportSecretHandler } from '@secrets/application/queries/handlers/import-secret.handler';
import { ListSecretResourcesHandler } from '@secrets/application/queries/handlers/list-secret-resources.handler';
import { ListWorkspaceSecretsHandler } from '@secrets/application/queries/handlers/list-workspace-secrets.handler';
import { ReadSecretHandler } from '@secrets/application/queries/handlers/read-secret.handler';
import { ImportSecretQuery } from '@secrets/application/queries/import-secret.query';
import { ListSecretResourcesQuery } from '@secrets/application/queries/list-secret-resources.query';
import { ListWorkspaceSecretsQuery } from '@secrets/application/queries/list-workspace-secrets.query';
import { ReadSecretQuery } from '@secrets/application/queries/read-secret.query';
import { BoundSecrets } from '@secrets/application/services/bound-secrets.service';
import { CallSecretFetches } from '@secrets/application/services/call-secret-fetches.service';
import { DeleteWorkspaceSecrets } from '@secrets/application/services/delete-workspace-secrets.service';
import { HostSecretFetches } from '@secrets/application/services/host-secret-fetches.service';
import { PurgeRunGrants } from '@secrets/application/services/purge-run-grants.service';
import { RunGrantEndings } from '@secrets/application/services/run-grant-endings.service';
import { RunGrantsChanges } from '@secrets/application/services/run-grants-changes';
import { RunSecretFetches } from '@secrets/application/services/run-secret-fetches.service';
import { SandboxEnvReveals } from '@secrets/application/services/sandbox-env-reveals.service';
import { SealedSecrets } from '@secrets/application/services/sealed-secrets';
import { SecretConfiguration } from '@secrets/application/services/secret-configuration.service';
import { SecretInjection } from '@secrets/application/services/secret-injection.service';
import { SecretReadiness } from '@secrets/application/services/secret-readiness.service';
import { SecretUsesRegistry } from '@secrets/application/services/secret-uses-registry.service';
import { WorkspaceSecrets } from '@secrets/application/services/workspace-secrets.service';
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
import { SECRETS_PAYLOAD_TYPES } from '@secrets/infrastructure/events/secrets-payload-types';
import { AwsKeyManagement } from '@secrets/infrastructure/kms/aws-key-management';
import {
  KEY_MANAGEMENT,
  type KeyManagement,
} from '@secrets/infrastructure/kms/key-management';
import { LocalKeyManagement } from '@secrets/infrastructure/kms/local-key-management';
import { DrizzleSecretResources } from '@secrets/infrastructure/persistence/drizzle/readers/secret-resources.reader';
import { DrizzleRunGrants } from '@secrets/infrastructure/persistence/drizzle/repositories/run-grants.repository';
import { DrizzleSecrets } from '@secrets/infrastructure/persistence/drizzle/repositories/secrets.repository';
import { DrizzleSecretUseLocks } from '@secrets/infrastructure/persistence/drizzle/secret-use-locks';
import { X25519SecretSealing } from '@secrets/infrastructure/sealing/secret-sealing';
import { EncryptedSecretStore } from '@secrets/infrastructure/store/encrypted-secret.store';
import { secretsSubscribers } from '@secrets/presentation/events/secrets.subscribers';
import { SECRETS_API_CONVENTIONS } from '@secrets/presentation/http/api-conventions';
import { SecretResourceController } from '@secrets/presentation/http/controllers/secret-resource.controller';
import { WorkspaceSecretController } from '@secrets/presentation/http/controllers/workspace-secret.controller';
import { PurgeRunGrantsWorker } from '@secrets/presentation/workers/purge-run-grants.worker';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
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
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';

const SECRETS_EVENTS = Symbol('SECRETS_EVENTS');

const SECRETS_API_DOCUMENTATION = Symbol('SECRETS_API_DOCUMENTATION');

const SECRETS_DEPENDENTS = Symbol('SECRETS_DEPENDENTS');

export const SECRETS_CONTROLLERS: readonly Type[] = [
  SecretResourceController,
  WorkspaceSecretController,
];

const keyManagementFor = (env: Env): KeyManagement =>
  env.SPOTLIGHT_SECRETS_KMS_KEY_ID
    ? new AwsKeyManagement(new KMSClient({}), env.SPOTLIGHT_SECRETS_KMS_KEY_ID)
    : new LocalKeyManagement(env.SPOTLIGHT_SECRETS_KEY ?? '');

export const SECRETS_PROVIDERS: readonly Provider[] = [
  {
    provide: SECRETS_API_DOCUMENTATION,
    inject: [ApiConventions],
    useFactory: (conventions: ApiConventions) => {
      conventions.register(SECRETS_API_CONVENTIONS);
      return true;
    },
  },
  {
    provide: RUN_GRANTS_REPOSITORY,
    inject: [DrizzleContext, DOMAIN_EVENT_DISPATCHER],
    useFactory: (context: DrizzleContext, events: DomainEventDispatcher) =>
      new DrizzleRunGrants(context, events),
  },
  {
    provide: RunGrantsChanges,
    inject: [RUN_GRANTS_REPOSITORY],
    useFactory: (grants: RunGrantsRepository) => new RunGrantsChanges(grants),
  },
  {
    provide: PurgeRunGrants,
    inject: [RUN_GRANTS_REPOSITORY, RunGrantsChanges, CLOCK, LOGGER],
    useFactory: (
      grants: RunGrantsRepository,
      changes: RunGrantsChanges,
      clock: ClockPort,
      logger: LoggerPort,
    ) => new PurgeRunGrants(grants, changes, clock, logger),
  },
  {
    provide: PurgeRunGrantsWorker,
    inject: [PurgeRunGrants, LOGGER],
    useFactory: (purging: PurgeRunGrants, logger: LoggerPort) =>
      new PurgeRunGrantsWorker(purging, logger),
  },
  DrizzleSecretResources,
  { provide: SECRET_RESOURCES, useExisting: DrizzleSecretResources },
  { provide: DEFINED_SECRETS, useExisting: DrizzleSecretResources },
  { provide: SECRET_USE_LOCKS, useClass: DrizzleSecretUseLocks },
  {
    provide: BOUND_SECRETS,
    inject: [SECRET_RESOURCES],
    useFactory: (secrets: SecretResourcesPort) => new BoundSecrets(secrets),
  },
  {
    provide: SECRET_READINESS,
    inject: [SECRET_RESOURCES],
    useFactory: (secrets: SecretResourcesPort) => new SecretReadiness(secrets),
  },
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
    provide: EncryptedSecretStore,
    inject: [DrizzleContext, WorkspaceKeys],
    useFactory: (context: DrizzleContext, keys: WorkspaceKeys) =>
      new EncryptedSecretStore(context, keys),
  },
  { provide: SECRET_STORE, useExisting: EncryptedSecretStore },
  {
    provide: SECRETS,
    inject: [DrizzleContext, DOMAIN_EVENT_DISPATCHER, EncryptedSecretStore],
    useFactory: (
      context: DrizzleContext,
      events: DomainEventDispatcher,
      values: EncryptedSecretStore,
    ) => new DrizzleSecrets(context, events, values),
  },
  {
    provide: SECRET_CONFIGURATION,
    inject: [SECRETS],
    useFactory: (secrets: SecretRepository) => new SecretConfiguration(secrets),
  },
  {
    provide: CREDENTIAL_ENCRYPTION,
    inject: [WorkspaceKeys],
    useFactory: (keys: WorkspaceKeys) =>
      new WorkspaceCredentialEncryption(keys),
  },
  { provide: SECRET_SEALING, useClass: X25519SecretSealing },
  {
    provide: RUN_SECRET_FETCHES,
    inject: [SECRETS, RunGrantsChanges, SECRET_STORE, SECRET_SEALING],
    useFactory: (
      secrets: SecretRepository,
      changes: RunGrantsChanges,
      store: SecretStorePort,
      sealing: SecretSealingPort,
    ) => new RunSecretFetches(secrets, changes, store, sealing),
  },
  {
    provide: SANDBOX_ENV_REVEALS,
    inject: [SECRETS, SECRET_STORE, LOGGER],
    useFactory: (
      secrets: SecretRepository,
      store: SecretStorePort,
      logger: LoggerPort,
    ) => new SandboxEnvReveals(secrets, store, logger),
  },
  {
    provide: SealedSecrets,
    inject: [SECRETS, SECRET_STORE, SECRET_SEALING],
    useFactory: (
      secrets: SecretRepository,
      store: SecretStorePort,
      sealing: SecretSealingPort,
    ) => new SealedSecrets(secrets, store, sealing),
  },
  {
    provide: CALL_SECRET_FETCHES,
    inject: [SealedSecrets, LOGGER],
    useFactory: (sealed: SealedSecrets, logger: LoggerPort) =>
      new CallSecretFetches(sealed, logger),
  },
  {
    provide: HOST_SECRET_FETCHES,
    inject: [SealedSecrets, LOGGER],
    useFactory: (sealed: SealedSecrets, logger: LoggerPort) =>
      new HostSecretFetches(sealed, logger),
  },
  {
    provide: WORKSPACE_SECRETS,
    inject: [SECRETS, SECRET_STORE, ID_GENERATOR, CLOCK],
    useFactory: (
      secrets: SecretRepository,
      store: SecretStorePort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new WorkspaceSecrets(secrets, store, ids, clock),
  },
  { provide: SECRET_USES, useFactory: () => new SecretUsesRegistry() },
  {
    provide: SECRET_INJECTION,
    inject: [SECRETS, RUN_GRANTS_REPOSITORY, RunGrantsChanges, SECRET_STORE],
    useFactory: (
      secrets: SecretRepository,
      grants: RunGrantsRepository,
      changes: RunGrantsChanges,
      store: SecretStorePort,
    ) => new SecretInjection(secrets, grants, changes, store),
  },

  {
    provide: SECRETS_EVENTS,
    inject: [
      PayloadTypes,
      EventSubscribers,
      SECRETS,
      WorkspaceKeys,
      PurgeRunGrants,
      TRANSACTION,
    ],
    useFactory: (
      types: PayloadTypes,
      subscribers: EventSubscribers,
      secrets: SecretRepository,
      keys: WorkspaceKeys,
      runGrants: PurgeRunGrants,
      transaction: TransactionPort,
    ) => {
      types.register('secrets', SECRETS_PAYLOAD_TYPES);
      subscribers.register(
        secretsSubscribers({
          deleting: new DeleteWorkspaceSecrets(secrets, transaction),
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
    inject: [RunGrantsChanges, CLOCK],
    useFactory: (changes: RunGrantsChanges, clock: ClockPort) =>
      new RunGrantEndings(changes, clock),
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
    SECRET_USES,
    SECRET_USE_LOCKS,
    CLOCK,
    TRANSACTION,
  ]),
  ...bindCommandHandler(SetSecretValueCommand, SetSecretValueHandler, [
    WORKSPACE_ACCESS,
    SECRETS,
    CLOCK,
    TRANSACTION,
  ]),
  ...bindCommandHandler(DeleteSecretCommand, DeleteSecretHandler, [
    WORKSPACE_ACCESS,
    SECRETS,
    SECRET_USES,
    SECRET_USE_LOCKS,
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
  ...bindQueryHandler(ListWorkspaceSecretsQuery, ListWorkspaceSecretsHandler, [
    WORKSPACE_ACCESS,
    SECRET_RESOURCES,
  ]),
];
