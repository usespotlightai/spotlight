import { ApiProperty } from '@nestjs/swagger';
import {
  FEWEST_SETTLED_RUNS,
  type MeasureVerdict,
  VERDICTS,
} from '@outcomes/domain/services/change-verdict';
import { ALERT_MEASURES } from '@outcomes/domain/value-objects/alert-rule.vo';

export class MeasureVerdictResponseDto {
  @ApiProperty({ enum: ALERT_MEASURES })
  readonly measure: string;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.4,
    description:
      'The measure over the settled runs compared against: a share, or a cost per run',
  })
  readonly before: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.6,
    description: 'The measure over the settled runs compared',
  })
  readonly after: number | null;

  @ApiProperty({
    example: 12,
    description:
      'Runs compared against whose outcome for this measure is known',
  })
  readonly settledBefore: number;

  @ApiProperty({
    example: 9,
    description: 'Runs compared whose outcome for this measure is known',
  })
  readonly settledAfter: number;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'USD',
    description: 'The currency of a cost per run; none for a share',
  })
  readonly currency: string | null;

  @ApiProperty({
    enum: VERDICTS,
    description: `Whether the runs compared did better, worse or the same; insufficient below ${FEWEST_SETTLED_RUNS} settled runs on either side, or where the costs are in different currencies`,
  })
  readonly verdict: string;

  constructor(verdict: MeasureVerdict) {
    this.measure = verdict.measure;
    this.before = verdict.before;
    this.after = verdict.after;
    this.settledBefore = verdict.settledBefore;
    this.settledAfter = verdict.settledAfter;
    this.currency = verdict.currency;
    this.verdict = verdict.verdict;
  }
}
