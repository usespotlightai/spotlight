import {
  WORKSPACE_READER,
  type WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import type { Provider, Type } from '@nestjs/common';
import { SubscribeToPushHandler } from '@notifications/application/commands/handlers/subscribe-to-push.handler';
import { UnsubscribeFromPushHandler } from '@notifications/application/commands/handlers/unsubscribe-from-push.handler';
import { SubscribeToPushCommand } from '@notifications/application/commands/subscribe-to-push.command';
import { UnsubscribeFromPushCommand } from '@notifications/application/commands/unsubscribe-from-push.command';
import {
  INBOX_LINKS,
  type InboxLinksPort,
} from '@notifications/application/ports/inbox-links.port';
import {
  NOTIFICATION_STREAM,
  type NotificationStreamPort,
} from '@notifications/application/ports/notification-stream.port';
import {
  WEB_PUSH,
  type WebPushPort,
} from '@notifications/application/ports/web-push.port';
import { GetPushKeyQuery } from '@notifications/application/queries/get-push-key.query';
import { GetPushKeyHandler } from '@notifications/application/queries/handlers/get-push-key.handler';
import { ArrivalDeliveries } from '@notifications/application/services/arrival-deliveries.service';
import { ArrivalRecounts } from '@notifications/application/services/arrival-recounts.service';
import {
  ARRIVAL_LEDGER_REPOSITORY,
  type ArrivalLedgerRepository,
} from '@notifications/domain/repositories/arrival-ledger.repository';
import {
  PUSH_SUBSCRIPTION_REPOSITORY,
  type PushSubscriptionRepository,
} from '@notifications/domain/repositories/push-subscription.repository';
import { NOTIFICATIONS_PAYLOAD_TYPES } from '@notifications/infrastructure/events/notifications-payload-types';
import { WebInboxLinks } from '@notifications/infrastructure/links/web-inbox-links';
import { DrizzleArrivalLedgerRepository } from '@notifications/infrastructure/persistence/drizzle/repositories/arrival-ledger.repository';
import { DrizzlePushSubscriptionRepository } from '@notifications/infrastructure/persistence/drizzle/repositories/push-subscription.repository';
import {
  pushServiceGuard,
  VapidWebPush,
} from '@notifications/infrastructure/push/vapid-web-push';
import { LiveNotificationStream } from '@notifications/infrastructure/streaming/live-notification-stream';
import { notificationsSubscribers } from '@notifications/presentation/events/notifications.subscribers';
import { NotificationsController } from '@notifications/presentation/http/controllers/notifications.controller';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { PayloadTypes } from '@platform/events/payload-types';
import { LIVE_FEED, type LiveFeedPort } from '@platform/live/live-feed.port';
import type { OutboundGuard } from '@platform/outbound/outbound-guard';
import { PendingJobWorker } from '@platform/workers/pending-job.worker';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import {
  ERROR_REPORTS,
  type ErrorReportsPort,
} from '@shared-kernel/application/ports/error-reports.port';
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
import {
  MEMBER_INBOXES,
  type MemberInboxesPort,
} from '@work/application/ports/member-inboxes.port';

const NOTIFICATIONS_EVENTS = Symbol('NOTIFICATIONS_EVENTS');
const PUSH_SERVICE_GUARD = Symbol('PUSH_SERVICE_GUARD');

export const NOTIFICATIONS_CONTROLLERS: readonly Type[] = [
  NotificationsController,
];

export const NOTIFICATIONS_PROVIDERS: readonly Provider[] = [
  {
    provide: ARRIVAL_LEDGER_REPOSITORY,
    useClass: DrizzleArrivalLedgerRepository,
  },

  {
    provide: ArrivalRecounts,
    inject: [
      ARRIVAL_LEDGER_REPOSITORY,
      MEMBER_INBOXES,
      CLOCK,
      TRANSACTION,
      LOGGER,
      ERROR_REPORTS,
      TELEMETRY,
    ],
    useFactory: (
      ledgers: ArrivalLedgerRepository,
      inboxes: MemberInboxesPort,
      clock: ClockPort,
      transaction: TransactionPort,
      logger: LoggerPort,
      reports: ErrorReportsPort,
      telemetry: TelemetryPort,
    ) =>
      new ArrivalRecounts(
        ledgers,
        inboxes,
        clock,
        transaction,
        logger,
        reports,
        telemetry,
      ),
  },

  {
    provide: PendingJobWorker,
    inject: [ArrivalRecounts, LOGGER],
    useFactory: (recounts: ArrivalRecounts, logger: LoggerPort) =>
      new PendingJobWorker([recounts], logger),
  },

  { provide: INBOX_LINKS, useClass: WebInboxLinks },

  {
    provide: PUSH_SUBSCRIPTION_REPOSITORY,
    useClass: DrizzlePushSubscriptionRepository,
  },

  {
    provide: NOTIFICATION_STREAM,
    inject: [LIVE_FEED],
    useFactory: (feed: LiveFeedPort): NotificationStreamPort =>
      new LiveNotificationStream(feed),
  },

  { provide: PUSH_SERVICE_GUARD, useFactory: pushServiceGuard },

  {
    provide: WEB_PUSH,
    inject: [ENV, PUSH_SERVICE_GUARD],
    useFactory: (env: Env, guard: OutboundGuard): WebPushPort =>
      new VapidWebPush(
        env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
          ? {
              publicKey: env.VAPID_PUBLIC_KEY,
              privateKey: env.VAPID_PRIVATE_KEY,
              subject: env.VAPID_SUBJECT,
            }
          : null,
        guard,
      ),
  },

  {
    provide: ArrivalDeliveries,
    inject: [
      NOTIFICATION_STREAM,
      WEB_PUSH,
      PUSH_SUBSCRIPTION_REPOSITORY,
      WORKSPACE_READER,
      INBOX_LINKS,
      LOGGER,
    ],
    useFactory: (
      stream: NotificationStreamPort,
      push: WebPushPort,
      subscriptions: PushSubscriptionRepository,
      workspaces: WorkspaceReaderPort,
      links: InboxLinksPort,
      logger: LoggerPort,
    ) =>
      new ArrivalDeliveries(
        stream,
        push,
        subscriptions,
        workspaces,
        links,
        logger,
      ),
  },

  {
    provide: NOTIFICATIONS_EVENTS,
    inject: [
      PayloadTypes,
      EventSubscribers,
      ArrivalRecounts,
      ArrivalDeliveries,
    ],
    useFactory: (
      types: PayloadTypes,
      subscribers: EventSubscribers,
      recounts: ArrivalRecounts,
      deliveries: ArrivalDeliveries,
    ) => {
      types.register('notifications', NOTIFICATIONS_PAYLOAD_TYPES);
      subscribers.register(notificationsSubscribers(recounts, deliveries));
      return true;
    },
  },

  ...bindCommandHandler(SubscribeToPushCommand, SubscribeToPushHandler, [
    PUSH_SUBSCRIPTION_REPOSITORY,
    CLOCK,
  ]),

  ...bindCommandHandler(
    UnsubscribeFromPushCommand,
    UnsubscribeFromPushHandler,
    [PUSH_SUBSCRIPTION_REPOSITORY],
  ),

  ...bindQueryHandler(GetPushKeyQuery, GetPushKeyHandler, [WEB_PUSH]),
];
