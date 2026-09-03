import { AcceptDeliveryCommand } from '@application/commands/accept-delivery.command';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
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
  @HttpCode(HttpStatus.NO_CONTENT)
  async deliveredToTeam(
    @Param('source') source: string,
    @Param('teamKey') teamKey: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
    @Req() request: Delivering,
  ): Promise<void> {
    await this.take(
      source,
      { ...(request.deliveredTo ?? { workspaceId: '', teamId: '' }), teamKey },
      headers,
      body,
      request,
    );
  }

  // No session: a host has none. The signature is what stands in for one,
  // and the guard has already had the source check it.
  @Post(':source')
  @AllowAnonymous()
  @UseGuards(WebhookGuard)
  @ApiExcludeEndpoint()
  @HttpCode(HttpStatus.NO_CONTENT)
  async delivered(
    @Param('source') source: string,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() body: unknown,
    @Req() request: Delivering,
  ): Promise<void> {
    await this.take(
      source,
      { workspaceId: '', teamId: '', teamKey: '' },
      headers,
      body,
      request,
    );
  }

  /**
   * Taken in and nothing more: what any of it means is the source's to say,
   * and it is said once the host has been answered.
   */
  private async take(
    source: string,
    at: { workspaceId: string; teamId: string; teamKey: string },
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
    request: Delivering,
  ): Promise<void> {
    await this.commandBus.execute(
      new AcceptDeliveryCommand(source, at.workspaceId, at.teamId, at.teamKey, {
        headers,
        body,
        raw: request.rawBody ?? null,
      }),
    );
  }
}
