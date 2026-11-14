import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
import {
  WORKSPACE_OUTBOUND_SCOPE,
  type WorkspaceOutboundScopePort,
} from '@identity/application/ports/workspace-outbound-scope.port';
import { CreateInferenceEndpointHandler } from '@inference/application/commands/handlers/create-inference-endpoint.handler';
import { DeleteInferenceEndpointHandler } from '@inference/application/commands/handlers/delete-inference-endpoint.handler';
import { TestInferenceEndpointHandler } from '@inference/application/commands/handlers/test-inference-endpoint.handler';
import { UpdateInferenceEndpointHandler } from '@inference/application/commands/handlers/update-inference-endpoint.handler';
import {
  CreateInferenceEndpointCommand,
  DeleteInferenceEndpointCommand,
  TestInferenceEndpointCommand,
  UpdateInferenceEndpointCommand,
} from '@inference/application/commands/inference-endpoint.commands';
import { INFERENCE_ENDPOINT_DEFINITIONS } from '@inference/application/ports/inference-endpoint-definitions.port';
import { INFERENCE_RESOLUTION } from '@inference/application/ports/inference-resolution.port';
import { INFERENCE_TRANSPORT } from '@inference/application/ports/inference-transport.port';
import { ImportInferenceEndpointHandler } from '@inference/application/queries/handlers/import-inference-endpoint.handler';
import { ListInferenceEndpointResourcesHandler } from '@inference/application/queries/handlers/list-inference-endpoint-resources.handler';
import { ReadInferenceEndpointHandler } from '@inference/application/queries/handlers/read-inference-endpoint.handler';
import {
  ImportInferenceEndpointQuery,
  ListInferenceEndpointResourcesQuery,
  ReadInferenceEndpointQuery,
} from '@inference/application/queries/inference-endpoint.queries';
import { DeleteInferenceEndpointOfDeletedWorkspace } from '@inference/application/services/delete-inference-endpoint-of-deleted-workspace.service';
import {
  INFERENCE_ENDPOINTS,
  type InferenceEndpointRepository,
} from '@inference/domain/repositories/inference-endpoint.repository';
import { InferenceEndpointDefinitions } from '@inference/infrastructure/definitions/inference-endpoint-definitions';
import { InferenceCalls } from '@inference/infrastructure/outbound/inference-calls';
import { InferenceEndpoints } from '@inference/infrastructure/outbound/inference-endpoints';
import { InferenceTransport } from '@inference/infrastructure/outbound/inference-transport';
import { DrizzleInferenceEndpoints } from '@inference/infrastructure/persistence/drizzle/repositories/inference-endpoint.repository';
import { inferenceSubscribers } from '@inference/presentation/events/inference.subscribers';
import { InferenceEndpointResourceController } from '@inference/presentation/http/controllers/inference-endpoint-resource.controller';
import type { Provider, Type } from '@nestjs/common';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { MODEL_PRICES, type ModelPrices } from '@platform/llm/model-prices';
import { OutboundGuard } from '@platform/outbound/outbound-guard';
import { DrizzleContext } from '@platform/persistence/drizzle/drizzle.context';
import {
  WORKSPACE_SECRETS,
  type WorkspaceSecretsPort,
} from '@secrets/application/ports/workspace-secrets.port';
import { ID_GENERATOR } from '@shared-kernel/application/ports/id-generator.port';
import { IDEMPOTENT_CREATES } from '@shared-kernel/application/ports/idempotent-creates.port';
import { INFERENCE_CALLS } from '@shared-kernel/application/ports/inference-calls.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import {
  TELEMETRY,
  type TelemetryPort,
} from '@shared-kernel/application/ports/telemetry.port';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';

const INFERENCE_EVENTS = Symbol('INFERENCE_EVENTS');

export const INFERENCE_CONTROLLERS: readonly Type[] = [
  InferenceEndpointResourceController,
];

