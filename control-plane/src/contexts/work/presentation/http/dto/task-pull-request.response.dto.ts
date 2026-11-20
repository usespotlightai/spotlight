import { ApiProperty } from '@nestjs/swagger';
import {
  TASK_PULL_REQUEST_STATE_NAMES,
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
      'Draft, open, merged or closed; null while Spotlight has not seen the pull request on GitHub',
  })
  readonly state: TaskPullRequestState | null;

  constructor(url: string, state: TaskPullRequestState | null) {
    this.url = url;
    this.state = state;
  }
}
