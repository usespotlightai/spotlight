import {
  PULL_REQUEST_ROUTE_NAMES,
  REVIEW_COMMENT_STATE_NAMES,
  REVIEW_SIDE_NAMES,
  REVIEW_VERDICT_NAMES,
} from '@change-review/application/dto/run-review.dto';
import { ApiProperty } from '@nestjs/swagger';

type ReviewCommentStateName = (typeof REVIEW_COMMENT_STATE_NAMES)[number];

export class ReviewCommentResponseDto {
  @ApiProperty()
  readonly id: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'docs',
    description: 'The repository the file is in; none when it was not named',
  })
  readonly repository: string | null;

  @ApiProperty({ example: 'src/invite.ts' })
  readonly path: string;

  @ApiProperty({
    enum: REVIEW_SIDE_NAMES,
    nullable: true,
    description:
      'Which side of the change its lines are on; none on the whole file',
  })
  readonly side: 'new' | 'old' | null;

  @ApiProperty({
    example: 12,
    nullable: true,
    type: Number,
    description: 'The line it ends on; none for a comment on the whole file',
  })
  readonly line: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Where it starts, when it is on several lines',
  })
  readonly startLine: number | null;

  @ApiProperty({ description: 'Markdown' })
  readonly body: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  readonly authorName: string;

  @ApiProperty({ nullable: true, type: String, example: 'octocat' })
  readonly authorLogin: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Their picture' })
  readonly authorImage: string | null;

  @ApiProperty({ description: 'Whether the caller wrote it' })
  readonly viewerIsAuthor: boolean;

  @ApiProperty({ description: 'Whether an agent wrote it, reviewing' })
  readonly isAgentAuthored: boolean;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'The first comment of the thread this answers',
  })
  readonly replyTo: string | null;

  @ApiProperty({
    enum: REVIEW_COMMENT_STATE_NAMES,
    description:
      'draft: only its author sees it; sending: on its way to GitHub; posted: on GitHub; failed: GitHub answered with an error',
  })
  readonly state: ReviewCommentStateName;

  @ApiProperty({ nullable: true, type: String })
  readonly failure: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly url: string | null;

  @ApiProperty()
  readonly createdAt: string;

  @ApiProperty({ nullable: true, type: String })
  readonly editedAt: string | null;

  constructor(fields: Omit<ReviewCommentResponseDto, never>) {
    this.id = fields.id;
    this.repository = fields.repository;
    this.path = fields.path;
    this.side = fields.side;
    this.line = fields.line;
    this.startLine = fields.startLine;
    this.body = fields.body;
    this.authorName = fields.authorName;
    this.authorLogin = fields.authorLogin;
    this.authorImage = fields.authorImage;
    this.viewerIsAuthor = fields.viewerIsAuthor;
    this.isAgentAuthored = fields.isAgentAuthored;
    this.replyTo = fields.replyTo;
    this.state = fields.state;
    this.failure = fields.failure;
    this.url = fields.url;
    this.createdAt = fields.createdAt;
    this.editedAt = fields.editedAt;
  }
}

export class ReviewResponseDto {
  @ApiProperty()
  readonly id: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'docs',
    description: 'The repository it reviews; none when it was not named',
  })
  readonly repository: string | null;

  @ApiProperty()
  readonly authorName: string;

  @ApiProperty()
  readonly viewerIsAuthor: boolean;

  @ApiProperty({ description: 'Whether an agent submitted it' })
  readonly isAgentAuthored: boolean;

  @ApiProperty({ enum: REVIEW_VERDICT_NAMES })
  readonly verdict: 'comment' | 'approve' | 'request-changes';

  @ApiProperty()
  readonly body: string;

  @ApiProperty({ enum: REVIEW_COMMENT_STATE_NAMES })
  readonly state: ReviewCommentStateName;

  @ApiProperty({ nullable: true, type: String })
  readonly failure: string | null;

  @ApiProperty()
  readonly submittedAt: string;

  constructor(fields: Omit<ReviewResponseDto, never>) {
    this.id = fields.id;
    this.repository = fields.repository;
    this.authorName = fields.authorName;
    this.viewerIsAuthor = fields.viewerIsAuthor;
    this.isAgentAuthored = fields.isAgentAuthored;
    this.verdict = fields.verdict;
    this.body = fields.body;
    this.state = fields.state;
    this.failure = fields.failure;
    this.submittedAt = fields.submittedAt;
  }
}

export class PullRequestLandingResponseDto {
  @ApiProperty({
    nullable: true,
    type: String,
    example: 'docs',
    description:
      'The repository a review or comment names; none for one that names no repository',
  })
  readonly repository: string | null;

  @ApiProperty({
    enum: PULL_REQUEST_ROUTE_NAMES,
    description:
      'routed: lands on pullRequest; waiting: lands when the task opens a pull request in the repository; ambiguous: names no repository while the task has more than one pull request, and lands nowhere',
  })
  readonly route: (typeof PULL_REQUEST_ROUTE_NAMES)[number];

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'https://github.com/acme/docs/pull/3',
    description: 'The pull request it lands on, when routed',
  })
  readonly pullRequest: string | null;

  constructor(fields: PullRequestLandingResponseDto) {
    this.repository = fields.repository;
    this.route = fields.route;
    this.pullRequest = fields.pullRequest;
  }
}

export class CodeReviewResponseDto {
  @ApiProperty({
    type: PullRequestLandingResponseDto,
    isArray: true,
    description:
      'Where a review or comment lands: one entry for no repository, and one for the repository of each pull request of the task. A repository not in the list waits for its pull request',
  })
  readonly landings: readonly PullRequestLandingResponseDto[];

  @ApiProperty({ type: ReviewCommentResponseDto, isArray: true })
  readonly comments: readonly ReviewCommentResponseDto[];

  @ApiProperty({ type: ReviewResponseDto, isArray: true })
  readonly reviews: readonly ReviewResponseDto[];

  constructor(
    landings: readonly PullRequestLandingResponseDto[],
    comments: readonly ReviewCommentResponseDto[],
    reviews: readonly ReviewResponseDto[],
  ) {
    this.landings = landings;
    this.comments = comments;
    this.reviews = reviews;
  }
}

export class CreatedIdResponseDto {
  @ApiProperty()
  readonly id: string;

  constructor(id: string) {
    this.id = id;
  }
}
