import type { CallbackTaskView } from '@integrations/application/dto/callback-task-view.dto';
import { ApiProperty } from '@nestjs/swagger';

export class CallbackTaskResponseDto {
  @ApiProperty() readonly id: string;
  @ApiProperty() readonly title: string;
  @ApiProperty() readonly url: string;
  @ApiProperty() readonly line: string;
  @ApiProperty() readonly station: string;
  @ApiProperty() readonly stationKey: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'string' } })
  readonly marks: Record<string, string>;

  @ApiProperty({ type: [String] }) readonly repositories: string[];

  @ApiProperty({
    type: [String],
    description:
      'The pull requests of the task: the one it reviews, or the ones it opened',
  })
  readonly pullRequests: string[];

  @ApiProperty({ description: 'The hook that the token was issued to' })
  readonly hook: string;

  constructor(task: CallbackTaskView) {
    this.id = task.id;
    this.title = task.title;
    this.url = task.url;
    this.line = task.line;
    this.station = task.station;
    this.stationKey = task.stationKey;
    this.marks = { ...task.marks };
    this.repositories = [...task.repositories];
    this.pullRequests = [...task.pullRequests];
    this.hook = task.hook;
  }
}
