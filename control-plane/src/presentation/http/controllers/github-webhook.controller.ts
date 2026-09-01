import { ReactToHappeningCommand } from '@application/commands/react-to-happening.command';
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@presentation/http/decorators/allow-anonymous.decorator';
import { GitHubWebhookGuard } from '@presentation/http/guards/github-webhook.guard';

@ApiTags('webhooks')
@Controller('webhooks')
export class GitHubWebhookController {
  constructor(private readonly commandBus: CommandBus) {}

  // No session: GitHub has none. The signature is what stands in for one.
  @Post('github')
  @AllowAnonymous()
  @UseGuards(GitHubWebhookGuard)
  @ApiExcludeEndpoint()
  @HttpCode(HttpStatus.NO_CONTENT)
  async delivered(
    @Headers('x-github-event') event: string | undefined,
    @Headers('x-github-delivery') delivery: string | undefined,
    @Body() body: unknown,
  ): Promise<void> {
    // Every delivery is named by the host, so one that is not is malformed.
    if (!delivery) {
      throw new BadRequestException('x-github-delivery is missing');
    }

    await this.commandBus.execute(
      new ReactToHappeningCommand(delivery, event, body),
    );
  }
}
