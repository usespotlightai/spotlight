import type {
  DeltaDto,
  PeriodDto,
  PersonNameDto,
  SpreadDto,
} from '@insights/application/dto/insights.dto';
import {
  DELTA_DIRECTIONS,
  DELTA_TONES,
  DELTA_UNITS,
} from '@insights/domain/value-objects/delta.vo';
import { INSIGHTS_PERIODS } from '@insights/domain/value-objects/insights-period.vo';
import { ApiProperty } from '@nestjs/swagger';

export class InsightsPeriodResponseDto {
  @ApiProperty({ enum: INSIGHTS_PERIODS, example: '30d' })
  readonly name: string;

  @ApiProperty({
    example: '2026-09-02T00:00:00.000Z',
    description:
      'Where the period starts: the start of a UTC day, so the period is whole days',
  })
  readonly from: string;

  @ApiProperty({
    example: '2026-10-02T00:00:00.000Z',
    description: 'Where the period ends, exclusive: the start of tomorrow, UTC',
  })
  readonly to: string;

  @ApiProperty({
    example: '2026-08-03T00:00:00.000Z',
    description: 'Where the period before it, as long, starts',
  })
  readonly previousFrom: string;

  @ApiProperty({
    example: '2026-09-02T00:00:00.000Z',
    description: 'Where the period before it ends, exclusive',
  })
  readonly previousTo: string;

  @ApiProperty({
    type: String,
    isArray: true,
    example: ['2026-09-30', '2026-10-01'],
    description: 'Every UTC day in the period, oldest first',
  })
  readonly days: readonly string[];

  constructor(period: PeriodDto) {
    this.name = period.name;
    this.from = period.from;
    this.to = period.to;
    this.previousFrom = period.previousFrom;
    this.previousTo = period.previousTo;
    this.days = period.days;
  }
}

export class PersonNameResponseDto {
  @ApiProperty({ example: 'user_ada' })
  readonly personId: string;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'Ada Lovelace',
    description: 'Their name, where they still have an account',
  })
  readonly name: string | null;

  constructor(person: PersonNameDto) {
    this.personId = person.personId;
    this.name = person.name;
  }
}

export class SpreadResponseDto {
  @ApiProperty({
    nullable: true,
    type: Number,
    example: 120_000,
    description: 'The median, in milliseconds; none when nothing was measured',
  })
  readonly p50Ms: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 900_000,
    description: 'What nine in ten stayed within, in milliseconds',
  })
  readonly p90Ms: number | null;

  @ApiProperty({ example: 14, description: 'How many were measured' })
  readonly count: number;

  constructor(spread: SpreadDto) {
    this.p50Ms = spread.p50Ms;
    this.p90Ms = spread.p90Ms;
    this.count = spread.count;
  }
}

export class DeltaResponseDto {
  @ApiProperty({
    enum: DELTA_UNITS,
    example: 'percent',
    description:
      'percent: moved by a share of what it was; points: a rate or share that moved by percentage points',
  })
  readonly unit: string;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.2,
    description:
      'How far it moved, as a fraction: 0.2 is 20% for percent and 20 points for points; none when it rose from 0',
  })
  readonly by: number | null;

  @ApiProperty({
    example: false,
    description: 'Whether it rose from 0, so no percent can be given',
  })
  readonly fromZero: boolean;

  @ApiProperty({ enum: DELTA_DIRECTIONS, example: 'up' })
  readonly direction: string;

  @ApiProperty({
    enum: DELTA_TONES,
    example: 'good',
    description:
      'Whether the move is good or bad for the team; flat where neither way is better or nothing moved',
  })
  readonly tone: string;

  constructor(delta: DeltaDto) {
    this.unit = delta.unit;
    this.by = delta.by;
    this.fromZero = delta.fromZero;
    this.direction = delta.direction;
    this.tone = delta.tone;
  }
}

export const deltaResponseOf = (
  delta: DeltaDto | null,
): DeltaResponseDto | null => (delta ? new DeltaResponseDto(delta) : null);
