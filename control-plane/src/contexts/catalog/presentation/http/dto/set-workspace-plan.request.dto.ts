import { PLANS } from '@catalog/domain/value-objects/plan.vo';
import { ApiProperty } from '@nestjs/swagger';

export class SetWorkspacePlanRequestDto {
  @ApiProperty({ enum: PLANS, example: 'team' })
  readonly plan!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    required: false,
    example: '2027-01-01T00:00:00.000Z',
    description:
      'When the plan ends, as an ISO 8601 time; the workspace then has the free plan. Null or left out when it does not end',
  })
  readonly expiresAt?: string | null;
}
