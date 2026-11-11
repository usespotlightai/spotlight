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
  WORKSPACE_PLAN_DELETION,
  type WorkspacePlanDeletionPort,
} from '@catalog/application/ports/workspace-plan-deletion.port';
import {
  WORKSPACE_PLANS,
  type WorkspacePlansPort,
} from '@catalog/application/ports/workspace-plans.port';
import { ResolveCatalogItemHandler } from '@catalog/application/queries/handlers/resolve-catalog-item.handler';
import { ResolveCatalogItemQuery } from '@catalog/application/queries/resolve-catalog-item.query';
import { CatalogCalls } from '@catalog/application/services/catalog-calls.service';
import { CatalogEntitlements } from '@catalog/application/services/catalog-entitlements.service';
import { CATALOG_ITEMS } from '@catalog/infrastructure/catalog/catalog-items';
import { StaticCatalog } from '@catalog/infrastructure/catalog/static-catalog';
import { DrizzleCatalogCallLedger } from '@catalog/infrastructure/persistence/drizzle/ledgers/catalog-call.ledger';
import { DrizzleWorkspacePlans } from '@catalog/infrastructure/persistence/drizzle/readers/workspace-plans.reader';
import { DrizzleWorkspacePlanDeletion } from '@catalog/infrastructure/persistence/drizzle/workspace-plan-deletion';
import { HttpCatalogClient } from '@catalog/infrastructure/service/http-catalog.client';
import { catalogSubscribers } from '@catalog/presentation/events/catalog.subscribers';
import { CatalogController } from '@catalog/presentation/http/controllers/catalog.controller';
import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
import type { Provider, Type } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';

const CATALOG_EVENTS = Symbol('CATALOG_EVENTS');

export const CATALOG_CONTROLLERS: readonly Type[] = [CatalogController];

export const CATALOG_PROVIDERS: readonly Provider[] = [
  { provide: StaticCatalog, useValue: new StaticCatalog(CATALOG_ITEMS) },

  { provide: WORKSPACE_PLANS, useClass: DrizzleWorkspacePlans },

  {
    provide: WORKSPACE_PLAN_DELETION,
    useClass: DrizzleWorkspacePlanDeletion,
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
    inject: [EventSubscribers, WORKSPACE_PLAN_DELETION, CATALOG_CALL_LEDGER],
    useFactory: (
      subscribers: EventSubscribers,
      plans: WorkspacePlanDeletionPort,
      calls: CatalogCallLedgerPort,
    ) => {
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
];
