import { DeleteReviewCommentCommand } from '@change-review/application/commands/delete-review-comment.command';
import { DraftReviewCommentCommand } from '@change-review/application/commands/draft-review-comment.command';
import { EditReviewCommentCommand } from '@change-review/application/commands/edit-review-comment.command';
import { SubmitReviewCommand } from '@change-review/application/commands/submit-review.command';
import type { TaskReviewDto } from '@change-review/application/dto/task-review.dto';
import { ReadTaskReviewQuery } from '@change-review/application/queries/read-task-review.query';
import {
  DraftReviewCommentRequestDto,
  EditReviewCommentRequestDto,
  SubmitReviewRequestDto,
} from '@change-review/presentation/http/dto/review.request.dto';
import {
  CodeReviewResponseDto,
  CreatedIdResponseDto,
  PullRequestLandingResponseDto,
  ReviewCommentResponseDto,
  ReviewResponseDto,
} from '@change-review/presentation/http/dto/review.response.dto';
import { deliveryFailureText } from '@change-review/presentation/http/mappers/delivery-failure.text';
import { sentFields } from '@change-review/presentation/http/mappers/sent-fields';
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
import type { AuthenticatedUser } from '@platform/http/authenticated-user';
import { CurrentUser } from '@platform/http/decorators/current-user.decorator';

@ApiTags('reviews')
@ApiParam({ name: 'teamId', type: String })
@ApiParam({ name: 'taskId', type: String })
@Controller('teams/:teamId/tasks/:taskId/review')
export class ReviewController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Get()
  @ApiOperation({
    operationId: 'readTaskReview',
    summary:
      'The review of what a task changed: comments on its lines, and reviews submitted',
  })
  @ApiOkResponse({ type: CodeReviewResponseDto })
  @ApiNotFoundResponse({ description: 'No such task for this caller' })
  async read(
    @Param('teamId') teamId: string,
    @Param('taskId') taskId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CodeReviewResponseDto> {
    const found = await this.queryBus.execute<
      ReadTaskReviewQuery,
      TaskReviewDto
    >(new ReadTaskReviewQuery(teamId, taskId, user.id));

    return new CodeReviewResponseDto(
      found.landings.map((each) => new PullRequestLandingResponseDto(each)),
      found.comments.map(
        (each) =>
          new ReviewCommentResponseDto({
            ...each,
            failure: deliveryFailureText(each.failure),
          }),
      ),
      found.reviews.map(
        (each) =>
          new ReviewResponseDto({
            ...each,
            failure: deliveryFailureText(each.failure),
          }),
      ),
    );
  }

  @Post('comments')
  @ApiOperation({
    operationId: 'draftReviewComment',
    summary:
      'Draft a comment on lines or a whole file, or reply to a comment; a reply goes to GitHub straight away',
  })
  @ApiCreatedResponse({ type: CreatedIdResponseDto })
  @ApiForbiddenResponse({
    description:
      'The caller is not a member of the team, nor a workspace admin',
  })
  @ApiNotFoundResponse({
    description: 'No such task or comment for this caller',
  })
  @ApiUnprocessableEntityResponse({
    description: 'The comment has no text, or names no file',
  })
  async draft(
    @Param('teamId') teamId: string,
    @Param('taskId') taskId: string,
    @Body() body: DraftReviewCommentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreatedIdResponseDto> {
    const id = await this.commandBus.execute<DraftReviewCommentCommand, string>(
      new DraftReviewCommentCommand(
        teamId,
        taskId,
        user.id,
        sentFields(body).body ?? '',
        {
          replyTo: body.replyTo ?? null,
          repository: body.repository ?? null,
          path: body.path ?? '',
          side: body.side ?? null,
          line: body.line ?? null,
          startLine: body.startLine ?? null,
        },
      ),
    );

    return new CreatedIdResponseDto(id);
  }

  @Patch('comments/:commentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    operationId: 'editReviewComment',
    summary: 'Edit a comment of your own, on GitHub too once it is there',
  })
  @ApiParam({ name: 'commentId', type: String })
  @ApiNoContentResponse()
  @ApiForbiddenResponse({
    description:
      'Someone else wrote it, or the caller is not a member of the team, nor a workspace admin',
  })
  async edit(
    @Param('teamId') teamId: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @Body() body: EditReviewCommentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new EditReviewCommentCommand(
        teamId,
        taskId,
        user.id,
        commentId,
        sentFields(body).body ?? '',
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
  @ApiForbiddenResponse({
    description:
      'Someone else wrote it, or the caller is not a member of the team, nor a workspace admin',
  })
  async delete(
    @Param('teamId') teamId: string,
    @Param('taskId') taskId: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.commandBus.execute(
      new DeleteReviewCommentCommand(teamId, taskId, user.id, commentId),
    );
  }

  @Post()
  @ApiOperation({
    operationId: 'submitReview',
    summary:
      'Submit your drafts as a review; it posts to the pull request, once the task has one',
  })
  @ApiCreatedResponse({ type: CreatedIdResponseDto })
  @ApiForbiddenResponse({
    description:
      'The caller is not a member of the team, nor a workspace admin',
  })
  @ApiUnprocessableEntityResponse({
    description: 'A comment or request for changes that says nothing',
  })
  async submit(
    @Param('teamId') teamId: string,
    @Param('taskId') taskId: string,
    @Body() body: SubmitReviewRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreatedIdResponseDto> {
    const id = await this.commandBus.execute<SubmitReviewCommand, string>(
      new SubmitReviewCommand(
        teamId,
        taskId,
        user.id,
        sentFields(body).verdict ?? '',
        sentFields(body).body ?? '',
        body.repository ?? null,
      ),
    );

    return new CreatedIdResponseDto(id);
  }
}
