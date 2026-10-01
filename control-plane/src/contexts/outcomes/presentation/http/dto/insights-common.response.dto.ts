import { ApiProperty } from '@nestjs/swagger';
import type {
  PeriodDto,
  PersonNameDto,
  SpreadDto,
} from '@outcomes/application/dto/insights.dto';
import { INSIGHTS_PERIODS } from '@outcomes/domain/value-objects/insights-period.vo';

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
