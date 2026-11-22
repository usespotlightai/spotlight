import { ApiProperty } from '@nestjs/swagger';
import {
  TASK_PULL_REQUEST_STATE_NAMES,
  type TaskPullRequestDto,
  type TaskPullRequestState,
} from '@work/application/dto/task-pull-request.dto';

export class TaskPullRequestResponseDto {
  @ApiProperty({ example: 'https://github.com/acme/api/pull/42' })
  readonly url: string;

  @ApiProperty({
    enum: [...TASK_PULL_REQUEST_STATE_NAMES, null],
    nullable: true,
    example: 'open',
    description:
      'Draft, open, merged or closed; null when Spotlight holds no state for it: not seen on GitHub yet, or removed after the retention period',
  })
  readonly state: TaskPullRequestState | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Fix the queue',
    description: 'Null when Spotlight holds no state for it',
  })
  readonly title: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'octocat',
    description: 'GitHub login of the author; null when not known',
  })
  readonly author: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://github.com/octocat.png?size=64',
    description: 'Picture of the author; null for bots and unknown authors',
  })
  readonly authorImage: string | null;

  @ApiProperty({ type: Number, nullable: true, example: 120 })
  readonly additions: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 14 })
  readonly deletions: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 6 })
  readonly changedFiles: number | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '2026-11-21T10:00:00.000Z',
    description: 'When the pull request last changed on GitHub',
  })
  readonly updatedAt: string | null;

  constructor({ url, summary }: TaskPullRequestDto) {
    this.url = url;
    this.state = summary?.state ?? null;
    this.title = summary?.title ?? null;
    this.author = summary?.author ?? null;
    this.authorImage = summary?.authorImage ?? null;
    this.additions = summary?.additions ?? null;
    this.deletions = summary?.deletions ?? null;
    this.changedFiles = summary?.changedFiles ?? null;
    this.updatedAt = summary?.updatedAt.toISOString() ?? null;
  }
}
