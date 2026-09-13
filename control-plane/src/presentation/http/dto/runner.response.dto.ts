import { ApiProperty } from '@nestjs/swagger';

export class ToolAnswerResponseDto {
  @ApiProperty({
    description: 'What the tool answered, shaped as the tool shapes it',
    example: 'https://github.com/acme/api/pull/9',
    nullable: true,
    oneOf: [
      { type: 'string' },
      { type: 'number' },
      { type: 'boolean' },
      { type: 'object' },
      { type: 'array', items: {} },
    ],
  })
  readonly output: unknown;

  constructor(output: unknown) {
    this.output = output;
  }
}

export class RegisteredRunnerResponseDto {
  @ApiProperty({ example: '3fd46417-95af-4c8b-9a3d-2b7e5f0c1d84' })
  readonly runnerId: string;

  constructor(runnerId: string) {
    this.runnerId = runnerId;
  }
}

export class ClaimedRunResponseDto {
  @ApiProperty({ example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  readonly id: string;

  @ApiProperty({
    description: 'Opaque to the control plane, meaningful to the hook',
  })
  readonly spec: unknown;

  constructor(id: string, spec: unknown) {
    this.id = id;
    this.spec = spec;
  }
}

export class EnqueuedRunResponseDto {
  @ApiProperty({ example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  readonly id: string;

  @ApiProperty({ example: 'claude-code' })
  readonly harness: string;

  @ApiProperty({ example: 'queued' })
  readonly state: string;

  @ApiProperty({
    nullable: true,
    example: '8a1d4e0b-6c72-4f35-9b8a-1e5d3c7f2a49',
    description: 'The runner it waits for, or null for whoever is free',
  })
  readonly targetRunnerId: string | null;

  constructor(
    id: string,
    harness: string,
    state: string,
    targetRunnerId: string | null,
  ) {
    this.id = id;
    this.harness = harness;
    this.state = state;
    this.targetRunnerId = targetRunnerId;
  }
}

export class RenewLeaseResponseDto {
  @ApiProperty({
    example: false,
    description: 'Whether a person has asked the runner to stop this run',
  })
  readonly stop: boolean;

  constructor(stop: boolean) {
    this.stop = stop;
  }
}
