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

  // Keep this route before `:integration`. If not, `w` matches as an integration name.
  @Post(TEAM_DELIVERIES)
  @AllowAnonymous()
  @UseGuards(WebhookGuard)
  @ApiExcludeEndpoint()
  async deliveredToTeam(
    @Param('integration') integration: string,
    @Param('teamKey') teamKey: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
    @Req() request: Delivering,
    @Res() response: Answerable,
  ): Promise<void> {
    await this.take(
      integration,
      { ...(request.deliveredTo ?? { workspaceId: '', teamId: '' }), teamKey },
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
    await this.take(
      integration,
      { workspaceId: '', teamId: '', teamKey: '' },
      headers,
      body,
      request,
      response,
    );
  }

  private async take(
    integration: string,
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
      new AcceptDeliveryCommand(
        integration,
        at.workspaceId,
        at.teamId,
        at.teamKey,
        {
          headers,
          body,
          raw: request.rawBody ?? null,
        },
      ),
    );

    response.status(HttpStatus.NO_CONTENT).send();
  }
}
