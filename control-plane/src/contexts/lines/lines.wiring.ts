import {
  CATALOG,
  type CatalogPort,
} from '@catalog/application/ports/catalog.port';
import {
  TEAM_DEPENDENTS,
  type TeamDependentsPort,
} from '@identity/application/ports/team-dependents.port';
import {
  TEAM_DIRECTORY,
  type TeamDirectoryPort,
} from '@identity/application/ports/team-directory.port';
import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
import { CreateLineCommand } from '@lines/application/commands/create-line.command';
import { DeleteLineCommand } from '@lines/application/commands/delete-line.command';
import { CreateLineHandler } from '@lines/application/commands/handlers/create-line.handler';
import { DeleteLineHandler } from '@lines/application/commands/handlers/delete-line.handler';
import { UpdateLineHandler } from '@lines/application/commands/handlers/update-line.handler';
import { UpdateLineCommand } from '@lines/application/commands/update-line.command';
import { DeleteTeamLines } from '@lines/application/events/handlers/delete-team-lines.handler';
import { SeedLines } from '@lines/application/events/handlers/seed-lines.handler';
import { LINES_EVENT_MAPPERS } from '@lines/application/integration-events/lines.event-mappers';
import { ENABLED_AT_STATIONS } from '@lines/application/ports/enabled-at-stations.port';
import {
  LINE_COMPILER,
  type LineCompilerPort,
} from '@lines/application/ports/line-compiler.port';
import { LINE_IMAGES } from '@lines/application/ports/line-images.port';
import { LINE_READER } from '@lines/application/ports/line-reader.port';
import {
  LINE_RENDERING,
  type LineRenderingPort,
} from '@lines/application/ports/line-rendering.port';
import {
  LINE_RESOURCES,
  type LineResourcesPort,
} from '@lines/application/ports/line-resources.port';
import { LINES } from '@lines/application/ports/lines.port';
import {
  SEEDING_HARNESS,
  type SeedingHarnessPort,
} from '@lines/application/ports/seeding-harness.port';
import {
  STATION_DELETION_GUARD,
  type StationDeletionGuardPort,
} from '@lines/application/ports/station-deletion-guard.port';
import { ImportLineHandler } from '@lines/application/queries/handlers/import-line.handler';
import { ListLineResourcesHandler } from '@lines/application/queries/handlers/list-line-resources.handler';
import { ListLinesHandler } from '@lines/application/queries/handlers/list-lines.handler';
import { ReadLineHandler } from '@lines/application/queries/handlers/read-line.handler';
import { ImportLineQuery } from '@lines/application/queries/import-line.query';
import { ListLineResourcesQuery } from '@lines/application/queries/list-line-resources.query';
import { ListLinesQuery } from '@lines/application/queries/list-lines.query';
import { ReadLineQuery } from '@lines/application/queries/read-line.query';
import { ApplyLines } from '@lines/application/services/apply-lines.service';
import { CatalogDenials } from '@lines/application/services/catalog-denials.service';
import { LineViews } from '@lines/application/services/line-views.service';
import { PublishedLines } from '@lines/application/services/published-lines.service';
import { LINES_PAYLOAD_TYPES } from '@lines/infrastructure/events/lines-payload-types';
import { LineCompiler } from '@lines/infrastructure/lines/line.compile';
import { LineDefinitionRendering } from '@lines/infrastructure/lines/line-definition-rendering';
import { DrizzleEnabledAtStations } from '@lines/infrastructure/persistence/drizzle/readers/enabled-at-stations.reader';
import { DrizzleLineReader } from '@lines/infrastructure/persistence/drizzle/readers/line.reader';
import { DrizzleLineDependents } from '@lines/infrastructure/persistence/drizzle/readers/line-dependents.reader';
import { DrizzleLineImages } from '@lines/infrastructure/persistence/drizzle/readers/line-images.reader';
import { DrizzleLineResources } from '@lines/infrastructure/persistence/drizzle/readers/line-resources.reader';
import { DrizzleLineRepository } from '@lines/infrastructure/persistence/drizzle/repositories/line.repository';
import { linesSubscribers } from '@lines/presentation/events/lines.subscribers';
import { LineController } from '@lines/presentation/http/controllers/line.controller';
import { LineResourceController } from '@lines/presentation/http/controllers/line-resource.controller';
import type { Provider, Type } from '@nestjs/common';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import { PayloadTypes } from '@platform/events/payload-types';
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

const LINES_DEPENDENTS = Symbol('LINES_DEPENDENTS');

const LINES_EVENTS = Symbol('LINES_EVENTS');

export const LINES_CONTROLLERS: readonly Type[] = [
  LineController,
  LineResourceController,
];

