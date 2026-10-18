import { ApiProperty } from '@nestjs/swagger';
import { HarnessProbeResponseDto } from '@work/presentation/http/dto/harness-probe.response.dto';

export class HostReleaseResponseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: '20261018-01',
    description:
      'The release this control plane runs; a host on another release updates to it, unless the operator turned that off. Null when the control plane does not know its release',
  })
  readonly release: string | null;

  @ApiProperty({
    example: '20261002-02',
    description:
      'The oldest host release this control plane gives work to; an older host gets no work until it updates',
  })
  readonly minimum: string;

  constructor(release: string | null, minimum: string) {
    this.release = release;
    this.minimum = minimum;
  }
}

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
  @ApiProperty({ type: HostReleaseResponseDto })
  readonly host: HostReleaseResponseDto;

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
    host: HostReleaseResponseDto,
    runner: RunnerReleaseResponseDto,
    harnesses: readonly HarnessProbeResponseDto[],
    images: readonly string[],
  ) {
    this.host = host;
    this.runner = runner;
    this.harnesses = harnesses;
    this.images = images;
  }
}
