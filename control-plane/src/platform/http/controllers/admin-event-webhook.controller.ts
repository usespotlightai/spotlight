import {
  BadRequestException,
  Body,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
} from '@nestjs/swagger';
import { ENV } from '@platform/config/config.constants';
import type { Env } from '@platform/config/env.schema';
import { EventDelivery } from '@platform/events/event-delivery';
import { EVENT_WEBHOOK_SUBSCRIBER } from '@platform/events/event-webhook';
import { AdminController } from '@platform/http/decorators/admin-controller.decorator';
import { EventWebhookRedeliveryRequestDto } from '@platform/http/dto/event-webhook-redelivery.request.dto';
import { EventWebhookRedeliveryResponseDto } from '@platform/http/dto/event-webhook-redelivery.response.dto';
import { isoTimeOf } from '@platform/http/iso-time';

const sinceOf = (raw: unknown): Date => {
  if (typeof raw !== 'string') {
    throw new BadRequestException(
      'Sorry, the body must give since as an ISO 8601 time, as in {"since": "2026-11-01T00:00:00Z"}.',
    );
  }

  return isoTimeOf('since', raw);
};

// The deployment event webhook, which SPOTLIGHT_EVENTS_URL sets.
@AdminController('event-webhook')
export class AdminEventWebhookController {
  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly delivery: EventDelivery,
  ) {}

  @Post('redeliver')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'redeliverEventWebhook',
    summary: 'Send the dead letters of the event webhook again',
    description:
      'Spotlight tries to send each event to the event webhook for about 13 hours. Then the delivery is a dead letter. This queues the dead letters of the events recorded at or after since again, and each gets all its attempts again. Spotlight deletes an event 7 days after it recorded it, but only when it is delivered, so a dead letter stays until it is delivered.',
  })
  @ApiBody({ type: EventWebhookRedeliveryRequestDto })
  @ApiOkResponse({ type: EventWebhookRedeliveryResponseDto })
  @ApiBadRequestResponse({
    description: 'A body without since as an ISO 8601 time',
  })
  @ApiNotFoundResponse({
    description: 'No event webhook is set, or no admin token is set',
  })
  async redeliver(
    @Body() body: EventWebhookRedeliveryRequestDto | undefined,
  ): Promise<EventWebhookRedeliveryResponseDto> {
    if (!this.env.SPOTLIGHT_EVENTS_URL) {
      throw new NotFoundException(
        'Sorry, this deployment sends no events. Set SPOTLIGHT_EVENTS_URL and SPOTLIGHT_EVENTS_SECRET to send them.',
      );
    }

    return new EventWebhookRedeliveryResponseDto(
      await this.delivery.redeliver(
        EVENT_WEBHOOK_SUBSCRIBER,
        sinceOf(body?.since),
      ),
    );
  }
}
