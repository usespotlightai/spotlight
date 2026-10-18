import {
  type MeasureVerdict,
  MIN_MEASURED_RUNS,
  VERDICTS,
} from '@insights/domain/services/change-verdict';
import { ALERT_MEASURES } from '@insights/domain/value-objects/alert-rule.vo';
import {
  DeltaResponseDto,
  deltaResponseOf,
} from '@insights/presentation/http/dto/insights-common.response.dto';
import { ApiProperty } from '@nestjs/swagger';

export class MeasureVerdictResponseDto {
  @ApiProperty({ enum: ALERT_MEASURES })
  readonly measure: string;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.4,
    description:
      'The measure over the measured runs compared against: a share, or a cost per run',
  })
  readonly before: number | null;

  @ApiProperty({
    nullable: true,
    type: Number,
    example: 0.6,
    description: 'The measure over the measured runs compared',
  })
  readonly after: number | null;

  @ApiProperty({
    example: 12,
    description:
      'Runs compared against whose outcome for this measure is known',
  })
  readonly measuredBefore: number;

  @ApiProperty({
    example: 9,
    description: 'Runs compared whose outcome for this measure is known',
  })
  readonly measuredAfter: number;

  @ApiProperty({
    nullable: true,
    type: String,
    example: 'USD',
    description: 'The currency of a cost per run; none for a share',
  })
  readonly currency: string | null;

  @ApiProperty({
    enum: VERDICTS,
    description: `Whether the runs compared did better, worse or the same; insufficient below ${MIN_MEASURED_RUNS} measured runs on either side, or where the costs are in different currencies`,
  })
  readonly verdict: string;

  @ApiProperty({
    type: DeltaResponseDto,
    nullable: true,
    description:
      'How far the measure moved: a share in points, a cost per run in percent; none where either side is unknown or the costs are in different currencies',
  })
  readonly change: DeltaResponseDto | null;

  constructor(verdict: MeasureVerdict) {
    this.measure = verdict.measure;
    this.before = verdict.before;
    this.after = verdict.after;
    this.measuredBefore = verdict.measuredBefore;
    this.measuredAfter = verdict.measuredAfter;
    this.currency = verdict.currency;
    this.verdict = verdict.verdict;
    this.change = deltaResponseOf(verdict.change);
  }
}
