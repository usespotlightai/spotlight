import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RegisteredHarnessRequestDto } from '@runners/presentation/http/dto/register-runner.request.dto';

export class HostPresenceRequestDto {
  @ApiProperty({
    example: 'build-box-1',
    description: 'What the host calls itself, usually its hostname',
  })
  readonly name!: string;

  @ApiProperty({
    example: 'v1.4.0',
    description: 'The spotlight-host release it runs',
  })
  readonly release!: string;

  @ApiProperty({
    example: 'Docker Engine - Community 27.3.1 (linux/amd64)',
    description: 'The container runtime its sandboxes run in',
  })
  readonly executor!: string;

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
    type: [RegisteredHarnessRequestDto],
    isArray: true,
    description:
      'The harnesses its runner images hold, each with the models it discovered',
  })
  readonly harnesses?: RegisteredHarnessRequestDto[];
}
