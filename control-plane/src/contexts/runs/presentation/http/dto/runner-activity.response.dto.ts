import { ApiProperty } from '@nestjs/swagger';
import type {
  LeasedRunDto,
  RunnerActivityDto,
} from '@runs/application/dto/runner-activity.dto';

export class OpenedRunResponseDto {
  @ApiProperty({ example: '3f9c1b7e-52a4-4d6f-8e1b-0a7c4d2f9b63' })
  readonly runId: string;

  @ApiProperty({ example: 'K7Q2M4ZC3VYH6N5RB8WX1TDJ9P' })
  readonly teamId: string;

  constructor(runId: string, teamId: string) {
    this.runId = runId;
    this.teamId = teamId;
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
      'The kind of work the run is for, as the requester that ordered it names it, for example task, chat or session',
  })
  readonly kind: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'The team the run is for; null where it is for none',
  })
  readonly teamId: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Judging Implementation on “Incident owners 2/5”',
    description:
      'What the run does, in plain words: the title of its task or chat, or what the work for that task does. Null where it is hidden from the caller, or its requester names nothing',
  })
  readonly title: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description:
      'What the caller sees in place of the title they may not read, such as that the work belongs to a team they are not on. Null where the title shows',
  })
  readonly hidden: string | null;

  @ApiProperty({
    type: OpenedRunResponseDto,
    nullable: true,
    description:
      'The run the title opens: the run itself, or the task run its work is for. Null where it opens none',
  })
  readonly opens: OpenedRunResponseDto | null;

  constructor(run: LeasedRunDto) {
    this.id = run.id;
    this.state = run.state;
    this.kind = run.kind;
    this.teamId = run.teamId;
    this.title = run.title;
    this.hidden = run.hidden;
    this.opens = run.opens
      ? new OpenedRunResponseDto(run.opens.runId, run.opens.teamId)
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
