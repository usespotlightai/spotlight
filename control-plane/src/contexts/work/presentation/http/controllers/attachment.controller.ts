import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiCreatedResponse,
  ApiFoundResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';
import { GrantAttachmentUploadCommand } from '@work/application/commands/grant-attachment-upload.command';
import type { AttachmentUploadDto } from '@work/application/dto/attachment.dto';
import { ReadAttachmentQuery } from '@work/application/queries/read-attachment.query';
import { GrantAttachmentUploadRequestDto } from '@work/presentation/http/dto/attachment.request.dto';
import { AttachmentUploadResponseDto } from '@work/presentation/http/dto/attachment.response.dto';

interface Redirectable {
  redirect(url: string): void;
}

@ApiTags('attachments')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({ name: 'slug', type: String, example: 'acme' })
@Controller('workspaces/:slug/attachments')
export class AttachmentController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()
  @ApiOperation({
    operationId: 'grantAttachmentUpload',
    summary: 'Somewhere to upload one file, before attaching it',
    description:
      'The bytes go straight to where files are stored, not through here. ' +
      'The upload is only an upload: the file joins a task when its id is ' +
      'sent with one.',
  })
  @ApiCreatedResponse({ type: AttachmentUploadResponseDto })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  @ApiUnprocessableEntityResponse({
    description: 'Too large to attach, or nowhere to store it',
  })
  async grant(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: GrantAttachmentUploadRequestDto,
  ): Promise<AttachmentUploadResponseDto> {
    const granted = await this.commandBus.execute<
      GrantAttachmentUploadCommand,
      AttachmentUploadDto | null
    >(
      new GrantAttachmentUploadCommand(
        slug,
        user.id,
        body.name ?? '',
        body.contentType ?? '',
        body.size,
      ),
    );

    if (!granted) {
      throw new NotFoundException();
    }

    return new AttachmentUploadResponseDto(
      granted.id,
      granted.url,
      granted.headers,
    );
  }

  @Get(':attachmentId')
  @ApiOperation({
    operationId: 'readAttachment',
    summary: 'Open a file attached to a task',
  })
  @ApiParam({ name: 'attachmentId', type: String })
  @ApiQuery({
    name: 'download',
    required: false,
    description: 'Saved rather than shown, where set',
  })
  @ApiFoundResponse({ description: 'Sent on to the file itself' })
  @ApiNotFoundResponse({ description: 'No such file for this caller' })
  async read(
    @Param('slug') slug: string,
    @Param('attachmentId') attachmentId: string,
    @Query('download') download: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Redirectable,
  ): Promise<void> {
    const url = await this.queryBus.execute<ReadAttachmentQuery, string | null>(
      new ReadAttachmentQuery(
        slug,
        user.id,
        attachmentId,
        download !== undefined && download !== '0' && download !== 'false',
      ),
    );

    if (!url) {
      throw new NotFoundException();
    }

    response.redirect(url);
  }
}
