import { ApiProperty } from '@nestjs/swagger';
import type {
  LeasedRunDto,
  LeasedRunStationDto,
  RunnerActivityDto,
} from '@runs/application/dto/runner-activity.dto';

export class LeasedRunStationResponseDto {
  @ApiProperty({ example: '5b2e8c1f-7a3d-4e9b-b6c0-2f1d8a4e7c35' })
  readonly lineId: string;

  @ApiProperty({ example: '9c4a1e7b-3f2d-4b8e-a5c6-7d0e1f2a3b48' })
  readonly stationId: string;

  constructor(station: LeasedRunStationDto) {
    this.lineId = station.lineId;
    this.stationId = station.stationId;
  }
}

export class LeasedRunResponseDto {
  @ApiProperty({ example: '3f9c1b7e-52a4-4d6f-8e1b-0a7c4d2f9b63' })
  readonly id: string;

  @ApiProperty({ example: 'claimed' })
  readonly state: string;

  @ApiProperty({
    example: 'task',
    description:
      'The kind of work the run is for, as the requester that ordered it names it, for example task, chat or spec',
  })
  readonly kind: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The team the run is for; null where it is for none',
  })
  readonly teamId: string | null;

  @ApiProperty({
    description:
      'Whether the caller reads the run’s team, and so may see its title and open it; false where the run is for no team',
  })
  readonly readable: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'The title the run’s requester gives it; null where the requester gives none, or where the caller cannot read the run’s team',
  })
  readonly title: string | null;

  @ApiProperty({
    type: LeasedRunStationResponseDto,
    nullable: true,
    description:
      'The station the run’s requester places it at, such as the station a replay run replays a config of; null where the requester names none, or where the caller cannot read the run’s team',
  })
  readonly station: LeasedRunStationResponseDto | null;

  constructor(run: LeasedRunDto) {
    this.id = run.id;
    this.state = run.state;
    this.kind = run.kind;
    this.teamId = run.teamId;
    this.readable = run.readable;
    this.title = run.title;
    this.station = run.station
      ? new LeasedRunStationResponseDto(run.station)
      : null;
  }
}

export class BusyRunnerResponseDto {
  @ApiProperty({ example: '8a1d4e0b-6c72-4f35-9b8a-1e5d3c7f2a49' })
  readonly runnerId: string;

  @ApiProperty({
    type: LeasedRunResponseDto,
    description: 'The run the runner is working on',
  })
  readonly currentRun: LeasedRunResponseDto;

  constructor(runnerId: string, currentRun: LeasedRunResponseDto) {
    this.runnerId = runnerId;
    this.currentRun = currentRun;
  }
}

export class WorkingCopyResponseDto {
  @ApiProperty({
    example: 'work/task-3f9c1b7e-52a4-4d6f-8e1b-0a7c4d2f9b63',
    description: 'The working copy that an idle sandbox keeps',
  })
  readonly workingCopyKey: string;

  @ApiProperty({
    type: LeasedRunResponseDto,
    description: 'The last run that used the working copy',
  })
  readonly lastRun: LeasedRunResponseDto;

  constructor(workingCopyKey: string, lastRun: LeasedRunResponseDto) {
    this.workingCopyKey = workingCopyKey;
    this.lastRun = lastRun;
  }
}

export class RunnerActivityResponseDto {
  @ApiProperty({
    type: [BusyRunnerResponseDto],
    description:
      'Each runner with a lease on a run. A runner with no lease is idle, and is not listed.',
  })
  readonly runners: readonly BusyRunnerResponseDto[];

  @ApiProperty({
    type: [WorkingCopyResponseDto],
    description: 'The last run of each working copy that an idle sandbox keeps',
  })
  readonly workingCopies: readonly WorkingCopyResponseDto[];

  constructor(activity: RunnerActivityDto) {
    this.runners = activity.runners.map(
      (each) =>
        new BusyRunnerResponseDto(
          each.runnerId,
          new LeasedRunResponseDto(each.currentRun),
        ),
    );
    this.workingCopies = activity.workingCopies.map(
      (each) =>
        new WorkingCopyResponseDto(
          each.workingCopyKey,
          new LeasedRunResponseDto(each.lastRun),
        ),
    );
  }
}
