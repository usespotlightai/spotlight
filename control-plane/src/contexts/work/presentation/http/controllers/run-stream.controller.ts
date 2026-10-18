import {
  Controller,
  Headers,
  Inject,
  type MessageEvent,
  NotFoundException,
  Param,
  Query,
  Sse,
} from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';
import type { RunWatchDto } from '@work/application/dto/run-watch.dto';
import {
  RUN_STREAM,
  type RunEventView,
  type RunStreamPort,
} from '@work/application/ports/run-stream.port';
import { ReadRunEventsQuery } from '@work/application/queries/read-run-events.query';
import { WatchRunQuery } from '@work/application/queries/watch-run.query';
import {
  cursorOf,
  eventIdOf,
  StreamMark,
} from '@work/presentation/http/streaming/stream-mark';
import { interval, map, merge, Observable } from 'rxjs';

const KEEPALIVE_MS = 20_000;

@ApiTags('runs')
@Controller('runs')
export class RunStreamController {
  constructor(
    private readonly queryBus: QueryBus,
    @Inject(RUN_STREAM) private readonly stream: RunStreamPort,
  ) {}

  @Sse(':runId/stream')
  @ApiOperation({
    operationId: 'streamRun',
    summary: 'Watch a run’s journal, catching up on what was missed first',
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
    const watching = await this.queryBus.execute<
      WatchRunQuery,
      RunWatchDto | null
    >(new WatchRunQuery(runId, user.id));

    if (!watching) {
      throw new NotFoundException();
    }

    const cursor = cursorOf(lastEventId ?? from, watching.attempt);

    const journal = new Observable<MessageEvent>((subscriber) => {
      const mark = new StreamMark(cursor);
      let buffered: RunEventView[] = [];
      let replaying = true;

      const emit = (event: RunEventView) => {
        if (mark.accepts(event)) {
          const id = eventIdOf(event);
          subscriber.next(id ? { id, data: event } : { data: event });
        }
      };

      // Subscribe before you read the backlog, so that no event is lost between the two.
      const detach = this.stream.subscribe(runId, (event) => {
        if (replaying) {
          buffered.push(event);
          return;
        }
        emit(event);
      });

      this.queryBus
        .execute<ReadRunEventsQuery, RunEventView[]>(
          new ReadRunEventsQuery(runId, cursor.attempt, cursor.seq),
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
}
