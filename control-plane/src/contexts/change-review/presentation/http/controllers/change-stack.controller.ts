import { AnswerQuestionCommand } from '@change-review/application/commands/answer-question.command';
import type {
  LatestChangeStackDto,
  QuestionAnswerDto,
  RunChangeStacksDto,
} from '@change-review/application/dto/change-stack.dto';
import { ListRunChangeStacksQuery } from '@change-review/application/queries/list-run-change-stacks.query';
import { ReadQuestionAnswerQuery } from '@change-review/application/queries/read-question-answer.query';
import { ReadTaskChangeStackQuery } from '@change-review/application/queries/read-task-change-stack.query';
import { RUN_CHANGE_STACKS } from '@change-review/presentation/http/change-stack-routes';
import {
  AnswerQuestionRequestDto,
  LatestChangeStackResponseDto,
  NewestChangeStackResponseDto,
  QuestionAnswerResponseDto,
  RunChangeStacksResponseDto,
} from '@change-review/presentation/http/dto/change-stack.response.dto';
import { ChangeStackHttpMapper } from '@change-review/presentation/http/mappers/change-stack.http.mapper';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';

const replyIn = (body: AnswerQuestionRequestDto | undefined): string | null => {
  const reply: unknown = body?.reply;

  if (reply === null || typeof reply === 'string') {
    return reply;
  }

  throw new BadRequestException(
    'reply must be the answer in words, or null to say you do not know.',
  );
};

@ApiTags('change-stacks')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({ name: 'teamId', type: String })
@Controller('teams/:teamId')
export class ChangeStackController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get(RUN_CHANGE_STACKS)
  @ApiOperation({
    operationId: 'listRunChangeStacks',
    summary:
      'The change stacks that Spotlight generated from what a run changed, newest first',
  })
  @ApiParam({ name: 'runId', type: String })
  @ApiOkResponse({ type: RunChangeStacksResponseDto })
  @ApiNotFoundResponse({ description: 'No such run for this caller' })
  async changeStacks(
    @Param('teamId') teamId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<RunChangeStacksResponseDto> {
    const found = await this.queryBus.execute<
      ListRunChangeStacksQuery,
      RunChangeStacksDto | null
    >(new ListRunChangeStacksQuery(teamId, runId, user.id));

    if (!found) {
      throw new NotFoundException(`Run ${runId} not found.`);
    }

    return ChangeStackHttpMapper.toResponse(found);
  }

  @Post('runs/:runId/change-stacks/:stackId/questions/:questionId/answers')
  @ApiOperation({
    operationId: 'answerStackQuestion',
    summary:
      'Answer a question about a layer of a change stack, and get it graded against the expected answer',
  })
  @ApiParam({ name: 'runId', type: String })
  @ApiParam({ name: 'stackId', type: String })
  @ApiParam({ name: 'questionId', type: String })
  @ApiBody({ type: AnswerQuestionRequestDto })
  @ApiCreatedResponse({ type: QuestionAnswerResponseDto })
  @ApiForbiddenResponse({
    description:
      'The caller is not a member of the team, nor a workspace admin',
  })
  @ApiBadRequestResponse({
    description: 'The reply is not words or null, or it is too long',
  })
  @ApiNotFoundResponse({
    description: 'No such change stack or question for this caller',
  })
  @ApiConflictResponse({ description: 'The caller already answered it' })
  async answer(
    @Param('teamId') teamId: string,
    @Param('runId') runId: string,
    @Param('stackId') stackId: string,
    @Param('questionId') questionId: string,
    @Body() body: AnswerQuestionRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<QuestionAnswerResponseDto> {
    await this.commandBus.execute<AnswerQuestionCommand, void>(
      new AnswerQuestionCommand(
        teamId,
        runId,
        stackId,
        questionId,
        user.id,
        replyIn(body),
      ),
    );
    const answered = await this.queryBus.execute<
      ReadQuestionAnswerQuery,
      QuestionAnswerDto | null
    >(new ReadQuestionAnswerQuery(teamId, runId, stackId, questionId, user.id));

    if (!answered) {
      throw new NotFoundException(`Change stack ${stackId} not found.`);
    }

    return ChangeStackHttpMapper.toAnswer(answered);
  }

  @Get('tasks/:taskId/change-stack')
  @ApiOperation({
    operationId: 'readTaskChangeStack',
    summary: 'The newest change stack generated for a task',
  })
  @ApiParam({ name: 'taskId', type: String })
  @ApiOkResponse({ type: NewestChangeStackResponseDto })
  async taskChangeStack(
    @Param('teamId') teamId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<NewestChangeStackResponseDto> {
    const latest = await this.queryBus.execute<
      ReadTaskChangeStackQuery,
      LatestChangeStackDto | null
    >(new ReadTaskChangeStackQuery(teamId, taskId, user.id));

    return new NewestChangeStackResponseDto(
      latest &&
        new LatestChangeStackResponseDto(
          latest.runId,
          latest.repository,
          latest.state,
          latest.checkStatus,
          latest.added,
          latest.removed,
        ),
    );
  }
}
