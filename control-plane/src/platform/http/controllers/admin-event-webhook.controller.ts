import {
  BadRequestException,
  Body,
  ConflictException,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { EventDelivery } from '@platform/events/event-delivery';
import { EventSubscribers } from '@platform/events/event-subscribers';
import {
  EVENT_WEBHOOK_RETRY_HOURS,
  EVENT_WEBHOOK_SUBSCRIBER,
} from '@platform/events/event-webhook';
import { AdminController } from '@platform/http/decorators/admin-controller.decorator';
import { EventWebhookRedeliveryRequestDto } from '@platform/http/dto/event-webhook-redelivery.request.dto';
import { EventWebhookRedeliveryResponseDto } from '@platform/http/dto/event-webhook-redelivery.response.dto';
import { isoTimeOf } from '@platform/http/iso-time';

const UNSET =
  'Sorry, this deployment sends no events to an event webhook. Set SPOTLIGHT_EVENT_WEBHOOK_URL and SPOTLIGHT_EVENT_WEBHOOK_SECRET to send them.';

const sinceOf = (raw: unknown): Date => {
  if (typeof raw !== 'string') {
    throw new BadRequestException(
      'Sorry, the body must give since as an ISO 8601 time, as in {"since": "2026-11-01T00:00:00Z"}.',
    );
  }

  return isoTimeOf('since', raw);
};

// The deployment event webhook, which SPOTLIGHT_EVENT_WEBHOOK_URL sets.
@AdminController('event-webhook')
export class AdminEventWebhookController {
  constructor(
    private readonly subscribers: EventSubscribers,
    private readonly delivery: EventDelivery,
  ) {}

  @Post('redeliver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'redeliverEventWebhook',
    summary: 'Send the dead letters of the event webhook again',
    description: `Spotlight tries to send each event to the event webhook for about ${EVENT_WEBHOOK_RETRY_HOURS} hours. Then the delivery is a dead letter. This queues the dead letters of the events recorded at or after since again, and each gets all its attempts again. Only the dead letters of the kinds that SPOTLIGHT_EVENT_WEBHOOK_KINDS still names go again.`,
  })
  @ApiBody({ type: EventWebhookRedeliveryRequestDto })
  @ApiOkResponse({ type: EventWebhookRedeliveryResponseDto })
  @ApiBadRequestResponse({
    description: 'A body without since as an ISO 8601 time',
  })
  @ApiConflictResponse({
    description: 'This deployment sets no event webhook',
  })
  @ApiNotFoundResponse({ description: 'No admin token is set' })
  async redeliver(
    @Body() body: EventWebhookRedeliveryRequestDto | undefined,
  ): Promise<EventWebhookRedeliveryResponseDto> {
    if (!this.subscribers.named(EVENT_WEBHOOK_SUBSCRIBER)) {
      throw new ConflictException(UNSET);
    }

    return new EventWebhookRedeliveryResponseDto(
      await this.delivery.redeliver(
        EVENT_WEBHOOK_SUBSCRIBER,
        sinceOf(body?.since),
      ),
    );
  }
}