export const INFERENCE_PROVIDERS: readonly Provider[] = [
  {
    provide: INFERENCE_ENDPOINTS,
    inject: [DrizzleContext],
    useFactory: (context: DrizzleContext) =>
      new DrizzleInferenceEndpoints(context),
  },
  {
    provide: INFERENCE_ENDPOINT_DEFINITIONS,
    useClass: InferenceEndpointDefinitions,
  },
  {
    provide: InferenceEndpoints,
    inject: [INFERENCE_ENDPOINTS, WORKSPACE_SECRETS, MODEL_PRICES],
    useFactory: (
      endpoints: InferenceEndpointRepository,
      secrets: WorkspaceSecretsPort,
      prices: ModelPrices,
    ) => new InferenceEndpoints(endpoints, secrets, prices),
  },
  { provide: INFERENCE_RESOLUTION, useExisting: InferenceEndpoints },
  {
    provide: INFERENCE_TRANSPORT,
    inject: [WORKSPACE_OUTBOUND_SCOPE, OutboundGuard, TELEMETRY, LOGGER],
    useFactory: (
      scope: WorkspaceOutboundScopePort,
      guard: OutboundGuard,
      telemetry: TelemetryPort,
      logger: LoggerPort,
    ) => new InferenceTransport(scope, guard, telemetry, logger),
  },
  {
    provide: INFERENCE_CALLS,
    inject: [InferenceEndpoints, INFERENCE_TRANSPORT, LOGGER],
    useFactory: (
      endpoints: InferenceEndpoints,
      transport: InferenceTransport,
      logger: LoggerPort,
    ) => new InferenceCalls(endpoints, transport, logger),
  },
  {
    provide: INFERENCE_EVENTS,
    inject: [
      EventSubscribers,
      INFERENCE_ENDPOINTS,
      InferenceEndpoints,
      TRANSACTION,
    ],
    useFactory: (
      subscribers: EventSubscribers,
      endpoints: InferenceEndpointRepository,
      resolution: InferenceEndpoints,
      transaction: TransactionPort,
    ) => {
      subscribers.register(
        inferenceSubscribers({
          deleting: new DeleteInferenceEndpointOfDeletedWorkspace(
            endpoints,
            resolution,
            transaction,
          ),
        }),
      );
      return true;
    },
  },

  ...bindCommandHandler(
    CreateInferenceEndpointCommand,
    CreateInferenceEndpointHandler,
    [
      WORKSPACE_ACCESS,
      INFERENCE_ENDPOINT_DEFINITIONS,
      INFERENCE_ENDPOINTS,
      WORKSPACE_SECRETS,
      INFERENCE_TRANSPORT,
      INFERENCE_RESOLUTION,
      IDEMPOTENT_CREATES,
      ID_GENERATOR,
      TRANSACTION,
    ],
  ),
  ...bindCommandHandler(
    UpdateInferenceEndpointCommand,
    UpdateInferenceEndpointHandler,
    [
      WORKSPACE_ACCESS,
      INFERENCE_ENDPOINT_DEFINITIONS,
      INFERENCE_ENDPOINTS,
      WORKSPACE_SECRETS,
      INFERENCE_TRANSPORT,
      INFERENCE_RESOLUTION,
      TRANSACTION,
    ],
  ),
  ...bindCommandHandler(
    DeleteInferenceEndpointCommand,
    DeleteInferenceEndpointHandler,
    [
      WORKSPACE_ACCESS,
      INFERENCE_ENDPOINTS,
      WORKSPACE_SECRETS,
      INFERENCE_RESOLUTION,
      TRANSACTION,
    ],
  ),
  ...bindCommandHandler(
    TestInferenceEndpointCommand,
    TestInferenceEndpointHandler,
    [
      WORKSPACE_ACCESS,
      INFERENCE_ENDPOINT_DEFINITIONS,
      WORKSPACE_SECRETS,
      INFERENCE_TRANSPORT,
    ],
  ),
  ...bindQueryHandler(
    ReadInferenceEndpointQuery,
    ReadInferenceEndpointHandler,
    [WORKSPACE_ACCESS, INFERENCE_ENDPOINTS],
  ),
  ...bindQueryHandler(
    ImportInferenceEndpointQuery,
    ImportInferenceEndpointHandler,
    [WORKSPACE_ACCESS, INFERENCE_ENDPOINTS],
  ),
  ...bindQueryHandler(
    ListInferenceEndpointResourcesQuery,
    ListInferenceEndpointResourcesHandler,
    [WORKSPACE_ACCESS, INFERENCE_ENDPOINTS],
  ),
];
