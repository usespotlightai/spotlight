import { AcceptDeliveryCommand } from '@integrations/application/commands/accept-delivery.command';
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
  readonly deliveredTo?: { workspaceId: string; teamId: string };
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

  // Declared before `:source`, or `w` would match as a source name.
  @Post(TEAM_DELIVERIES)
  @AllowAnonymous()
  @UseGuards(WebhookGuard)
  @ApiExcludeEndpoint()
  async deliveredToTeam(
    @Param('source') source: string,
    @Param('teamKey') teamKey: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
    @Req() request: Delivering,
    @Res() response: Answerable,
  ): Promise<void> {
    await this.take(
      source,
      { ...(request.deliveredTo ?? { workspaceId: '', teamId: '' }), teamKey },
      headers,
      body,
      request,
      response,
    );
  }

  @Post(':source')
  @AllowAnonymous()
  @UseGuards(WebhookGuard)
  @ApiExcludeEndpoint()
  async delivered(
    @Param('source') source: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
    @Req() request: Delivering,
    @Res() response: Answerable,
  ): Promise<void> {
    await this.take(
      source,
      { workspaceId: '', teamId: '', teamKey: '' },
      headers,
      body,
      request,
      response,
    );
  }

  private async take(
    source: string,
    at: { workspaceId: string; teamId: string; teamKey: string },
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
      new AcceptDeliveryCommand(source, at.workspaceId, at.teamId, at.teamKey, {
        headers,
        body,
        raw: request.rawBody ?? null,
      }),
    );

    response.status(HttpStatus.NO_CONTENT).send();
  }
}
