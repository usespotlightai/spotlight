import type {
  WorkspaceSummaryDto,
  WorkspaceSummaryPageDto,
} from '@catalog/application/dto/workspace-summary.dto';
import { PlanTermResponseDto } from '@catalog/presentation/http/dto/plan-term.response.dto';
import { ApiProperty } from '@nestjs/swagger';

export class WorkspaceSummaryResponseDto {
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
    type: PlanTermResponseDto,
    description:
      'The plan set for the workspace; the free plan when none is set',
  })
  readonly plan: PlanTermResponseDto;

  constructor(workspace: WorkspaceSummaryDto) {
    this.id = workspace.id;
    this.slug = workspace.slug;
    this.name = workspace.name;
    this.createdAt = workspace.createdAt;
    this.memberCount = workspace.memberCount;
    this.plan = new PlanTermResponseDto(workspace.plan);
  }
}

export class WorkspaceSummaryPageResponseDto {
  @ApiProperty({
    type: WorkspaceSummaryResponseDto,
    isArray: true,
    description: 'Oldest first',
  })
  readonly items: readonly WorkspaceSummaryResponseDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Pass as `after` to read the next page; null on the last',
  })
  readonly next: string | null;

  constructor(page: WorkspaceSummaryPageDto) {
    this.items = page.items.map(
      (each) => new WorkspaceSummaryResponseDto(each),
    );
    this.next = page.next;
  }
}
