import type { CatalogItemDto } from '@catalog/application/dto/catalog-item.dto';
import { ApiProperty } from '@nestjs/swagger';

export class CatalogToolResponseDto {
  @ApiProperty({
    example: 'catalog.web-search@1.1.0',
    description:
      'What a station gives it by; it carries the version, so an upgrade shows as a change to the station',
  })
  readonly id: string;

  @ApiProperty({ example: 'web-search' })
  readonly name: string;

  @ApiProperty({
    example: '1.1.0',
    description: 'The newest version the constraint accepts',
  })
  readonly version: string;

  @ApiProperty({
    example: '~> 1.0',
    description: 'The constraint it was resolved against',
  })
  readonly constraint: string;

  @ApiProperty({
    example: 'team',
    enum: ['free', 'team', 'enterprise'],
    description: 'The plan it needs',
  })
  readonly plan: string;

  @ApiProperty({ example: 'Search the web, and answer with the pages…' })
  readonly description: string;

  constructor(item: CatalogItemDto) {
    this.id = item.id;
    this.name = item.name;
    this.version = item.version;
    this.constraint = item.constraint;
    this.plan = item.plan;
    this.description = item.description;
  }
}

export class CatalogSkillResponseDto extends CatalogToolResponseDto {
  @ApiProperty({
    type: String,
    isArray: true,
    example: ['catalog.web-search@1.1.0', 'catalog.fetch-page@1.0.0'],
    description:
      'The catalog tools it brings, given wherever the skill is; its files never leave Spotlight except into a run',
  })
  readonly tools: readonly string[];

  constructor(item: CatalogItemDto) {
    super(item);
    this.tools = item.tools;
  }
}
