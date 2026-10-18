import { ApiProperty } from '@nestjs/swagger';
import { HarnessProbeResponseDto } from '@work/presentation/http/dto/harness-probe.response.dto';

export class RunnerReleaseResponseDto {
  @ApiProperty({
    example: '20260925-01',
    description:
      'The oldest runner release this control plane works with; a host cannot use an image whose runner is older',
  })
  readonly minimum: string;

  constructor(minimum: string) {
    this.minimum = minimum;
  }
}

export class HostRequirementsResponseDto {
  @ApiProperty({ type: RunnerReleaseResponseDto })
  readonly runner: RunnerReleaseResponseDto;

  @ApiProperty({
    type: [HarnessProbeResponseDto],
    description: 'What a host looks for in each runner image',
  })
  readonly harnesses: readonly HarnessProbeResponseDto[];

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['ghcr.io/acme/api-runner:main'],
    description:
      'The images this workspace’s lines name; a host serves those its allow-list allows, beside its default',
  })
  readonly images: readonly string[];

  constructor(
    runner: RunnerReleaseResponseDto,
    harnesses: readonly HarnessProbeResponseDto[],
    images: readonly string[],
  ) {
    this.runner = runner;
    this.harnesses = harnesses;
    this.images = images;
  }
}
