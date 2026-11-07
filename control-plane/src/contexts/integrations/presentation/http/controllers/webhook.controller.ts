import {
  AcceptDeliveryCommand,
  type DeliveryAddress,
} from '@integrations/application/commands/accept-delivery.command';
import type { DeliveryReceipt } from '@integrations/application/dto/delivery-receipt.dto';
import {
  Body,
  Controller,
  Headers,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { CAUSE_HEADER } from '@platform/http/cause-header';
import { AcceptsLargeBody } from '@platform/http/decorators/accepts-large-body.decorator';
import { AllowAnonymous } from '@platform/http/decorators/allow-anonymous.decorator';

type DeliveryHeaders = Record<string, string | string[] | undefined>;

interface Delivering {
  readonly rawBody?: Uint8Array;
}

interface Answerable {
  status(code: number): Answerable;
  send(body?: string): void;
}

const causeIn = (headers: DeliveryHeaders): string | null => {
  const named = headers[CAUSE_HEADER];
  const cause = Array.isArray(named) ? named[0] : named;

  return cause?.trim() || null;
};

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly commandBus: CommandBus) {}

  // Keep this route before `:integration`. If not, `w` matches as an integration name.
  @AcceptsLargeBody()
  @Post('w/:slug/t/:teamKey/:integration')
  @AllowAnonymous()
  @ApiExcludeEndpoint()
  async deliveredToTeam(
    @Param('slug') slug: string,
    @Param('teamKey') teamKey: string,
    @Param('integration') integration: string,
    @Headers() headers: DeliveryHeaders,
    @Body() body: unknown,
    @Req() request: Delivering,
    @Res() response: Answerable,
  ): Promise<void> {
    await this.take(
      integration,
      { slug, teamKey },
      headers,
      body,
      request,
      response,
    );
  }

  @AcceptsLargeBody()
  @Post(':integration')
  @AllowAnonymous()
  @ApiExcludeEndpoint()
  async delivered(
    @Param('integration') integration: string,
    @Headers() headers: DeliveryHeaders,
    @Body() body: unknown,
    @Req() request: Delivering,
    @Res() response: Answerable,
  ): Promise<void> {
    await this.take(integration, null, headers, body, request, response);
  }

  private async take(
    integration: string,
    addressedTo: DeliveryAddress | null,
    headers: DeliveryHeaders,
    body: unknown,
    request: Delivering,
    response: Answerable,
  ): Promise<void> {
    const receipt: DeliveryReceipt = await this.commandBus.execute(
      new AcceptDeliveryCommand(
        integration,
        addressedTo,
        { headers, body, raw: request.rawBody ?? null },
        causeIn(headers),
      ),
    );

    if (receipt.kind === 'refused') {
      throw new UnauthorizedException();
    }

    if (receipt.kind === 'answered') {
      response.status(HttpStatus.OK).send(receipt.body);
      return;
    }

    response.status(HttpStatus.NO_CONTENT).send();
  }
}
