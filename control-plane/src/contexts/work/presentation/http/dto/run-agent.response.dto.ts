import { ApiProperty } from '@nestjs/swagger';
import type { RunAgentDto } from '@work/application/dto/run-agent.dto';

export class RunAgentResponseDto {
  @ApiProperty({ example: 'claude-code' })
  readonly harness: string;

  @ApiProperty({ nullable: true, type: String })
  readonly model: string | null;

  @ApiProperty({ nullable: true, type: String })
  readonly effort: string | null;

  constructor(agent: RunAgentDto) {
    this.harness = agent.harness;
    this.model = agent.model;
    this.effort = agent.effort;
  }
}
