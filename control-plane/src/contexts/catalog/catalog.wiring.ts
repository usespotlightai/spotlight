import {
  CATALOG_SERVICE,
  type CatalogServicePort,
} from '@catalog/application/ports/catalog-service.port';
import {
  CATALOG,
  type CatalogPort,
} from '@catalog/application/ports/catalog.port';
import { ResolveCatalogItemHandler } from '@catalog/application/queries/handlers/resolve-catalog-item.handler';
import { ResolveCatalogItemQuery } from '@catalog/application/queries/resolve-catalog-item.query';
import { CatalogCalls } from '@catalog/application/services/catalog-calls.service';
import { CatalogResolutions } from '@catalog/application/services/catalog-resolutions.service';
import { CATALOG_ITEMS } from '@catalog/infrastructure/catalog/catalog-items';
import { StaticCatalog } from '@catalog/infrastructure/catalog/static-catalog';
import { CATALOG_PAYLOAD_TYPES } from '@catalog/infrastructure/events/catalog-payload-types';
import { HttpCatalogClient } from '@catalog/infrastructure/service/http-catalog.client';
import { CatalogController } from '@catalog/presentation/http/controllers/catalog.controller';
import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
import type { Provider, Type } from '@nestjs/common';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { PayloadTypes } from '@platform/events/payload-types';

const CATALOG_EVENTS = Symbol('CATALOG_EVENTS');

export const CATALOG_CONTROLLERS: readonly Type[] = [CatalogController];

export const CATALOG_PROVIDERS: readonly Provider[] = [
  { provide: StaticCatalog, useValue: new StaticCatalog(CATALOG_ITEMS) },

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
    provide: CatalogResolutions,
    inject: [StaticCatalog],
    useFactory: (catalog: StaticCatalog) => new CatalogResolutions(catalog),
  },

  {
    provide: CatalogCalls,
    inject: [StaticCatalog, CATALOG_SERVICE],
    useFactory: (catalog: StaticCatalog, service: CatalogServicePort) =>
      new CatalogCalls(catalog, service),
  },

  {
    provide: CATALOG,
    inject: [CatalogResolutions, CatalogCalls],
    useFactory: (
      resolutions: CatalogResolutions,
      calls: CatalogCalls,
    ): CatalogPort => ({
      resolve: (request) => resolutions.resolve(request),
      call: (request) => calls.call(request),
    }),
  },

  {
    provide: CATALOG_EVENTS,
    inject: [PayloadTypes],
    useFactory: (types: PayloadTypes) => {
      types.register('catalog', CATALOG_PAYLOAD_TYPES);
      return true;
    },
  },

  ...bindQueryHandler(ResolveCatalogItemQuery, ResolveCatalogItemHandler, [
    WORKSPACE_ACCESS,
    StaticCatalog,
  ]),
];
