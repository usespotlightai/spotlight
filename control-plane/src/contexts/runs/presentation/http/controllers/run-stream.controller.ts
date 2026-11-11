import {
  Controller,
  Headers,
  type MessageEvent,
  NotFoundException,
  Param,
  Query,
  Sse,
} from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import { WatchRunStream } from '@runs/application/services/watch-run-stream.service';
import {
  cursorOf,
  eventIdOf,
  StreamMark,
} from '@runs/presentation/http/streaming/stream-mark';
import { interval, map, merge, Observable } from 'rxjs';

const KEEPALIVE_MS = 20_000;

@ApiTags('runs')
@Controller('runs')
export class RunStreamController {
  constructor(private readonly watching: WatchRunStream) {}

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
    const watch = await this.watching.open(runId, user.id);

    if (!watch) {
      throw new NotFoundException();
    }

    const cursor = cursorOf(lastEventId ?? from, watch.attempt);

    const journal = new Observable<MessageEvent>((subscriber) => {
      const mark = new StreamMark(cursor);

      return watch.follow(
        cursor,
        (entry) => {
          if (mark.accepts(entry)) {
            const id = eventIdOf(entry);
            subscriber.next(id ? { id, data: entry } : { data: entry });
          }
        },
        (error) => subscriber.error(error),
      );
    });

    const keepalive = interval(KEEPALIVE_MS).pipe(
      map((): MessageEvent => ({ type: 'keepalive', data: '' })),
    );

    return merge(journal, keepalive);
  }
}