export const LINES_PROVIDERS: readonly Provider[] = [
  DrizzleLineRepository,
  DrizzleLineDependents,
  { provide: ENABLED_AT_STATIONS, useClass: DrizzleEnabledAtStations },
  { provide: LINE_READER, useClass: DrizzleLineReader },
  { provide: LINE_IMAGES, useClass: DrizzleLineImages },
  { provide: LINE_COMPILER, useClass: LineCompiler },
  { provide: LINE_RENDERING, useClass: LineDefinitionRendering },
  { provide: LINE_RESOURCES, useClass: DrizzleLineResources },

  {
    provide: LINES_DEPENDENTS,
    inject: [TEAM_DEPENDENTS, DrizzleLineDependents],
    useFactory: (
      dependents: TeamDependentsPort,
      lines: DrizzleLineDependents,
    ) => {
      dependents.register(lines);
      return true;
    },
  },

  {
    provide: CatalogDenials,
    inject: [CATALOG],
    useFactory: (catalog: CatalogPort) => new CatalogDenials(catalog),
  },

  {
    provide: ApplyLines,
    inject: [DrizzleLineRepository, STATION_DELETION_GUARD, ID_GENERATOR],
    useFactory: (
      lines: DrizzleLineRepository,
      guard: StationDeletionGuardPort,
      ids: IdGeneratorPort,
    ) => new ApplyLines(lines, guard, ids),
  },

  {
    provide: LineViews,
    inject: [TEAM_DIRECTORY],
    useFactory: (teams: TeamDirectoryPort) => new LineViews(teams),
  },

  {
    provide: LINES,
    inject: [
      DrizzleLineRepository,
      LINE_RESOURCES,
      LINE_COMPILER,
      LINE_RENDERING,
      CatalogDenials,
      ID_GENERATOR,
    ],
    useFactory: (
      lines: DrizzleLineRepository,
      resources: LineResourcesPort,
      compiler: LineCompilerPort,
      rendering: LineRenderingPort,
      catalog: CatalogDenials,
      ids: IdGeneratorPort,
    ) =>
      new PublishedLines(lines, resources, compiler, rendering, catalog, ids),
  },

  {
    provide: LINES_EVENTS,
    inject: [
      PayloadTypes,
      IntegrationEventMappers,
      EventSubscribers,
      DrizzleLineRepository,
      ApplyLines,
      TRANSACTION,
      ID_GENERATOR,
      LOGGER,
      SEEDING_HARNESS,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
      subscribers: EventSubscribers,
      lines: DrizzleLineRepository,
      applying: ApplyLines,
      transaction: TransactionPort,
      ids: IdGeneratorPort,
      logger: LoggerPort,
      seedingHarness: SeedingHarnessPort,
    ) => {
      types.register('lines', LINES_PAYLOAD_TYPES);
      mappers.register(LINES_EVENT_MAPPERS);
      subscribers.register(
        linesSubscribers({
          seeding: new SeedLines(lines, ids, seedingHarness.harness),
          deleting: new DeleteTeamLines(lines, applying, transaction, logger),
        }),
      );
      return true;
    },
  },

  ...bindQueryHandler(ListLinesQuery, ListLinesHandler, [
    WORKSPACE_ACCESS,
    LINE_READER,
  ]),

  ...bindCommandHandler(CreateLineCommand, CreateLineHandler, [
    WORKSPACE_ACCESS,
    TEAM_DIRECTORY,
    LINE_COMPILER,
    ApplyLines,
    IDEMPOTENT_CREATES,
    TRANSACTION,
    CatalogDenials,
  ]),

  ...bindCommandHandler(UpdateLineCommand, UpdateLineHandler, [
    WORKSPACE_ACCESS,
    LINE_COMPILER,
    DrizzleLineRepository,
    ApplyLines,
    TRANSACTION,
    CatalogDenials,
  ]),

  ...bindCommandHandler(DeleteLineCommand, DeleteLineHandler, [
    WORKSPACE_ACCESS,
    DrizzleLineRepository,
    ApplyLines,
    TRANSACTION,
  ]),

  ...bindQueryHandler(ReadLineQuery, ReadLineHandler, [
    WORKSPACE_ACCESS,
    LINE_RESOURCES,
    LineViews,
  ]),

  ...bindQueryHandler(ImportLineQuery, ImportLineHandler, [
    WORKSPACE_ACCESS,
    TEAM_DIRECTORY,
    LINE_RESOURCES,
    LineViews,
  ]),

  ...bindQueryHandler(ListLineResourcesQuery, ListLineResourcesHandler, [
    WORKSPACE_ACCESS,
    TEAM_DIRECTORY,
    LINE_RESOURCES,
    LineViews,
  ]),
];
