import type { PlanTermDto } from '@catalog/application/dto/plan-term.dto';

export interface WorkspaceSummaryDto {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly createdAt: string;
  readonly memberCount: number;
  readonly plan: PlanTermDto;
}

export interface WorkspaceSummaryPageDto {
  readonly items: readonly WorkspaceSummaryDto[];
  readonly next: string | null;
}
