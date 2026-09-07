import { AcceptDeliveryCommand } from '@application/commands/accept-delivery.command';
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
import { AllowAnonymous } from '@presentation/http/decorators/allow-anonymous.decorator';
import { WebhookGuard } from '@presentation/http/guards/webhook.guard';

interface Delivering {
  readonly rawBody?: Uint8Array;
  /** Put there by the guard, which had to resolve the team anyway. */
  readonly deliveredTo?: { workspaceId: string; teamId: string };
  /** A handshake the guard already answered from the delivery, when the host asks. */
  readonly answered?: string | null;
}

/** Only what setting a status and body needs, typed structurally. */
interface Answerable {
  status(code: number): Answerable;
  send(body?: string): void;
}

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly commandBus: CommandBus) {}

  /**
   * A host one team told Spotlight about. Declared in its workspace's
   * repository under that team's own directory, and reachable only at its
   * own door, so whose word this is was settled by the address rather than
   * by reading the delivery.
   *
   * Declared before the shared door below, because `w` would otherwise read
   * as the name of a source.
   */
  @Post('w/:slug/t/:teamKey/:source')
  @AllowAnonymous()
  @UseGuards(WebhookGuard)
  @ApiExcludeEndpoint()
  async deliveredToTeam(
    @Param('source') source: string,
    @Param('teamKey') teamKey: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
    @Req() request: Delivering,
    @Res({ passthrough: true }) response: Answerable,
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

  // No session: a host has none. The signature is what stands in for one,
  // and the guard has already had the source check it.
  @Post(':source')
  @AllowAnonymous()
  @UseGuards(WebhookGuard)
  @ApiExcludeEndpoint()
  async delivered(
    @Param('source') source: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
    @Req() request: Delivering,
    @Res({ passthrough: true }) response: Answerable,
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

  /**
   * A handshake is echoed at once; anything else is taken in and nothing more —
   * what it means is the source's to say, once the host has been answered.
   */
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
