import { Controller, type MessageEvent, Sse } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { WatchedWorkspacesQuery } from '@notifications/application/queries/watched-workspaces.query';
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import { personChannel, workspaceChannel } from '@platform/live/live-feed.port';
import { LiveStreams } from '@platform/live/live-streams';
import type { Observable } from 'rxjs';

@ApiTags('notifications')
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
    summary: 'Watch for changes in your workspaces and new inbox items',
    description:
      'Sends "ready" first, then "changed" with a topic and ids for each change in a workspace you may view, and "notification" for each new item in your inbox. "resync" means some changes were missed: fetch everything again. The server closes the stream after about 10 minutes. Missed events are not sent again.',
  })
  @ApiProduces('text/event-stream')
  @ApiOkResponse({ description: 'Server-sent events' })
  async watch(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Observable<MessageEvent>> {
    const workspaces = await this.queryBus.execute<
      WatchedWorkspacesQuery,
      readonly string[]
    >(new WatchedWorkspacesQuery(user.id));

    return this.streams.open([
      personChannel(user.id),
      ...workspaces.map(workspaceChannel),
    ]);
  }
}
