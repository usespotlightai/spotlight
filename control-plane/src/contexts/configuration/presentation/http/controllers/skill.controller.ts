import type { TeamSkillsDto } from '@configuration/application/dto/skills.dto';
import { TeamSkillsQuery } from '@configuration/application/queries/team-skills.query';
import { TeamSkillsResponseDto } from '@configuration/presentation/http/dto/skill.response.dto';
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
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

@ApiTags('skills')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@Controller()
export class SkillController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('teams/:teamId/skills')
  @ApiOperation({
    operationId: 'listTeamSkills',
    summary: 'The skills this team defines in its configuration repository',
  })
  @ApiParam({ name: 'teamId', example: 'team_1' })
  @ApiOkResponse({ type: TeamSkillsResponseDto })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  async listForTeam(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TeamSkillsResponseDto> {
    const found = await this.queryBus.execute<
      TeamSkillsQuery,
      TeamSkillsDto | null
    >(new TeamSkillsQuery(teamId, user.id));

    if (!found) {
      throw new NotFoundException();
    }

    return new TeamSkillsResponseDto(found);
  }
}
