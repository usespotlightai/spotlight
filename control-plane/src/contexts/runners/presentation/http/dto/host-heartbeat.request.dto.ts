import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegisteredHarnessRequestDto } from '@runners/presentation/http/dto/register-runner.request.dto';

export class HostImageRequestDto {
  @ApiProperty({
    example: 'ghcr.io/acme/api-runner:main',
    description: 'The image as the host was asked to run it',
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
    example: '20260925-01',
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
    example:
      'Runner is on release 20260801-01. Minimum version required: 20260925-01',
    description: 'Why the host will not run it, when it will not',
  })
  readonly unavailableReason?: string;
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
    type: [HostImageRequestDto],
    isArray: true,
    description:
      'The runner images it serves or cannot use, each with what it found inside',
  })
  readonly images?: HostImageRequestDto[];
}
