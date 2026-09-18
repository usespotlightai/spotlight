import { ApiProperty } from '@nestjs/swagger';

export class HappeningResponseDto {
  @ApiProperty({ example: 'github.pull_request.commented' })
  readonly happening: string;

  @ApiProperty({ example: 'github' })
  readonly source: string;

  @ApiProperty({ example: 'Pull request commented on' })
  readonly label: string;

  @ApiProperty({ example: 'The pull request was commented on.' })
  readonly told: string;

  constructor(happening: string, source: string, label: string, told: string) {
    this.happening = happening;
    this.source = source;
    this.label = label;
    this.told = told;
  }
}
