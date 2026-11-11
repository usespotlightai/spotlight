import {
  RemoveAvatarCommand,
  SetAvatarCommand,
} from '@identity/application/commands/avatar.commands';
import type { AvatarImageDto } from '@identity/application/dto/avatar-image.dto';
import type { AvatarOf } from '@identity/application/dto/avatar-of.dto';
import type { AvatarSetDto } from '@identity/application/dto/avatar-set.dto';
import { ReadAvatarQuery } from '@identity/application/queries/read-avatar.query';
import {
  AVATAR,
  AVATAR_CACHE,
  avatarImageResponse,
} from '@identity/presentation/http/avatar-image-response';
import { SetAvatarRequestDto } from '@identity/presentation/http/dto/avatar.request.dto';
import { AvatarResponseDto } from '@identity/presentation/http/dto/avatar.response.dto';
import { avatarImageInput } from '@identity/presentation/http/mappers/avatar-image-input';
import {
  teamAvatarUrl,
  workspaceAvatarUrl,
} from '@identity/presentation/http/mappers/avatar-url';
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  type StreamableFile,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentActor } from '@platform/http/decorators/current-actor.decorator';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import { ProblemException } from '@platform/http/resources/problem.exception';
import { respondDeleted } from '@platform/http/resources/resource-responses';
import type { ResourceDeleted } from '@shared-kernel/application/dto/resource-outcomes.dto';
import type { Actor } from '@shared-kernel/domain/value-objects/actor.vo';

class Avatars {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  async set(
    of: AvatarOf,
    body: SetAvatarRequestDto,
    actor: Actor,
  ): Promise<AvatarResponseDto> {
    const set = await this.commandBus.execute<
      SetAvatarCommand,
      AvatarSetDto | null
    >(new SetAvatarCommand(of, avatarImageInput(body), actor));

    if (!set) {
      throw ProblemException.notFound(AVATAR);
    }

    if (set.outcome === 'forbidden') {
      throw ProblemException.forbidden(AVATAR, set.act);
    }

    return new AvatarResponseDto(
      of.kind === 'workspace'
        ? workspaceAvatarUrl(of.slug, set.digest)
        : teamAvatarUrl(of.teamId, set.digest),
    );
  }

  async remove(of: AvatarOf, actor: Actor): Promise<void> {
    respondDeleted(
      AVATAR,
      await this.commandBus.execute<
        RemoveAvatarCommand,
        ResourceDeleted | null
      >(new RemoveAvatarCommand(of, actor)),
    );
  }

  async read(
    of: AvatarOf,
    digest: string,
    user: AuthenticatedUser,
  ): Promise<StreamableFile> {
    return avatarImageResponse(
      await this.queryBus.execute<ReadAvatarQuery, AvatarImageDto | null>(
        new ReadAvatarQuery(of, digest, user.id),
      ),
    );
  }
}

@ApiTags('workspaces')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('workspaces/:slug/avatar')
export class WorkspaceAvatarController {
  private readonly avatars: Avatars;

  constructor(commandBus: CommandBus, queryBus: QueryBus) {
    this.avatars = new Avatars(commandBus, queryBus);
  }

  @Put()
  @ApiOperation({
    operationId: 'setWorkspaceAvatar',
    summary: 'Set the workspace’s avatar',
  })
  @ApiParam({ name: 'slug', example: 'acme-inc' })
  @ApiOkResponse({
    description: 'That is its avatar now',
    type: AvatarResponseDto,
  })
  @ApiConflictResponse({
    description: 'Its avatar changed at the same time; try again',
  })
  @ApiForbiddenResponse({ description: 'You may not configure it' })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  @ApiUnprocessableEntityResponse({
    description: 'Not a PNG, JPEG, WebP or GIF image, or too large',
  })
  set(
    @Param('slug') slug: string,
    @Body() body: SetAvatarRequestDto,
    @CurrentActor() actor: Actor,
  ): Promise<AvatarResponseDto> {
    return this.avatars.set({ kind: 'workspace', slug }, body, actor);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'removeWorkspaceAvatar',
    summary: 'Remove the workspace’s avatar',
  })
  @ApiParam({ name: 'slug', example: 'acme-inc' })
  @ApiNoContentResponse({ description: 'It has no avatar now' })
  @ApiConflictResponse({
    description: 'Its avatar changed at the same time; try again',
  })
  @ApiForbiddenResponse({ description: 'You may not configure it' })
  @ApiNotFoundResponse({ description: 'No such workspace for this caller' })
  remove(
    @Param('slug') slug: string,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    return this.avatars.remove({ kind: 'workspace', slug }, actor);
  }

  @Get(':digest')
  @Header('Cache-Control', AVATAR_CACHE)
  @ApiOperation({
    operationId: 'readWorkspaceAvatar',
    summary: 'The workspace’s avatar image',
  })
  @ApiParam({ name: 'slug', example: 'acme-inc' })
  @ApiParam({ name: 'digest', description: 'The SHA-256 of the image' })
  @ApiOkResponse({ description: 'The image, byte for byte' })
  @ApiNotFoundResponse({
    description: 'Not its avatar, or not for this caller',
  })
  read(
    @Param('slug') slug: string,
    @Param('digest') digest: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StreamableFile> {
    return this.avatars.read({ kind: 'workspace', slug }, digest, user);
  }
}

@ApiTags('teams')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('teams/:teamId/avatar')
export class TeamAvatarController {
  private readonly avatars: Avatars;

  constructor(commandBus: CommandBus, queryBus: QueryBus) {
    this.avatars = new Avatars(commandBus, queryBus);
  }

  @Put()
  @ApiOperation({
    operationId: 'setTeamAvatar',
    summary: 'Set the team’s avatar',
  })
  @ApiOkResponse({
    description: 'That is its avatar now',
    type: AvatarResponseDto,
  })
  @ApiConflictResponse({
    description: 'Its avatar changed at the same time; try again',
  })
  @ApiForbiddenResponse({ description: 'You may not configure it' })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  @ApiUnprocessableEntityResponse({
    description: 'Not a PNG, JPEG, WebP or GIF image, or too large',
  })
  set(
    @Param('teamId') teamId: string,
    @Body() body: SetAvatarRequestDto,
    @CurrentActor() actor: Actor,
  ): Promise<AvatarResponseDto> {
    return this.avatars.set({ kind: 'team', teamId }, body, actor);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'removeTeamAvatar',
    summary: 'Remove the team’s avatar',
  })
  @ApiNoContentResponse({ description: 'It has no avatar now' })
  @ApiConflictResponse({
    description: 'Its avatar changed at the same time; try again',
  })
  @ApiForbiddenResponse({ description: 'You may not configure it' })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  remove(
    @Param('teamId') teamId: string,
    @CurrentActor() actor: Actor,
  ): Promise<void> {
    return this.avatars.remove({ kind: 'team', teamId }, actor);
  }

  @Get(':digest')
  @Header('Cache-Control', AVATAR_CACHE)
  @ApiOperation({
    operationId: 'readTeamAvatar',
    summary: 'The team’s avatar image',
  })
  @ApiParam({ name: 'digest', description: 'The SHA-256 of the image' })
  @ApiOkResponse({ description: 'The image, byte for byte' })
  @ApiNotFoundResponse({
    description: 'Not its avatar, or not for this caller',
  })
  read(
    @Param('teamId') teamId: string,
    @Param('digest') digest: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StreamableFile> {
    return this.avatars.read({ kind: 'team', teamId }, digest, user);
  }
}
