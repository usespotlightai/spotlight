import { RenameTeamCommand } from '@application/commands/rename-team.command';
import type { AuthenticatedUser } from '@application/ports/session.port';
import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@presentation/http/decorators/current-user.decorator';
import { RenameTeamRequestDto } from '@presentation/http/dto/team.request.dto';

@ApiTags('teams')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller('teams/:teamId')
export class TeamController {
  constructor(private readonly commandBus: CommandBus) {}

  @Patch()
  @ApiOperation({ operationId: 'renameTeam', summary: 'Rename a team' })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiNoContentResponse({ description: 'Renamed' })
  @ApiNotFoundResponse({ description: 'No such team, or not yours to rename' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async rename(
    @Param('teamId') teamId: string,
    @Body() body: RenameTeamRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    const renamed = await this.commandBus.execute<RenameTeamCommand, boolean>(
      new RenameTeamCommand(teamId, body.name, user.id),
    );

    if (!renamed) {
      throw new NotFoundException();
    }
  }
}
