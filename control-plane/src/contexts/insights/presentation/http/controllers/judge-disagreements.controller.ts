import { AnswerDisagreementClaimCommand } from '@insights/application/commands/answer-disagreement-claim.command';
import { AnswerJudgeDisagreementCommand } from '@insights/application/commands/answer-judge-disagreement.command';
import type { JudgeDisagreementDto } from '@insights/application/dto/judge-disagreement.dto';
import { ReadJudgeDisagreementQuery } from '@insights/application/queries/read-judge-disagreement.query';
import {
  AnswerDisagreementClaimRequestDto,
  AnswerJudgeDisagreementRequestDto,
  JudgeDisagreementResponseDto,
} from '@insights/presentation/http/dto/judge-disagreement.response.dto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';

const noteIn = (body: { note?: unknown } | undefined) =>
  typeof body?.note === 'string' ? body.note : null;

const answerIn = (body: AnswerDisagreementClaimRequestDto | undefined) =>
  typeof body?.answer === 'string' ? body.answer : '';

const claimIn = (body: AnswerJudgeDisagreementRequestDto | undefined) =>
  typeof body?.shouldHaveFailed === 'number' ? body.shouldHaveFailed : null;

@ApiTags('insights')
@ApiUnauthorizedResponse({ description: 'No valid session' })
@ApiParam({ name: 'teamId', type: String })
@ApiParam({ name: 'disagreementId', type: String })
@Controller('teams/:teamId/judge-disagreements/:disagreementId')
export class JudgeDisagreementsController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'readJudgeDisagreement',
    summary:
      'A run where the judge and a person disagree: the judge’s claims, results and reasons, and the answer',
  })
  @ApiOkResponse({ type: JudgeDisagreementResponseDto })
  @ApiNotFoundResponse({ description: 'No such disagreement for this caller' })
  async disagreement(
    @Param('teamId') teamId: string,
    @Param('disagreementId') disagreementId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<JudgeDisagreementResponseDto> {
    return new JudgeDisagreementResponseDto(
      await this.queryBus.execute<
        ReadJudgeDisagreementQuery,
        JudgeDisagreementDto
      >(new ReadJudgeDisagreementQuery(teamId, disagreementId, user.id)),
    );
  }

  @Post('answer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'answerJudgeDisagreement',
    summary:
      'Where no claim is in dispute, say which claim should have failed, or what was wrong; the answer helps revise the claims and never changes the agreement',
  })
  @ApiBody({ type: AnswerJudgeDisagreementRequestDto })
  @ApiOkResponse({ type: JudgeDisagreementResponseDto })
  @ApiUnprocessableEntityResponse({
    description:
      'Claims are in dispute, so each takes its own answer; or the answer names no claim and says nothing',
  })
  @ApiForbiddenResponse({
    description: 'The question was asked of another person',
  })
  @ApiNotFoundResponse({ description: 'No such disagreement for this caller' })
  @ApiConflictResponse({
    description:
      'The disagreement already has an answer, is withdrawn, or changed meanwhile',
  })
  async answer(
    @Param('teamId') teamId: string,
    @Param('disagreementId') disagreementId: string,
    @Body() body: AnswerJudgeDisagreementRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<JudgeDisagreementResponseDto> {
    await this.commandBus.execute<AnswerJudgeDisagreementCommand, void>(
      new AnswerJudgeDisagreementCommand(
        teamId,
        disagreementId,
        user.id,
        noteIn(body),
        claimIn(body),
      ),
    );

    return this.disagreement(teamId, disagreementId, user);
  }

  @Post('claims/:claim/answer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    operationId: 'answerJudgeDisagreementClaim',
    summary:
      'Answer one claim in dispute, with its own note; the disagreement is answered once every claim in dispute has an answer, and answers never change the agreement',
  })
  @ApiParam({
    name: 'claim',
    type: Number,
    description: 'The place of the claim, from 0',
  })
  @ApiBody({ type: AnswerDisagreementClaimRequestDto })
  @ApiOkResponse({ type: JudgeDisagreementResponseDto })
  @ApiBadRequestResponse({ description: 'The claim is not a whole number' })
  @ApiUnprocessableEntityResponse({
    description:
      'The claim is not in dispute, or the answer is not judge-right or claim-wrong',
  })
  @ApiForbiddenResponse({
    description: 'The question was asked of another person',
  })
  @ApiNotFoundResponse({ description: 'No such disagreement for this caller' })
  @ApiConflictResponse({
    description:
      'The claim already has an answer, the disagreement is withdrawn, or it changed meanwhile',
  })
  async answerClaim(
    @Param('teamId') teamId: string,
    @Param('disagreementId') disagreementId: string,
    @Param('claim', ParseIntPipe) claim: number,
    @Body() body: AnswerDisagreementClaimRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<JudgeDisagreementResponseDto> {
    await this.commandBus.execute<AnswerDisagreementClaimCommand, void>(
      new AnswerDisagreementClaimCommand(
        teamId,
        disagreementId,
        user.id,
        claim,
        answerIn(body),
        noteIn(body),
      ),
    );

    return this.disagreement(teamId, disagreementId, user);
  }
}
