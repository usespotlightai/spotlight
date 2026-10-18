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

  @ApiProperty({ type: ClaimedWorkResponseDto })
  readonly work: ClaimedWorkResponseDto;

  constructor(
    runnerId: string,
    token: string,
    egressToken: string,
    work: ClaimedWorkResponseDto,
  ) {
    this.runnerId = runnerId;
    this.token = token;
    this.egressToken = egressToken;
    this.work = work;
  }
}
