import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  type MessageEvent,
  NotFoundException,
  Put,
  Sse,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { SubscribeToPushCommand } from '@notifications/application/commands/subscribe-to-push.command';
import { UnsubscribeFromPushCommand } from '@notifications/application/commands/unsubscribe-from-push.command';
import {
  NOTIFICATION_STREAM,
  type NotificationStreamPort,
} from '@notifications/application/ports/notification-stream.port';
import { GetPushKeyQuery } from '@notifications/application/queries/get-push-key.query';
import { PushKeyResponseDto } from '@notifications/presentation/http/dto/push-key.response.dto';
import {
  PushSubscriptionRequestDto,
  PushUnsubscriptionRequestDto,
} from '@notifications/presentation/http/dto/push-subscription.request.dto';
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import { interval, map, merge, Observable } from 'rxjs';

const KEEPALIVE_MS = 20_000;

@ApiTags('notifications')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('me')
export class NotificationsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    @Inject(NOTIFICATION_STREAM)
    private readonly stream: NotificationStreamPort,
  ) {}

  @Sse('notifications/stream')
  @ApiOperation({
    operationId: 'streamMyNotifications',
    summary: 'Watch for new items in your inbox',
    description:
      'Sends one event for each item that comes into your inbox while the stream is open. Missed events are not sent again.',
  })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({ description: 'Server-sent events, one per new item' })
  watch(@CurrentUser() user: AuthenticatedUser): Observable<MessageEvent> {
    const arrivals = new Observable<MessageEvent>((subscriber) =>
      this.stream.subscribe(user.id, (notification) =>
        subscriber.next({ type: 'notification', data: notification }),
      ),
    );

    const keepalive = interval(KEEPALIVE_MS).pipe(
      map((): MessageEvent => ({ type: 'keepalive', data: '' })),
    );

    return merge(arrivals, keepalive);
  }

  @Get('notifications/push-key')
  @ApiOperation({
    operationId: 'getPushKey',
    summary: 'Get the key that a browser subscribes to Web Push with',
  })
  @ApiOkResponse({ type: PushKeyResponseDto })
  async pushKey(): Promise<PushKeyResponseDto> {
    return {
      publicKey: await this.queryBus.execute<GetPushKeyQuery, string | null>(
        new GetPushKeyQuery(),
      ),
    };
  }

  @Put('push-subscriptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'subscribeToPush',
    summary: 'Send Web Push about new inbox items to this browser',
    description:
      'Adding the same push service address again renews it. An address that another person added moves to you.',
  })
  @ApiNoContentResponse({ description: 'This browser gets Web Push' })
  @ApiUnprocessableEntityResponse({
    description:
      'The address is not HTTPS on a known push service, or the keys are not valid',
  })
  async subscribe(
    @Body() body: PushSubscriptionRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute<SubscribeToPushCommand, void>(
      new SubscribeToPushCommand(
        user.id,
        String(body?.endpoint ?? ''),
        String(body?.keys?.p256dh ?? ''),
        String(body?.keys?.auth ?? ''),
      ),
    );
  }

  @Delete('push-subscriptions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'unsubscribeFromPush',
    summary: 'Stop sending Web Push to this browser',
  })
  @ApiNoContentResponse({ description: 'This browser gets no more Web Push' })
  @ApiNotFoundResponse({ description: 'No such push address of yours' })
  @ApiUnprocessableEntityResponse({
    description: 'The address is not HTTPS on a known push service',
  })
  async unsubscribe(
    @Body() body: PushUnsubscriptionRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const removed = await this.commandBus.execute<
      UnsubscribeFromPushCommand,
      boolean
    >(new UnsubscribeFromPushCommand(user.id, String(body?.endpoint ?? '')));

    if (!removed) {
      throw new NotFoundException();
    }
  }
}
