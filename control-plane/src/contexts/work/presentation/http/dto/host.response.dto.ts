import { ApiProperty } from '@nestjs/swagger';
import { ClaimedWorkResponseDto } from '@work/presentation/http/dto/runner.response.dto';

export class HostClaimResponseDto {
  @ApiProperty({
    example: '9c4e1a7b-2d58-4f36-8b0e-6a1f3c9d7e24',
    description: 'The one-run runner Spotlight started for this work',
  })
  readonly runnerId: string;

  @ApiProperty({
    description:
      'The one-run credential, good only for this work and only until it ends; every later call carries it instead of the host’s own credential',
  })
  readonly token: string;

  @ApiProperty({
    description:
      'The credential the egress sidecar fetches the run’s secrets with; the host hands it to egress alone, never into the sandbox',
  })
  readonly egressToken: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '5d2e8f1a-7c4b-4e9a-b3f6-1a8d0c7e2b95',
    description:
      'The sandbox Spotlight started for a run; the host labels its container with it and reports it in each heartbeat. Null for a check.',
  })
  readonly sandboxId: string | null;

  @ApiProperty({ type: ClaimedWorkResponseDto })
  readonly work: ClaimedWorkResponseDto;

  constructor(
    runnerId: string,
    token: string,
    egressToken: string,
    sandboxId: string | null,
    work: ClaimedWorkResponseDto,
  ) {
    this.runnerId = runnerId;
    this.token = token;
    this.egressToken = egressToken;
    this.sandboxId = sandboxId;
    this.work = work;
  }
}
