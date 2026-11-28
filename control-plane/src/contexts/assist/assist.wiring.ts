import { SubmitAssistResultHandler } from '@assist/application/commands/handlers/submit-assist-result.handler';
import { SubmitAssistResultCommand } from '@assist/application/commands/submit-assist-result.command';
import { ASSIST_EVENT_MAPPERS } from '@assist/application/integration-events/assist.event-mappers';
import { ASSIST_SESSION_LABELS } from '@assist/application/ports/assist-session-labels.port';
import {
  ASSIST_SESSION_READER,
  type AssistSessionReaderPort,
} from '@assist/application/ports/assist-session-reader.port';
import { ASSIST_SESSIONS } from '@assist/application/ports/assist-sessions.port';
import {
  RESULT_CHECKS,
  type ResultChecksPort,
} from '@assist/application/ports/result-checks.port';
import { RUNS, type RunsPort } from '@assist/application/ports/runs.port';
import { AssistSessionLabels } from '@assist/application/services/assist-session-labels.service';
import { AssistSessions } from '@assist/application/services/assist-sessions.service';
import {
  ASSIST_SESSION_REPOSITORY,
  type AssistSessionRepository,
} from '@assist/domain/repositories/assist-session.repository';
import { Runs } from '@assist/infrastructure/acl/runs.adapter';
import { ASSIST_PAYLOAD_TYPES } from '@assist/infrastructure/events/assist-payload-types';
import { JsonSchemaResultChecks } from '@assist/infrastructure/json/json-schema-result-checks';
import { DrizzleAssistSessionReader } from '@assist/infrastructure/persistence/drizzle/readers/assist-session.reader';
import { DrizzleAssistSessionRepository } from '@assist/infrastructure/persistence/drizzle/repositories/assist-session.repository';
import { assistSubscribers } from '@assist/presentation/events/assist.subscribers';
import { RunnerAssistResultController } from '@assist/presentation/http/controllers/runner-assist-result.controller';
import type { Provider, Type } from '@nestjs/common';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { IntegrationEventMappers } from '@platform/events/integration-event-mappers';
import { PayloadTypes } from '@platform/events/payload-types';
import {
  HARNESS_COMMANDS,
  type HarnessCommandsPort,
} from '@runs/application/ports/harness-commands.port';
import {
  RUN_ARCHIVES,
  type RunArchivesPort,
} from '@runs/application/ports/run-archives.port';
import {
  RUN_FACTS,
  type RunFactsPort,
} from '@runs/application/ports/run-facts.port';
import {
  RUN_LEASES,
  type RunLeasesPort,
} from '@runs/application/ports/run-leases.port';
import {
  RUN_REQUESTER_LABELS,
  type RunRequesterLabelsPort,
} from '@runs/application/ports/run-requester-labels.port';
import {
  RUNS as RUN_QUEUE,
  type RunsPort as RunQueuePort,
} from '@runs/application/ports/runs.port';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import {
  ID_GENERATOR,
  type IdGeneratorPort,
} from '@shared-kernel/application/ports/id-generator.port';
import {
  STATION_RUNS,
  type StationRunsPort,
} from '@work/application/ports/station-runs.port';

const ASSIST_EVENTS = Symbol('ASSIST_EVENTS');

export const ASSIST_CONTROLLERS: readonly Type[] = [
  RunnerAssistResultController,
];

export const ASSIST_PROVIDERS: readonly Provider[] = [
  {
    provide: ASSIST_SESSION_REPOSITORY,
    useClass: DrizzleAssistSessionRepository,
  },

  { provide: RESULT_CHECKS, useClass: JsonSchemaResultChecks },

  {
    provide: RUNS,
    inject: [
      RUN_QUEUE,
      RUN_FACTS,
      RUN_ARCHIVES,
      RUN_LEASES,
      STATION_RUNS,
      HARNESS_COMMANDS,
    ],
    useFactory: (
      runs: RunQueuePort,
      facts: RunFactsPort,
      archives: RunArchivesPort,
      leases: RunLeasesPort,
      stations: StationRunsPort,
      commands: HarnessCommandsPort,
    ): RunsPort => new Runs(runs, facts, archives, leases, stations, commands),
  },

  {
    provide: AssistSessions,
    inject: [
      ASSIST_SESSION_REPOSITORY,
      RUNS,
      RESULT_CHECKS,
      ID_GENERATOR,
      CLOCK,
    ],
    useFactory: (
      sessions: AssistSessionRepository,
      runs: RunsPort,
      checks: ResultChecksPort,
      ids: IdGeneratorPort,
      clock: ClockPort,
    ) => new AssistSessions(sessions, runs, checks, ids, clock),
  },

  { provide: ASSIST_SESSIONS, useExisting: AssistSessions },

  { provide: ASSIST_SESSION_READER, useClass: DrizzleAssistSessionReader },

  {
    provide: AssistSessionLabels,
    inject: [ASSIST_SESSION_READER, RUNS, RUN_REQUESTER_LABELS],
    useFactory: (
      sessions: AssistSessionReaderPort,
      runs: RunsPort,
      labels: RunRequesterLabelsPort,
    ) => {
      const source = new AssistSessionLabels(sessions, runs);

      labels.register(source);

      return source;
    },
  },

  { provide: ASSIST_SESSION_LABELS, useExisting: AssistSessionLabels },

  {
    provide: ASSIST_EVENTS,
    inject: [
      PayloadTypes,
      IntegrationEventMappers,
      EventSubscribers,
      AssistSessions,
    ],
    useFactory: (
      types: PayloadTypes,
      mappers: IntegrationEventMappers,
      subscribers: EventSubscribers,
      sessions: AssistSessions,
    ) => {
      types.register('assist', ASSIST_PAYLOAD_TYPES);
      mappers.register(ASSIST_EVENT_MAPPERS);
      subscribers.register(assistSubscribers(sessions));
      return true;
    },
  },

  ...bindCommandHandler(SubmitAssistResultCommand, SubmitAssistResultHandler, [
    AssistSessions,
  ]),
];
