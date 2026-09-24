import { KMSClient } from '@aws-sdk/client-kms';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
import {
  WORKSPACE_HOLDINGS,
  type WorkspaceHoldingsPort,
} from '@identity/application/ports/workspace-holdings.port';
import type { Provider, Type } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { EventTypes } from '@platform/events/event-types';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import { CreateSecretCommand } from '@secrets/application/commands/create-secret.command';
import { DeleteSecretCommand } from '@secrets/application/commands/delete-secret.command';
import { CreateSecretHandler } from '@secrets/application/commands/handlers/create-secret.handler';
import { DeleteSecretHandler } from '@secrets/application/commands/handlers/delete-secret.handler';
import { UpdateSecretHandler } from '@secrets/application/commands/handlers/update-secret.handler';
import { UpdateSecretCommand } from '@secrets/application/commands/update-secret.command';
import { CREDENTIAL_SEALING } from '@secrets/application/ports/credential-sealing.port';
import { DEFINED_SECRETS } from '@secrets/application/ports/defined-secrets.port';
import { RUN_GRANTS } from '@secrets/application/ports/run-grants.port';
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
import { ReadSecretHandler } from '@secrets/application/queries/handlers/read-secret.handler';
import { ImportSecretQuery } from '@secrets/application/queries/import-secret.query';
import { ReadSecretQuery } from '@secrets/application/queries/read-secret.query';
import { AbandonWorkspaceSecrets } from '@secrets/application/services/abandon-workspace-secrets.service';
import { RunGrants } from '@secrets/application/services/run-grants.service';
import { SecretConfiguration } from '@secrets/application/services/secret-configuration.service';
import { SecretInjection } from '@secrets/application/services/secret-injection.service';
import { SecretSources } from '@secrets/application/services/secret-sources.service';
import { SECRETS_EVENT_TYPES } from '@secrets/domain/event-types';
import {
  SECRETS,
  type SecretRepository,
} from '@secrets/domain/repositories/secret.repository';
import {
  SECRET_GRANTS,
  type SecretGrantRepository,
} from '@secrets/domain/repositories/secret-grant.repository';
import { WorkspaceKeys } from '@secrets/infrastructure/crypto/workspace-keys';
import { SecretDefinitions } from '@secrets/infrastructure/definitions/secret-definitions';
import { AwsKeyManagement } from '@secrets/infrastructure/kms/aws-key-management';
import {
  KEY_MANAGEMENT,
  type KeyManagement,
} from '@secrets/infrastructure/kms/key-management';
import { LocalKeyManagement } from '@secrets/infrastructure/kms/local-key-management';
import { DrizzleSecretResources } from '@secrets/infrastructure/persistence/drizzle/readers/secret-resources.reader';
import { DrizzleSecretGrants } from '@secrets/infrastructure/persistence/drizzle/repositories/secret-grants.repository';
import { DrizzleSecrets } from '@secrets/infrastructure/persistence/drizzle/repositories/secrets.repository';
import { WorkspaceCredentialSealing } from '@secrets/infrastructure/sealing/workspace-credential-sealing';
import { AwsSecretsManagerSource } from '@secrets/infrastructure/sources/aws-secrets-manager.source';
import { BuiltInSecretStore } from '@secrets/infrastructure/sources/built-in-secret.store';
import { secretsSubscribers } from '@secrets/presentation/events/secrets.subscribers';
import { SecretResourceController } from '@secrets/presentation/http/controllers/secret-resource.controller';
import { CLOCK } from '@shared-kernel/application/ports/clock.port';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '@shared-kernel/application/ports/domain-event-dispatcher.port';
import { ID_GENERATOR } from '@shared-kernel/application/ports/id-generator.port';
import { IDEMPOTENT_CREATES } from '@shared-kernel/application/ports/idempotent-creates.port';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';

const SECRETS_EVENTS = Symbol('SECRETS_EVENTS');

const SECRETS_HOLDINGS = Symbol('SECRETS_HOLDINGS');

export const SECRETS_CONTROLLERS: readonly Type[] = [SecretResourceController];

const keyManagementFor = (env: Env): KeyManagement =>
  env.SECRETS_KMS_KEY_ID
    ? new AwsKeyManagement(new KMSClient({}), env.SECRETS_KMS_KEY_ID)
    : new LocalKeyManagement(env.SPOTLIGHT_SECRETS_KEY ?? '');

export const SECRETS_PROVIDERS: readonly Provider[] = [
  { provide: SECRET_GRANTS, useClass: DrizzleSecretGrants },
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
    provide: CREDENTIAL_SEALING,
    inject: [WorkspaceKeys],
    useFactory: (keys: WorkspaceKeys) => new WorkspaceCredentialSealing(keys),
  },
  {
    provide: SecretSources,
    inject: [SECRET_STORE, AWS_SECRETS_MANAGER],
    useFactory: (store: SecretSourcePort, aws: SecretSourcePort) =>
      new SecretSources(store, aws),
  },
  {
    provide: SECRET_INJECTION,
    inject: [SECRETS, SECRET_GRANTS, SecretSources],
    useFactory: (
      secrets: SecretRepository,
      grants: SecretGrantRepository,
      sources: SecretSources,
    ) => new SecretInjection(secrets, grants, sources),
  },

  {
    provide: SECRETS_EVENTS,
    inject: [EventTypes, EventSubscribers, SECRETS, WorkspaceKeys, TRANSACTION],
    useFactory: (
      types: EventTypes,
      subscribers: EventSubscribers,
      secrets: SecretRepository,
      keys: WorkspaceKeys,
      transaction: TransactionPort,
    ) => {
      types.register('secrets', SECRETS_EVENT_TYPES);
      subscribers.register(
        secretsSubscribers({
          abandoning: new AbandonWorkspaceSecrets(secrets, transaction),
          keys,
        }),
      );
      return true;
    },
  },
  {
    provide: SECRETS_HOLDINGS,
    inject: [WORKSPACE_HOLDINGS, DrizzleSecretResources],
    useFactory: (
      holdings: WorkspaceHoldingsPort,
      secrets: DrizzleSecretResources,
    ) => {
      holdings.register(secrets);
      return true;
    },
  },
  {
    provide: RUN_GRANTS,
    inject: [SECRET_GRANTS],
    useFactory: (grants: SecretGrantRepository) => new RunGrants(grants),
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
];
