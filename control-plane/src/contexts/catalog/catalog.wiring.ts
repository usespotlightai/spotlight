import {
  CALL_METER,
  type CallMeterPort,
} from '@catalog/application/ports/call-meter.port';
import { CATALOG } from '@catalog/application/ports/catalog.port';
import {
  CATALOG_SERVICE,
  type CatalogServicePort,
} from '@catalog/application/ports/catalog-service.port';
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
import { CatalogGivings } from '@catalog/application/services/catalog-givings.service';
import { CATALOG_ITEMS } from '@catalog/infrastructure/catalog/catalog-items';
import { SeededCatalog } from '@catalog/infrastructure/catalog/seeded-catalog';
import { DrizzleMeteredCalls } from '@catalog/infrastructure/persistence/drizzle/ledgers/metered-calls.ledger';
import { DrizzleWorkspacePlans } from '@catalog/infrastructure/persistence/drizzle/readers/workspace-plans.reader';
import { DrizzleWorkspacePlanDeletion } from '@catalog/infrastructure/persistence/drizzle/workspace-plan-deletion';
import { AlwaysAllowedCatalogService } from '@catalog/infrastructure/service/always-allowed-catalog-service';
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
  { provide: SeededCatalog, useValue: new SeededCatalog(CATALOG_ITEMS) },

  { provide: WORKSPACE_PLANS, useClass: DrizzleWorkspacePlans },

  {
    provide: WORKSPACE_PLAN_DELETION,
    useClass: DrizzleWorkspacePlanDeletion,
  },

  { provide: CALL_METER, useClass: DrizzleMeteredCalls },

  {
    provide: CATALOG_SERVICE,
    inject: [ENV],
    useFactory: (env: Env) =>
      new AlwaysAllowedCatalogService(
        env.SPOTLIGHT_CATALOG_URL,
        env.SPOTLIGHT_CATALOG_TOKEN,
      ),
  },

  {
    provide: CATALOG,
    inject: [
      SeededCatalog,
      WORKSPACE_PLANS,
      CALL_METER,
      CATALOG_SERVICE,
      CLOCK,
    ],
    useFactory: (
      catalog: SeededCatalog,
      plans: WorkspacePlansPort,
      meter: CallMeterPort,
      service: CatalogServicePort,
      clock: ClockPort,
    ) => new CatalogGivings(catalog, plans, meter, service, clock),
  },

  {
    provide: CATALOG_EVENTS,
    inject: [EventSubscribers, WORKSPACE_PLAN_DELETION, CALL_METER],
    useFactory: (
      subscribers: EventSubscribers,
      plans: WorkspacePlanDeletionPort,
      meter: CallMeterPort,
    ) => {
      subscribers.register(catalogSubscribers({ plans, meter }));
      return true;
    },
  },

  ...bindQueryHandler(ResolveCatalogItemQuery, ResolveCatalogItemHandler, [
    WORKSPACE_ACCESS,
    SeededCatalog,
    WORKSPACE_PLANS,
    CLOCK,
  ]),
];
