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

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly commandBus: CommandBus) {}

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
    @Req() request: { rawBody?: Uint8Array },
  ): Promise<void> {
    // Taken in and nothing more: what any of it means is the source's to
    // say, and it is said once the host has been answered.
    await this.commandBus.execute(
      new AcceptDeliveryCommand(source, {
        headers,
        body,
        raw: request.rawBody ?? null,
      }),
    );
  }
}
