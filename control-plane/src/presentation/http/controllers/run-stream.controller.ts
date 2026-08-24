import {
  AwaitRunInputCommand,
  SendRunInputCommand,
  StopRunCommand,
} from '@application/commands/run-input.commands';
import type { RunWatchDto } from '@application/dto/run-watch.dto';
import type { RunInput } from '@application/ports/run-input.port';
import {
  RUN_STREAM,
  type RunEventView,
  type RunStreamPort,
} from '@application/ports/run-stream.port';
import type { AuthenticatedUser } from '@application/ports/session.port';
import { ReadRunEventsQuery } from '@application/queries/read-run-events.query';
import { WatchRunQuery } from '@application/queries/watch-run.query';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  type MessageEvent,
  NotFoundException,
  Param,
  Post,
  Query,
  Sse,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentRunner } from '@presentation/http/decorators/current-runner.decorator';
import { CurrentUser } from '@presentation/http/decorators/current-user.decorator';
import { RunnerOnly } from '@presentation/http/decorators/runner-only.decorator';
import { SendRunInputRequestDto } from '@presentation/http/dto/run-input.request.dto';
import {
  PendingRunInputResponseDto,
  RunInputResponseDto,
} from '@presentation/http/dto/run-input.response.dto';
import { interval, map, merge, Observable } from 'rxjs';

const KEEPALIVE_MS = 20_000;

@ApiTags('runs')
@Controller('runs')
export class RunStreamController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
    @Inject(RUN_STREAM) private readonly stream: RunStreamPort,
  ) {}

  @Sse(':runId/stream')
  @ApiOperation({
    operationId: 'streamRun',
    summary: 'Watch a run’s terminal, catching up on what was missed first',
  })
  @ApiParam({ name: 'runId' })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({ description: 'Server-sent events, one per journal entry' })
  @ApiNotFoundResponse({ description: 'No such run for this caller' })
  @ApiUnauthorizedResponse({ description: 'No valid session' })
  async watch(
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('last-event-id') lastEventId?: string,
    @Query('from') from?: string,
  ): Promise<Observable<MessageEvent>> {
    const cursor = sequence(lastEventId ?? from);

    const watching = await this.queryBus.execute<
      WatchRunQuery,
      RunWatchDto | null
    >(new WatchRunQuery(runId, user.id));

    if (!watching) {
      throw new NotFoundException();
    }

    const journal = new Observable<MessageEvent>((subscriber) => {
      let sent = cursor;
      let buffered: RunEventView[] = [];
      let replaying = true;

      const emit = (event: RunEventView) => {
        if (event.seq <= sent) {
          return;
        }
        sent = event.seq;
        subscriber.next({ id: String(event.seq), data: event });
      };

      // Subscribed here, and before the backlog is read: inside the
      // observable so teardown is guaranteed, and before the read so nothing
      // reported while it is in flight falls between the two.
      const detach = this.stream.subscribe(runId, (event) => {
        if (replaying) {
          buffered.push(event);
          return;
        }
        emit(event);
      });

      this.queryBus
        .execute<ReadRunEventsQuery, RunEventView[]>(
          new ReadRunEventsQuery(runId, watching.attempt, cursor),
        )
        .then((backlog) => {
          for (const event of backlog) {
            emit(event);
          }

          replaying = false;
          for (const event of buffered) {
            emit(event);
          }
          buffered = [];
        })
        .catch((error: unknown) => subscriber.error(error));

      return () => {
        detach();
        buffered = [];
      };
    });

    const keepalive = interval(KEEPALIVE_MS).pipe(
      map((): MessageEvent => ({ type: 'keepalive', data: '' })),
    );

    return merge(journal, keepalive);
  }

  @Post(':runId/input')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'sendRunInput',
    summary: 'Type at the agent, or tell it the terminal resized',
  })
  @ApiParam({ name: 'runId' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'No such run for this caller' })
  @ApiUnauthorizedResponse({ description: 'No valid session' })
  async send(
    @Param('runId') runId: string,
    @Body() body: SendRunInputRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new SendRunInputCommand(runId, user.id, {
        data: body.data,
        cols: body.cols,
        rows: body.rows,
      }),
    );
  }

  @Post(':runId/stop')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'stopRun',
    summary: 'Ask the agent to finish, as closing the terminal would',
  })
  @ApiParam({ name: 'runId' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'No such run for this caller' })
  @ApiUnauthorizedResponse({ description: 'No valid session' })
  async stop(
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(new StopRunCommand(runId, user.id));
  }

  @Get(':runId/input')
  @RunnerOnly()
  @ApiOperation({
    operationId: 'awaitRunInput',
    summary: 'Long-poll for what was typed, answering empty when nothing was',
  })
  @ApiParam({ name: 'runId' })
  @ApiOkResponse({ type: PendingRunInputResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or revoked runner token' })
  async collect(
    @Param('runId') runId: string,
    @CurrentRunner() runnerId: string,
  ): Promise<PendingRunInputResponseDto> {
    const pending = await this.commandBus.execute<
      AwaitRunInputCommand,
      RunInput[]
    >(new AwaitRunInputCommand(runId, runnerId));

    return new PendingRunInputResponseDto(
      pending.map(
        (each) =>
          new RunInputResponseDto(each.data, each.cols, each.rows, each.stop),
      ),
    );
  }
}

const sequence = (raw: string | undefined): number => {
  const parsed = Number.parseInt(raw ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};
