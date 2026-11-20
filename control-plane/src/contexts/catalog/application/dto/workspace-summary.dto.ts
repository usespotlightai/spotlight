export interface PlanTermDto {
  readonly plan: string;
  readonly expiresAt: string | null;
}

export interface WorkspaceSummaryDto {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly createdAt: string;
  readonly memberCount: number;
  readonly plan: string;
  readonly planExpiresAt: string | null;
}

export interface WorkspaceSummaryPageDto {
  readonly items: readonly WorkspaceSummaryDto[];
  readonly next: string | null;
}
