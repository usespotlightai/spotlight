import { RemoveWorkspacePlanHandler } from '@catalog/application/commands/handlers/remove-workspace-plan.handler';
import { SetWorkspacePlanHandler } from '@catalog/application/commands/handlers/set-workspace-plan.handler';
import {
  RemoveWorkspacePlanCommand,
  SetWorkspacePlanCommand,
} from '@catalog/application/commands/workspace-plan.commands';
import {
  CATALOG_CALL_LEDGER,
  type CatalogCallLedgerPort,
} from '@catalog/application/ports/catalog-call-ledger.port';
import {
  CATALOG_SERVICE,
  type CatalogServicePort,
} from '@catalog/application/ports/catalog-service.port';
import {
  CATALOG,
  type CatalogPort,
} from '@catalog/application/ports/catalog.port';
import {
  WORKSPACE_PLANS,
  type WorkspacePlansPort,
} from '@catalog/application/ports/workspace-plans.port';
import { WORKSPACES } from '@catalog/application/ports/workspaces.port';
import { ListWorkspaceSummariesHandler } from '@catalog/application/queries/handlers/list-workspace-summaries.handler';
import { ReadWorkspaceSummaryHandler } from '@catalog/application/queries/handlers/read-workspace-summary.handler';
import { ResolveCatalogItemHandler } from '@catalog/application/queries/handlers/resolve-catalog-item.handler';
import { ListWorkspaceSummariesQuery } from '@catalog/application/queries/list-workspace-summaries.query';
import { ReadWorkspaceSummaryQuery } from '@catalog/application/queries/read-workspace-summary.query';
import { ResolveCatalogItemQuery } from '@catalog/application/queries/resolve-catalog-item.query';
import { CatalogCalls } from '@catalog/application/services/catalog-calls.service';
import { CatalogEntitlements } from '@catalog/application/services/catalog-entitlements.service';
import { WorkspacePlanAdministration } from '@catalog/application/services/workspace-plan-administration.service';
import { Workspaces } from '@catalog/infrastructure/acl/workspaces.adapter';
import { CATALOG_ITEMS } from '@catalog/infrastructure/catalog/catalog-items';
import { StaticCatalog } from '@catalog/infrastructure/catalog/static-catalog';
import { CATALOG_PAYLOAD_TYPES } from '@catalog/infrastructure/events/catalog-payload-types';
import { DrizzleCatalogCallLedger } from '@catalog/infrastructure/persistence/drizzle/ledgers/catalog-call.ledger';
import { DrizzleWorkspacePlans } from '@catalog/infrastructure/persistence/drizzle/readers/workspace-plans.reader';
import { DrizzleWorkspacePlanRepository } from '@catalog/infrastructure/persistence/drizzle/repositories/workspace-plan.repository';
import { HttpCatalogClient } from '@catalog/infrastructure/service/http-catalog.client';
import { catalogSubscribers } from '@catalog/presentation/events/catalog.subscribers';
import { AdminWorkspaceController } from '@catalog/presentation/http/controllers/admin-workspace.controller';
import { CatalogController } from '@catalog/presentation/http/controllers/catalog.controller';
import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
import {
  WORKSPACE_DIRECTORY,
  type WorkspaceDirectoryPort,
} from '@identity/application/ports/workspace-directory.port';
import type { Provider, Type } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { PayloadTypes } from '@platform/events/payload-types';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';

const CATALOG_EVENTS = Symbol('CATALOG_EVENTS');

export const CATALOG_CONTROLLERS: readonly Type[] = [
  CatalogController,
  AdminWorkspaceController,
];

export const CATALOG_PROVIDERS: readonly Provider[] = [
  { provide: StaticCatalog, useValue: new StaticCatalog(CATALOG_ITEMS) },

  { provide: WORKSPACE_PLANS, useClass: DrizzleWorkspacePlans },

  DrizzleWorkspacePlanRepository,

  {
    provide: WORKSPACES,
    inject: [WORKSPACE_DIRECTORY],
    useFactory: (directory: WorkspaceDirectoryPort) =>
      new Workspaces(directory),
  },

  {
    provide: WorkspacePlanAdministration,
    inject: [DrizzleWorkspacePlanRepository],
    useFactory: (plans: DrizzleWorkspacePlanRepository) =>
      new WorkspacePlanAdministration(plans),
  },

  { provide: CATALOG_CALL_LEDGER, useClass: DrizzleCatalogCallLedger },

  {
    provide: CATALOG_SERVICE,
    inject: [ENV],
    useFactory: (env: Env) =>
      new HttpCatalogClient(
        env.SPOTLIGHT_CATALOG_URL,
        env.SPOTLIGHT_CATALOG_TOKEN,
      ),
  },

  {
    provide: CatalogEntitlements,
    inject: [StaticCatalog, WORKSPACE_PLANS, CLOCK],
    useFactory: (
      catalog: StaticCatalog,
      plans: WorkspacePlansPort,
      clock: ClockPort,
    ) => new CatalogEntitlements(catalog, plans, clock),
  },

  {
    provide: CatalogCalls,
    inject: [
      StaticCatalog,
      WORKSPACE_PLANS,
      CATALOG_CALL_LEDGER,
      CATALOG_SERVICE,
      CLOCK,
    ],
    useFactory: (
      catalog: StaticCatalog,
      plans: WorkspacePlansPort,
      ledger: CatalogCallLedgerPort,
      service: CatalogServicePort,
      clock: ClockPort,
    ) => new CatalogCalls(catalog, plans, ledger, service, clock),
  },

  {
    provide: CATALOG,
    inject: [CatalogEntitlements, CatalogCalls],
    useFactory: (
      entitlements: CatalogEntitlements,
      calls: CatalogCalls,
    ): CatalogPort => ({
      entitledTo: (workspaceId, request) =>
        entitlements.entitledTo(workspaceId, request),
      call: (request) => calls.call(request),
    }),
  },

  {
    provide: CATALOG_EVENTS,
    inject: [
      PayloadTypes,
      EventSubscribers,
      WorkspacePlanAdministration,
      CATALOG_CALL_LEDGER,
    ],
    useFactory: (
      types: PayloadTypes,
      subscribers: EventSubscribers,
      plans: WorkspacePlanAdministration,
      calls: CatalogCallLedgerPort,
    ) => {
      types.register('catalog', CATALOG_PAYLOAD_TYPES);
      subscribers.register(catalogSubscribers({ plans, calls }));
      return true;
    },
  },

  ...bindQueryHandler(ResolveCatalogItemQuery, ResolveCatalogItemHandler, [
    WORKSPACE_ACCESS,
    StaticCatalog,
    WORKSPACE_PLANS,
    CLOCK,
  ]),

  ...bindQueryHandler(
    ListWorkspaceSummariesQuery,
    ListWorkspaceSummariesHandler,
    [WORKSPACES, WORKSPACE_PLANS],
  ),

  ...bindQueryHandler(ReadWorkspaceSummaryQuery, ReadWorkspaceSummaryHandler, [
    WORKSPACES,
    WORKSPACE_PLANS,
  ]),

  ...bindCommandHandler(SetWorkspacePlanCommand, SetWorkspacePlanHandler, [
    WORKSPACES,
    WorkspacePlanAdministration,
  ]),

  ...bindCommandHandler(
    RemoveWorkspacePlanCommand,
    RemoveWorkspacePlanHandler,
    [WORKSPACES, WorkspacePlanAdministration],
  ),
];
