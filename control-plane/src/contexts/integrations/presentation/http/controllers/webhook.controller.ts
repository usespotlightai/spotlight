import { AcceptDeliveryCommand } from '@integrations/application/commands/accept-delivery.command';
import type { DeliveryAddressee } from '@integrations/application/ports/delivery-queue.port';
import { WebhookGuard } from '@integrations/presentation/http/guards/webhook.guard';
import {
  Body,
  Controller,
  Headers,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';
import { TEAM_DELIVERIES, WEBHOOKS } from '@platform/http/routes';

interface Delivering {
  readonly rawBody?: Uint8Array;
  readonly deliveredTo?: DeliveryAddressee | null;
  readonly answered?: string | null;
}

interface Answerable {
  status(code: number): Answerable;
  send(body?: string): void;
}

@ApiTags('webhooks')
@Controller(WEBHOOKS)
export class WebhookController {
  constructor(private readonly commandBus: CommandBus) {}

  // Keep this route before `:integration`. If not, `w` matches as an integration name.
  @Post(TEAM_DELIVERIES)
  @AllowAnonymous()
  @UseGuards(WebhookGuard)
  @ApiExcludeEndpoint()
  async deliveredToTeam(
    @Param('integration') integration: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
    @Req() request: Delivering,
    @Res() response: Answerable,
  ): Promise<void> {
    await this.take(
      integration,
      request.deliveredTo ?? null,
      headers,
      body,
      request,
      response,
    );
  }

  @Post(':integration')
  @AllowAnonymous()
  @UseGuards(WebhookGuard)
  @ApiExcludeEndpoint()
  async delivered(
    @Param('integration') integration: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
    @Req() request: Delivering,
    @Res() response: Answerable,
  ): Promise<void> {
    await this.take(integration, null, headers, body, request, response);
  }

  private async take(
    integration: string,
    to: DeliveryAddressee | null,
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
    request: Delivering,
    response: Answerable,
  ): Promise<void> {
    if (request.answered != null) {
      response.status(HttpStatus.OK).send(request.answered);
      return;
    }

    await this.commandBus.execute(
      new AcceptDeliveryCommand(integration, to, {
        headers,
        body,
        raw: request.rawBody ?? null,
      }),
    );

    response.status(HttpStatus.NO_CONTENT).send();
  }
}
