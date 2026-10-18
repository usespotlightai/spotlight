import { ApiProperty } from '@nestjs/swagger';

export class HappeningResponseDto {
  @ApiProperty({ example: 'github.pull_request.commented' })
  readonly happening: string;

  @ApiProperty({ example: 'github' })
  readonly integration: string;

  @ApiProperty({ example: 'Pull request commented on' })
  readonly label: string;

  @ApiProperty({ example: 'The pull request was commented on.' })
  readonly summary: string;

  constructor(
    happening: string,
    integration: string,
    label: string,
    summary: string,
  ) {
    this.happening = happening;
    this.integration = integration;
    this.label = label;
    this.summary = summary;
  }
}
