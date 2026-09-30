import {
  WORKSPACE_ACCESS,
  type WorkspaceAccessPort,
} from '@identity/application/ports/workspace-access.port';
import type { Provider, Type } from '@nestjs/common';
import {
  PEOPLE,
  type PeoplePort,
} from '@outcomes/application/ports/people.port';
import { WORK, type WorkPort } from '@outcomes/application/ports/work.port';
import { ListStationOutcomesHandler } from '@outcomes/application/queries/handlers/list-station-outcomes.handler';
import { ListStationOutcomesQuery } from '@outcomes/application/queries/list-station-outcomes.query';
import { ForgetOutcomes } from '@outcomes/application/services/forget-outcomes.service';
import { NoteChangeChecked } from '@outcomes/application/services/note-change-checked.service';
import { NotePersonAct } from '@outcomes/application/services/note-person-act.service';
import { NotePullRequestClosed } from '@outcomes/application/services/note-pull-request-closed.service';
import { NotePullRequestOpened } from '@outcomes/application/services/note-pull-request-opened.service';
import { NoteRunEnded } from '@outcomes/application/services/note-run-ended.service';
import { NoteRunSuperseded } from '@outcomes/application/services/note-run-superseded.service';
import { OutcomesAccess } from '@outcomes/application/services/outcomes-access.service';
import { RunOutcomes } from '@outcomes/application/services/run-outcomes.service';
import { OUTCOMES_EVENT_TYPES } from '@outcomes/domain/event-types';
import { People } from '@outcomes/infrastructure/acl/people.adapter';
import { Work } from '@outcomes/infrastructure/acl/work.adapter';
import { DrizzleRunRecordRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/run-record.repository';
import { DrizzleTaskDeliveryRepository } from '@outcomes/infrastructure/persistence/drizzle/repositories/task-delivery.repository';
import { outcomesSubscribers } from '@outcomes/presentation/events/outcomes.subscribers';
import { StationOutcomesController } from '@outcomes/presentation/http/controllers/station-outcomes.controller';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { EventTypes } from '@platform/events/event-types';
import {
  TRANSACTION,
  type TransactionPort,
} from '@shared-kernel/application/ports/transaction.port';
import { RUN_OUTCOMES } from '@work/application/ports/run-outcomes.port';
import {
  STATION_RUNS,
  type StationRunsPort,
} from '@work/application/ports/station-runs.port';

const OUTCOMES_EVENTS = Symbol('OUTCOMES_EVENTS');

export const OUTCOMES_CONTROLLERS: readonly Type[] = [
  StationOutcomesController,
];

export const OUTCOMES_PROVIDERS: readonly Provider[] = [
  {
    provide: WORK,
    inject: [STATION_RUNS],
    useFactory: (stations: StationRunsPort) => new Work(stations),
  },
  {
    provide: PEOPLE,
    inject: [WORKSPACE_ACCESS],
    useFactory: (access: WorkspaceAccessPort) => new People(access),
  },
  DrizzleRunRecordRepository,
  DrizzleTaskDeliveryRepository,
  {
    provide: OutcomesAccess,
    inject: [PEOPLE],
    useFactory: (people: PeoplePort) => new OutcomesAccess(people),
  },
  {
    provide: RUN_OUTCOMES,
    inject: [DrizzleRunRecordRepository, DrizzleTaskDeliveryRepository],
    useFactory: (
      records: DrizzleRunRecordRepository,
      deliveries: DrizzleTaskDeliveryRepository,
    ) => new RunOutcomes(records, deliveries),
  },
  ...bindQueryHandler(ListStationOutcomesQuery, ListStationOutcomesHandler, [
    OutcomesAccess,
    DrizzleRunRecordRepository,
    DrizzleTaskDeliveryRepository,
    WORK,
  ]),
  {
    provide: NoteRunEnded,
    inject: [WORK, DrizzleRunRecordRepository, TRANSACTION],
    useFactory: (
      work: WorkPort,
      records: DrizzleRunRecordRepository,
      transaction: TransactionPort,
    ) => new NoteRunEnded(work, records, transaction),
  },
  {
    provide: NoteRunSuperseded,
    inject: [DrizzleRunRecordRepository, TRANSACTION],
    useFactory: (
      records: DrizzleRunRecordRepository,
      transaction: TransactionPort,
    ) => new NoteRunSuperseded(records, transaction),
  },
  {
    provide: NoteChangeChecked,
    inject: [DrizzleRunRecordRepository, TRANSACTION],
    useFactory: (
      records: DrizzleRunRecordRepository,
      transaction: TransactionPort,
    ) => new NoteChangeChecked(records, transaction),
  },
  {
    provide: NotePersonAct,
    inject: [DrizzleRunRecordRepository, TRANSACTION],
    useFactory: (
      records: DrizzleRunRecordRepository,
      transaction: TransactionPort,
    ) => new NotePersonAct(records, transaction),
  },
  {
    provide: NotePullRequestOpened,
    inject: [DrizzleTaskDeliveryRepository, TRANSACTION],
    useFactory: (
      deliveries: DrizzleTaskDeliveryRepository,
      transaction: TransactionPort,
    ) => new NotePullRequestOpened(deliveries, transaction),
  },
  {
    provide: NotePullRequestClosed,
    inject: [DrizzleTaskDeliveryRepository, TRANSACTION],
    useFactory: (
      deliveries: DrizzleTaskDeliveryRepository,
      transaction: TransactionPort,
    ) => new NotePullRequestClosed(deliveries, transaction),
  },
  {
    provide: ForgetOutcomes,
    inject: [DrizzleRunRecordRepository, DrizzleTaskDeliveryRepository],
    useFactory: (
      records: DrizzleRunRecordRepository,
      deliveries: DrizzleTaskDeliveryRepository,
    ) => new ForgetOutcomes(records, deliveries),
  },
  {
    provide: OUTCOMES_EVENTS,
    inject: [
      EventTypes,
      EventSubscribers,
      NoteRunEnded,
      NoteRunSuperseded,
      NoteChangeChecked,
      NotePersonAct,
      NotePullRequestOpened,
      NotePullRequestClosed,
      ForgetOutcomes,
    ],
    useFactory: (
      types: EventTypes,
      subscribers: EventSubscribers,
      ending: NoteRunEnded,
      superseding: NoteRunSuperseded,
      checking: NoteChangeChecked,
      acting: NotePersonAct,
      opening: NotePullRequestOpened,
      closing: NotePullRequestClosed,
      forgetting: ForgetOutcomes,
    ) => {
      types.register('outcomes', OUTCOMES_EVENT_TYPES);
      subscribers.register(
        outcomesSubscribers({
          ending,
          superseding,
          checking,
          acting,
          opening,
          closing,
          forgetting,
        }),
      );
      return true;
    },
  },
];
