import { DeleteReviewCommentCommand } from '@change-review/application/commands/delete-review-comment.command';
import { DraftReviewCommentCommand } from '@change-review/application/commands/draft-review-comment.command';
import { EditReviewCommentCommand } from '@change-review/application/commands/edit-review-comment.command';
import { SubmitReviewCommand } from '@change-review/application/commands/submit-review.command';
import type { RunReviewDto } from '@change-review/application/dto/run-review.dto';
import { ReadRunReviewQuery } from '@change-review/application/queries/read-run-review.query';
import {
  DraftReviewCommentRequestDto,
  EditReviewCommentRequestDto,
  SubmitReviewRequestDto,
} from '@change-review/presentation/http/dto/review.request.dto';
import {
  CodeReviewResponseDto,
  CreatedIdResponseDto,
  ReviewCommentResponseDto,
  ReviewResponseDto,
} from '@change-review/presentation/http/dto/review.response.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@shared-kernel/application/ports/session.port';

@ApiTags('reviews')
@ApiParam({ name: 'teamId', type: String })
@ApiParam({ name: 'runId', type: String })
@Controller('teams/:teamId/runs/:runId/review')
export class ReviewController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'readRunReview',
    summary:
      'The review of what a run changed: comments on its lines, and reviews submitted',
  })
  @ApiOkResponse({ type: CodeReviewResponseDto })
  @ApiNotFoundResponse({ description: 'No such run for this caller' })
  async read(
    @Param('teamId') teamId: string,
    @Param('runId') runId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CodeReviewResponseDto> {
    const found = await this.queryBus.execute<ReadRunReviewQuery, RunReviewDto>(
      new ReadRunReviewQuery(teamId, runId, user.id),
    );

    return new CodeReviewResponseDto(
      found.pullRequest,
      found.comments.map((each) => new ReviewCommentResponseDto(each)),
      found.reviews.map((each) => new ReviewResponseDto(each)),
    );
  }

  @Post('comments')
  @ApiOperation({
    operationId: 'draftReviewComment',
    summary:
      'Draft a comment on a line, or reply to a comment; a reply goes to GitHub straight away',
  })
  @ApiCreatedResponse({ type: CreatedIdResponseDto })
  @ApiNotFoundResponse({
    description: 'No such run or comment for this caller',
  })
  @ApiUnprocessableEntityResponse({ description: 'Nothing said, or no line' })
  async draft(
    @Param('teamId') teamId: string,
    @Param('runId') runId: string,
    @Body() body: DraftReviewCommentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreatedIdResponseDto> {
    const id = await this.commandBus.execute<DraftReviewCommentCommand, string>(
      new DraftReviewCommentCommand(
        teamId,
        runId,
        user.id,
        body.body ?? '',
        body.replyTo
          ? { replyTo: body.replyTo }
          : {
              path: body.path ?? '',
              side: body.side ?? '',
              line: Number(body.line),
              startLine:
                body.startLine === undefined || body.startLine === null
                  ? null
                  : Number(body.startLine),
            },
      ),
    );

    return new CreatedIdResponseDto(id);
  }

  @Patch('comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'editReviewComment',
    summary: 'Rewrite a comment of your own, on GitHub too once it is there',
  })
  @ApiParam({ name: 'commentId', type: String })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Someone else wrote it' })
  async edit(
    @Param('teamId') teamId: string,
    @Param('runId') runId: string,
    @Param('commentId') commentId: string,
    @Body() body: EditReviewCommentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new EditReviewCommentCommand(
        teamId,
        runId,
        user.id,
        commentId,
        body.body ?? '',
      ),
    );
  }

  @Delete('comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'deleteReviewComment',
    summary: 'Delete a comment of your own, from GitHub too once it is there',
  })
  @ApiParam({ name: 'commentId', type: String })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({ description: 'Someone else wrote it' })
  async remove(
    @Param('teamId') teamId: string,
    @Param('runId') runId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new DeleteReviewCommentCommand(teamId, runId, user.id, commentId),
    );
  }

  @Post()
  @ApiOperation({
    operationId: 'submitReview',
    summary:
      'Submit your drafts as a review; it posts to the pull request, once the task has one',
  })
  @ApiCreatedResponse({ type: CreatedIdResponseDto })
  @ApiUnprocessableEntityResponse({
    description: 'A comment or request for changes that says nothing',
  })
  async submit(
    @Param('teamId') teamId: string,
    @Param('runId') runId: string,
    @Body() body: SubmitReviewRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreatedIdResponseDto> {
    const id = await this.commandBus.execute<SubmitReviewCommand, string>(
      new SubmitReviewCommand(
        teamId,
        runId,
        user.id,
        body.verdict ?? '',
        body.body ?? '',
      ),
    );

    return new CreatedIdResponseDto(id);
  }
}
