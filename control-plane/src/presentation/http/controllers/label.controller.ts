import { CreateLabelCommand } from '@application/commands/create-label.command';
import { DeleteLabelCommand } from '@application/commands/delete-label.command';
import { LabelTaskCommand } from '@application/commands/label-task.command';
import { RecolourLabelCommand } from '@application/commands/recolour-label.command';
import { RenameLabelCommand } from '@application/commands/rename-label.command';
import { UnlabelTaskCommand } from '@application/commands/unlabel-task.command';
import type { LabelDto } from '@application/dto/label.dto';
import type { AuthenticatedUser } from '@application/ports/session.port';
import { ListLabelsQuery } from '@application/queries/list-labels.query';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@presentation/http/decorators/current-user.decorator';
import { CreateLabelRequestDto } from '@presentation/http/dto/create-label.request.dto';
import { LabelResponseDto } from '@presentation/http/dto/label.response.dto';
import { RecolourLabelRequestDto } from '@presentation/http/dto/recolour-label.request.dto';
import { RenameLabelRequestDto } from '@presentation/http/dto/rename-label.request.dto';

@ApiTags('labels')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({
  name: 'teamId',
  type: String,
  example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84',
})
@Controller('teams/:teamId')
export class LabelController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get('labels')
  @ApiOperation({
    operationId: 'listLabels',
    summary: "List the team's labels",
  })
  @ApiOkResponse({ type: LabelResponseDto, isArray: true })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  async list(
    @Param('teamId') teamId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LabelResponseDto[]> {
    const labels = await this.queryBus.execute<
      ListLabelsQuery,
      LabelDto[] | null
    >(new ListLabelsQuery(teamId, user.id));

    if (!labels) {
      throw new NotFoundException();
    }

    return labels.map(
      (l) => new LabelResponseDto(l.id, l.teamId, l.name, l.colour),
    );
  }

  @Post('labels')
  @ApiOperation({
    operationId: 'createLabel',
    summary: 'Create a label for a team',
  })
  @ApiCreatedResponse({ type: LabelResponseDto })
  @ApiNotFoundResponse({ description: 'No such team for this caller' })
  async create(
    @Param('teamId') teamId: string,
    @Body() body: CreateLabelRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LabelResponseDto> {
    const created = await this.commandBus.execute<CreateLabelCommand, LabelDto>(
      new CreateLabelCommand(teamId, body.name, body.colour, user.id),
    );

    return new LabelResponseDto(
      created.id,
      created.teamId,
      created.name,
      created.colour,
    );
  }

  @Put('labels/:labelId/name')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'renameLabel',
    summary: 'Rename a label',
  })
  @ApiParam({ name: 'labelId', type: String })
  @ApiOkResponse({ type: LabelResponseDto })
  @ApiNotFoundResponse({ description: 'No such label for this caller' })
  async rename(
    @Param('teamId') teamId: string,
    @Param('labelId') labelId: string,
    @Body() body: RenameLabelRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LabelResponseDto> {
    const renamed = await this.commandBus.execute<RenameLabelCommand, LabelDto>(
      new RenameLabelCommand(teamId, labelId, body.name, user.id),
    );

    return new LabelResponseDto(
      renamed.id,
      renamed.teamId,
      renamed.name,
      renamed.colour,
    );
  }

  @Put('labels/:labelId/colour')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'recolourLabel',
    summary: 'Change the colour of a label',
  })
  @ApiParam({ name: 'labelId', type: String })
  @ApiOkResponse({ type: LabelResponseDto })
  @ApiNotFoundResponse({ description: 'No such label for this caller' })
  async recolour(
    @Param('teamId') teamId: string,
    @Param('labelId') labelId: string,
    @Body() body: RecolourLabelRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LabelResponseDto> {
    const recoloured = await this.commandBus.execute<
      RecolourLabelCommand,
      LabelDto
    >(new RecolourLabelCommand(teamId, labelId, body.colour, user.id));

    return new LabelResponseDto(
      recoloured.id,
      recoloured.teamId,
      recoloured.name,
      recoloured.colour,
    );
  }

  @Delete('labels/:labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'deleteLabel',
    summary: 'Delete a label from a team',
  })
  @ApiParam({ name: 'labelId', type: String })
  @ApiNoContentResponse({ description: 'The label is gone' })
  @ApiNotFoundResponse({ description: 'No such label for this caller' })
  async remove(
    @Param('teamId') teamId: string,
    @Param('labelId') labelId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute<DeleteLabelCommand, void>(
      new DeleteLabelCommand(teamId, labelId, user.id),
    );
  }

  @Post('tasks/:taskId/labels/:labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'labelTask',
    summary: 'Attach a label to a task',
  })
  @ApiParam({ name: 'taskId', type: String })
  @ApiParam({ name: 'labelId', type: String })
  @ApiNoContentResponse({ description: 'The label is on the task' })
  @ApiNotFoundResponse({ description: 'No such task or label for this caller' })
  async labelTask(
    @Param('teamId') teamId: string,
    @Param('taskId') taskId: string,
    @Param('labelId') labelId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute<LabelTaskCommand, void>(
      new LabelTaskCommand(teamId, taskId, labelId, user.id),
    );
  }

  @Delete('tasks/:taskId/labels/:labelId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'unlabelTask',
    summary: 'Remove a label from a task',
  })
  @ApiParam({ name: 'taskId', type: String })
  @ApiParam({ name: 'labelId', type: String })
  @ApiNoContentResponse({ description: 'The label is off the task' })
  @ApiNotFoundResponse({ description: 'No such task or label for this caller' })
  async unlabelTask(
    @Param('teamId') teamId: string,
    @Param('taskId') taskId: string,
    @Param('labelId') labelId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute<UnlabelTaskCommand, void>(
      new UnlabelTaskCommand(teamId, taskId, labelId, user.id),
    );
  }
}
