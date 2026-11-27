import {
  BadRequestException,
  Body,
  ConflictException,
  NotFoundException,
  Param,
  Put,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
} from '@nestjs/swagger';
import { AdminController } from '@platform/http/decorators/admin-controller.decorator';
import { SetPlatformPoolCommand } from '@runners/application/commands/platform-pool.commands';
import type { PlatformPoolChangeDto } from '@runners/application/dto/platform-pool.dto';
import { SetWorkspacePlatformPoolRequestDto } from '@runners/presentation/http/dto/platform-pool.request.dto';
import { WorkspacePlatformPoolResponseDto } from '@runners/presentation/http/dto/platform-pool.response.dto';

const UNSET =
  'Sorry, this deployment adds no platform pool to its workspaces. Set SPOTLIGHT_PLATFORM_POOL_URL and SPOTLIGHT_PLATFORM_POOL_SECRET to add one.';

const KEY_TAKEN =
  'Sorry, this workspace has its own runner pool with the key spotlight, so it has no platform pool.';

const FIELDS = ['enabled', 'allowsSecrets', 'allowsReviewWork'] as const;

interface PlatformPoolChange {
  readonly enabled?: boolean;
  readonly allowsSecrets?: boolean;
  readonly allowsReviewWork?: boolean;
}

const changeOf = (raw: unknown): PlatformPoolChange => {
  const body: object = typeof raw === 'object' && raw !== null ? raw : {};
  const change: { -readonly [Field in keyof PlatformPoolChange]: boolean } = {};

  for (const field of FIELDS) {
    const value: unknown = Reflect.get(body, field);

    if (value === undefined) {
      continue;
    }

    if (typeof value !== 'boolean') {
      throw unclearChange();
    }

    change[field] = value;
  }

  if (Object.keys(change).length === 0) {
    throw unclearChange();
  }

  return change;
};

const unclearChange = (): BadRequestException =>
  new BadRequestException(
    'Sorry, the body must set at least one of enabled, allowsSecrets and allowsReviewWork to true or false, as in {"enabled": false}.',
  );

// The admin token is the authorisation. A change shows as made by Spotlight.
@AdminController('workspaces')
export class AdminPlatformPoolController {
  constructor(private readonly commandBus: CommandBus) {}

  @Put(':workspaceId/platform-pool')
  @ApiOperation({
    operationId: 'setWorkspacePlatformPool',
    summary:
      'Enable or disable the platform pool of a workspace, and set the work it takes',
    description:
      'The platform pool is the pool that Spotlight adds to each workspace with the provisioner of this deployment. A disabled platform pool takes no work, and it stays disabled across restarts. It takes runs that inject secrets, and checks and diffs, only when this call allows them. A field that the body does not give stays as it is. The workspace’s configuration changes record the change, made by Spotlight.',
  })
  @ApiParam({
    name: 'workspaceId',
    example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57',
  })
  @ApiBody({ type: SetWorkspacePlatformPoolRequestDto })
  @ApiOkResponse({ type: WorkspacePlatformPoolResponseDto })
  @ApiBadRequestResponse({
    description:
      'A body that sets none of enabled, allowsSecrets and allowsReviewWork to true or false',
  })
  @ApiConflictResponse({
    description:
      'This deployment adds no platform pool, or the workspace has its own pool with the key spotlight, or the pool changed at the same time',
  })
  @ApiNotFoundResponse({
    description: 'No such workspace, or no admin token is set',
  })
  @ApiBody({ type: SetWorkspacePlatformPoolRequestDto })
  async setPlatformPool(
    @Param('workspaceId') workspaceId: string,
    @Body() body: SetWorkspacePlatformPoolRequestDto | undefined,
  ): Promise<WorkspacePlatformPoolResponseDto> {
    const changed = await this.commandBus.execute<
      SetPlatformPoolCommand,
      PlatformPoolChangeDto | null
    >(new SetPlatformPoolCommand(workspaceId, changeOf(body)));

    switch (changed?.outcome) {
      case undefined:
        throw new NotFoundException();
      case 'unset':
        throw new ConflictException(UNSET);
      case 'key-taken':
        throw new ConflictException(KEY_TAKEN);
      case 'enabled':
      case 'disabled':
        return new WorkspacePlatformPoolResponseDto(
          changed.outcome === 'enabled',
          changed.allowsSecrets,
          changed.allowsReviewWork,
        );
    }
  }
}
