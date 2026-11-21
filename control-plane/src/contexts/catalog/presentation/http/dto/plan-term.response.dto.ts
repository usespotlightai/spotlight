import type { PlanTermDto } from '@catalog/application/dto/plan-term.dto';
import { PLANS } from '@catalog/domain/value-objects/plan.vo';
import { ApiProperty } from '@nestjs/swagger';

export const PLAN_EXPIRY =
  'When the plan ends; the workspace then has the free plan. Null when it does not end, and always for the free plan';

export class PlanTermResponseDto {
  @ApiProperty({ enum: PLANS, example: 'team' })
  readonly plan: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '2027-01-01T00:00:00.000Z',
    description: PLAN_EXPIRY,
  })
  readonly expiresAt: string | null;

  constructor(term: PlanTermDto) {
    this.plan = term.plan;
    this.expiresAt = term.expiresAt;
  }
}
