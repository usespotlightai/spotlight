import { WORKSPACE_ACCESS } from '@identity/application/ports/workspace-access.port';
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
  NOTIFICATION_STREAM,
  type NotificationStreamPort,
} from '@notifications/application/ports/notification-stream.port';
import {
  WEB_PUSH,
  type WebPushPort,
} from '@notifications/application/ports/web-push.port';
import { GetPushKeyQuery } from '@notifications/application/queries/get-push-key.query';
import { GetPushKeyHandler } from '@notifications/application/queries/handlers/get-push-key.handler';
import { WatchedWorkspacesHandler } from '@notifications/application/queries/handlers/watched-workspaces.handler';
import { WatchedWorkspacesQuery } from '@notifications/application/queries/watched-workspaces.query';
import { ArrivalDeliveries } from '@notifications/application/services/arrival-deliveries.service';
import {
  PUSH_SUBSCRIPTION_REPOSITORY,
  type PushSubscriptionRepository,
} from '@notifications/domain/repositories/push-subscription.repository';
import { DrizzlePushSubscriptionRepository } from '@notifications/infrastructure/persistence/drizzle/repositories/push-subscription.repository';
import {
  pushServiceGuard,
  VapidWebPush,
} from '@notifications/infrastructure/push/vapid-web-push';
import { LiveNotificationStream } from '@notifications/infrastructure/streaming/live-notification-stream';
import { notificationsSubscribers } from '@notifications/presentation/events/notifications.subscribers';
import { LiveController } from '@notifications/presentation/http/controllers/live.controller';
import { NotificationsController } from '@notifications/presentation/http/controllers/notifications.controller';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { bindCommandHandler } from '@platform/cqrs/bind-command-handler';
import { bindQueryHandler } from '@platform/cqrs/bind-query-handler';
import { EventSubscribers } from '@platform/events/event-subscribers';
import { LIVE_FEED, type LiveFeedPort } from '@platform/live/live-feed.port';
import type { OutboundGuard } from '@platform/outbound/outbound-guard';
import { CLOCK } from '@shared-kernel/application/ports/clock.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';

const NOTIFICATIONS_EVENTS = Symbol('NOTIFICATIONS_EVENTS');
const PUSH_SERVICE_GUARD = Symbol('PUSH_SERVICE_GUARD');

export const NOTIFICATIONS_CONTROLLERS: readonly Type[] = [
  NotificationsController,
  LiveController,
];

export const NOTIFICATIONS_PROVIDERS: readonly Provider[] = [
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
      LOGGER,
    ],
    useFactory: (
      stream: NotificationStreamPort,
      push: WebPushPort,
      subscriptions: PushSubscriptionRepository,
      workspaces: WorkspaceReaderPort,
      logger: LoggerPort,
    ) => new ArrivalDeliveries(stream, push, subscriptions, workspaces, logger),
  },

  {
    provide: NOTIFICATIONS_EVENTS,
    inject: [EventSubscribers, ArrivalDeliveries],
    useFactory: (
      subscribers: EventSubscribers,
      deliveries: ArrivalDeliveries,
    ) => {
      subscribers.register(notificationsSubscribers(deliveries));
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

  ...bindQueryHandler(WatchedWorkspacesQuery, WatchedWorkspacesHandler, [
    WORKSPACE_READER,
    WORKSPACE_ACCESS,
  ]),
];
