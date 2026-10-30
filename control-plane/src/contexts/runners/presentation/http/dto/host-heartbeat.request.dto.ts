import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegisteredHarnessRequestDto } from '@runners/presentation/http/dto/register-runner.request.dto';

export class HostImageRequestDto {
  @ApiProperty({
    example: 'ghcr.io/acme/api-runner:main',
    description: 'The image as Spotlight told the host to run it',
  })
  readonly image!: string;

  @ApiPropertyOptional({
    example:
      'ghcr.io/acme/api-runner@sha256:9b2f5c1e0d7a4b3c8e6f1a2d5c7b9e0f3a4d6c8b1e2f5a7c9d0b3e6f8a1c4d7e',
    description: 'The digest it pulled last, which its sandboxes start from',
  })
  readonly digest?: string;

  @ApiProperty({
    example: false,
    description:
      'Whether this is the host’s default, which runs lines that name no image',
  })
  readonly isDefault!: boolean;

  @ApiPropertyOptional({
    example: 'v0.3.0',
    description: 'The release of the runner inside the image',
  })
  readonly release?: string;

  @ApiPropertyOptional({
    type: [RegisteredHarnessRequestDto],
    isArray: true,
    description: 'The harnesses the image contains, each with the models found',
  })
  readonly harnesses?: RegisteredHarnessRequestDto[];

  @ApiPropertyOptional({
    example: 'Runner is on release v0.2.0. Minimum version required: v0.3.0',
    description: 'Why the host will not run it, when it will not',
  })
  readonly unavailableReason?: string;
}

export class HostSandboxRequestDto {
  @ApiProperty({
    example: '5d2e8f1a-7c4b-4e9a-b3f6-1a8d0c7e2b95',
    description: 'The sandbox Spotlight named when it assigned the run',
  })
  readonly id!: string;
}

export class HostHeartbeatRequestDto {
  @ApiProperty({
    example: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P',
    description: 'New each time the host starts, so a restart shows as one',
  })
  readonly bootId!: string;

  @ApiProperty({
    example: 'build-box-1',
    description: 'What the host calls itself, usually its hostname',
  })
  readonly name!: string;

  @ApiProperty({
    example: 'v1.4.0',
    description: 'The spotlight release it runs',
  })
  readonly release!: string;

  @ApiProperty({
    example: 'Docker Engine - Community 27.3.1 (linux/amd64)',
    description: 'The container runtime its sandboxes run in',
  })
  readonly containerRuntime!: string;

  @ApiProperty({
    example: 4,
    description: 'How many sandboxes it runs at once',
  })
  readonly capacity!: number;

  @ApiPropertyOptional({
    type: String,
    isArray: true,
    example: ['3f7c2a9e-1b64-4d8f-a5e0-9c2b7d4e1f86'],
    description: 'The one-run runners in its sandboxes now',
  })
  readonly running?: string[];

  @ApiPropertyOptional({
    type: [HostSandboxRequestDto],
    isArray: true,
    description: 'The sandboxes whose containers it has now',
  })
  readonly sandboxes?: HostSandboxRequestDto[];

  @ApiPropertyOptional({
    type: [HostImageRequestDto],
    isArray: true,
    description:
      'The runner images it supports or cannot use, each with what it found inside',
  })
  readonly images?: HostImageRequestDto[];

  @ApiPropertyOptional({
    example: false,
    description:
      'True when the host stopped claiming to update or restart. Spotlight then drains each of its sandboxes when no run holds it',
  })
  readonly stopping?: boolean;
}
