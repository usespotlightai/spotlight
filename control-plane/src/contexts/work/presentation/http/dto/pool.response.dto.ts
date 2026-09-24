import { ApiProperty } from '@nestjs/swagger';
import { ClaimedWorkResponseDto } from '@work/presentation/http/dto/runner.response.dto';

export class PoolClaimResponseDto {
  @ApiProperty({
    example: '9c4e1a7b-2d58-4f36-8b0e-6a1f3c9d7e24',
    description: 'The one-run runner Spotlight started for this work',
  })
  readonly runnerId: string;

  @ApiProperty({
    description:
      'The one-run credential, good only for this work and only until it ends; every later call carries it instead of the pool token',
  })
  readonly token: string;

  @ApiProperty({ type: ClaimedWorkResponseDto })
  readonly work: ClaimedWorkResponseDto;

  constructor(runnerId: string, token: string, work: ClaimedWorkResponseDto) {
    this.runnerId = runnerId;
    this.token = token;
    this.work = work;
  }
}

export class PoolQueueResponseDto {
  @ApiProperty({
    type: 'integer',
    example: 3,
    description:
      'Runs and checks waiting that this pool could take, for an autoscaler to start runners for',
  })
  readonly pending: number;

  @ApiProperty({
    type: 'integer',
    example: 1,
    description:
      'The pool’s runners standing now: holding a run or check, or started and yet to claim',
  })
  readonly running: number;

  @ApiProperty({
    type: 'integer',
    nullable: true,
    example: 7,
    description:
      'How many more runs the pool may take at once under maxRuns, or null for no limit',
  })
  readonly capacity: number | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'integer' },
    example: { linux: 3, gpu: 1 },
    description:
      'Of what is pending, how many name each of the pool’s labels in their placement',
  })
  readonly labels: Readonly<Record<string, number>>;

  constructor(
    pending: number,
    running: number,
    capacity: number | null,
    labels: Readonly<Record<string, number>>,
  ) {
    this.pending = pending;
    this.running = running;
    this.capacity = capacity;
    this.labels = labels;
  }
}
