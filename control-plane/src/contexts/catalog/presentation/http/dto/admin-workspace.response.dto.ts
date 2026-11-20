import type {
  PlanTermDto,
  WorkspaceSummaryDto,
  WorkspaceSummaryPageDto,
} from '@catalog/application/dto/workspace-summary.dto';
import { PLANS } from '@catalog/domain/value-objects/plan.vo';
import { ApiProperty } from '@nestjs/swagger';

const PLAN_EXPIRY =
  'When the plan ends; the workspace then has the free plan. Null when it does not end';

export class AdminWorkspaceResponseDto {
  @ApiProperty({ example: '5b1e9d2c-7a43-4f8e-b6c0-3d9a8e1f2b57' })
  readonly id: string;

  @ApiProperty({ example: 'acme-inc' })
  readonly slug: string;

  @ApiProperty({ example: 'Acme Inc' })
  readonly name: string;

  @ApiProperty({ example: '2026-09-12T09:00:00.000Z' })
  readonly createdAt: string;

  @ApiProperty({ example: 4, description: 'How many people are in it' })
  readonly memberCount: number;

  @ApiProperty({
    enum: PLANS,
    example: 'team',
    description: 'The plan set for the workspace; free when none is set',
  })
  readonly plan: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: '2027-01-01T00:00:00.000Z',
    description: PLAN_EXPIRY,
  })
  readonly planExpiresAt: string | null;

  constructor(workspace: WorkspaceSummaryDto) {
    this.id = workspace.id;
    this.slug = workspace.slug;
    this.name = workspace.name;
    this.createdAt = workspace.createdAt;
    this.memberCount = workspace.memberCount;
    this.plan = workspace.plan;
    this.planExpiresAt = workspace.planExpiresAt;
  }
}

export class AdminWorkspacePageResponseDto {
  @ApiProperty({
    type: AdminWorkspaceResponseDto,
    isArray: true,
    description: 'Oldest first',
  })
  readonly items: readonly AdminWorkspaceResponseDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Pass as `after` to read the next page; null on the last',
  })
  readonly next: string | null;

  constructor(page: WorkspaceSummaryPageDto) {
    this.items = page.items.map((each) => new AdminWorkspaceResponseDto(each));
    this.next = page.next;
  }
}

export class WorkspacePlanResponseDto {
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
