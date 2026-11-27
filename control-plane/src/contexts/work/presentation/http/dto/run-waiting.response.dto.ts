import { ApiProperty } from '@nestjs/swagger';
import {
  RUN_WAIT_REASON_NAMES,
  type RunWaitingDto,
} from '@work/application/dto/run-waiting.dto';

export class QuietHostsResponseDto {
  @ApiProperty({
    type: String,
    isArray: true,
    example: ['dev-host'],
    description:
      'The hosts that could take it, none of which reports in; empty when none is left',
  })
  readonly hosts: readonly string[];

  @ApiProperty({
    type: String,
    nullable: true,
    example: '2026-11-27T20:00:00.000Z',
    description:
      'When Spotlight last heard from one of them; null when none is left to hear from',
  })
  readonly since: string | null;

  constructor(hosts: readonly string[], since: string | null) {
    this.hosts = hosts;
    this.since = since;
  }
}

export class RunWaitingResponseDto {
  @ApiProperty({
    enum: RUN_WAIT_REASON_NAMES,
    example: 'no-pool-has-room',
    description:
      'Why Spotlight starts no runner for it: only the hosts of a pull pool or a trust take it (hosts-pull), only such hosts take it and none of them reports in (hosts-offline), the pools that fit it run all the runs they can (no-pool-has-room), only the platform pool could take it and the operator does not let it (platform-pool-not-allowed), or no pool fits it (no-pool-matches)',
  })
  readonly reason: string;

  @ApiProperty({
    example: '2026-08-28T16:32:47.877Z',
    description:
      'When Spotlight first saw this reason since the run was last queued',
  })
  readonly since: string;

  @ApiProperty({
    type: QuietHostsResponseDto,
    nullable: true,
    description: 'The offline hosts it waits for; set for hosts-offline',
  })
  readonly quiet: QuietHostsResponseDto | null;

  constructor(
    reason: string,
    since: string,
    quiet: QuietHostsResponseDto | null,
  ) {
    this.reason = reason;
    this.since = since;
    this.quiet = quiet;
  }

  static of(dto: RunWaitingDto | null): RunWaitingResponseDto | null {
    return dto
      ? new RunWaitingResponseDto(
          dto.reason,
          dto.since,
          dto.quiet &&
            new QuietHostsResponseDto(dto.quiet.hosts, dto.quiet.since),
        )
      : null;
  }
}
