import {
  CALL_METER,
  type CallMeterPort,
} from '@catalog/application/ports/call-meter.port';
import { CATALOG } from '@catalog/application/ports/catalog.port';
import {
  CATALOG_SERVICE,
  type CatalogServicePort,
} from '@catalog/application/ports/catalog-service.port';
import { ResolveCatalogItemHandler } from '@catalog/application/queries/handlers/resolve-catalog-item.handler';
import { ResolveCatalogItemQuery } from '@catalog/application/queries/resolve-catalog-item.query';
import { CatalogGivings } from '@catalog/application/services/catalog-givings.service';
import { CATALOG_ITEMS } from '@catalog/infrastructure/catalog/catalog-items';
import { SeededCatalog } from '@catalog/infrastructure/catalog/seeded-catalog';
import { DrizzleMeteredCalls } from '@catalog/infrastructure/persistence/drizzle/repositories/metered-calls.repository';
import { DrizzleWorkspacePlans } from '@catalog/infrastructure/persistence/drizzle/repositories/workspace-plans.repository';
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

  DrizzleWorkspacePlans,

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
      DrizzleWorkspacePlans,
      CALL_METER,
      CATALOG_SERVICE,
      CLOCK,
    ],
    useFactory: (
      catalog: SeededCatalog,
      plans: DrizzleWorkspacePlans,
      meter: CallMeterPort,
      service: CatalogServicePort,
      clock: ClockPort,
    ) => new CatalogGivings(catalog, plans, meter, service, clock),
  },

  {
    provide: CATALOG_EVENTS,
    inject: [EventSubscribers, DrizzleWorkspacePlans, CALL_METER],
    useFactory: (
      subscribers: EventSubscribers,
      plans: DrizzleWorkspacePlans,
      meter: CallMeterPort,
    ) => {
      subscribers.register(catalogSubscribers({ plans, meter }));
      return true;
    },
  },

  ...bindQueryHandler(ResolveCatalogItemQuery, ResolveCatalogItemHandler, [
    WORKSPACE_ACCESS,
    SeededCatalog,
    DrizzleWorkspacePlans,
    CLOCK,
  ]),
];
