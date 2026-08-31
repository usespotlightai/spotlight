import { CompleteMergedTaskCommand } from '@application/commands/complete-merged-task.command';
import {
  REPOSITORY_EVENTS,
  type RepositoryEventsPort,
} from '@application/ports/repository-events.port';
import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { ApiExcludeEndpoint, ApiTags } from '@nestjs/swagger';
import { AllowAnonymous } from '@presentation/http/decorators/allow-anonymous.decorator';
import { GitHubWebhookGuard } from '@presentation/http/guards/github-webhook.guard';

@ApiTags('github')
@Controller('github')
export class GitHubWebhookController {
  constructor(
    private readonly commandBus: CommandBus,
    @Inject(REPOSITORY_EVENTS)
    private readonly events: RepositoryEventsPort,
  ) {}

  @Post('webhook')
  @AllowAnonymous()
  @UseGuards(GitHubWebhookGuard)
  @ApiExcludeEndpoint()
  @HttpCode(HttpStatus.NO_CONTENT)
  async delivered(
    @Headers('x-github-event') event: string | undefined,
    @Body() body: unknown,
  ): Promise<void> {
    const merged = this.events.merged(event, body);

    if (!merged) {
      return;
    }

    await this.commandBus.execute(new CompleteMergedTaskCommand(merged.url));
  }
}
