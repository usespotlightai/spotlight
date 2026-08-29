import type { InboxItemDto } from '@application/dto/inbox.dto';
import { ListInboxQuery } from '@application/queries/list-inbox.query';
import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@application/ports/session.port';
import { CurrentUser } from '@presentation/http/decorators/current-user.decorator';
import { InboxItemResponseDto } from '@presentation/http/dto/inbox.response.dto';
import { TaskNoteResponseDto } from '@presentation/http/dto/task.response.dto';

@ApiTags('inbox')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('workspaces/:slug/inbox')
export class InboxController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  @ApiOperation({
    operationId: 'listInbox',
    summary: 'The tasks waiting on a person, oldest first',
  })
  @ApiParam({ name: 'slug', example: 'acme' })
  @ApiOkResponse({ type: InboxItemResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  async list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<InboxItemResponseDto[]> {
    const waiting = await this.queryBus.execute<
      ListInboxQuery,
      InboxItemDto[] | null
    >(new ListInboxQuery(slug, user.id));

    if (!waiting) {
      throw new NotFoundException();
    }

    return waiting.map(
      (item) =>
        new InboxItemResponseDto(
          item.taskId,
          item.teamId,
          item.title,
          item.description,
          item.station,
          item.stationColor,
          item.askedAt,
          item.notes.map(
            (note) =>
              new TaskNoteResponseDto(note.position, note.station, note.body),
          ),
        ),
    );
  }
}
