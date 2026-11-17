import { WatchedWorkspacesQuery } from '@identity/application/queries/watched-workspaces.query';
import { Controller, type MessageEvent, Query, Sse } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import { personChannel, workspaceChannel } from '@platform/live/live-feed.port';
import { sinceOf } from '@platform/live/live-replay';
import { LiveStreams } from '@platform/live/live-streams';
import type { Observable } from 'rxjs';

@ApiTags('live')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('me')
export class LiveController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly streams: LiveStreams,
  ) {}

  @Sse('live')
  @ApiOperation({
    operationId: 'watchLive',
    summary: 'Watch for changes in your workspaces and messages sent to you',
    description:
      'Sends "changed" with a topic, ids, a channel and a sequence for each change in a workspace you may view, and each message other parts of Spotlight send to you, with its own event name. Sequences on one channel go up by one with no gaps. Give "since" as `<channel>@<sequence>` for each channel you applied, and the stream first sends again the changes you missed, then "ready". "ready" has "heads", the last sequence of each channel, and "complete", which is false if some missed changes could not be sent again: then fetch everything again. A gap in the sequences of one channel means a change was lost: open a new stream with "since". "changed" with the topic "workspaces" means you joined a workspace: open a new stream to watch it. "resync" means some changes were not sent: open a new stream with "since". After about 10 minutes the server sends "reopen", then closes the stream 15 seconds later: open a new stream before it closes.',
  })
  @ApiQuery({
    name: 'since',
    required: false,
    isArray: true,
    type: String,
    description:
      'The last sequence you applied on one channel, as `<channel>@<sequence>`, for example `workspace:<id>@42`',
  })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({ description: 'Server-sent events' })
  async watch(
    @CurrentUser() user: AuthenticatedUser,
    @Query('since') since?: string | string[],
  ): Promise<Observable<MessageEvent>> {
    const workspaces = await this.queryBus.execute<
      WatchedWorkspacesQuery,
      readonly string[]
    >(new WatchedWorkspacesQuery(user.id));

    const channels = [
      personChannel(user.id),
      ...workspaces.map(workspaceChannel),
    ];

    return this.streams.open(channels, sinceOf([since ?? []].flat(), channels));
  }
}
