import {
  WORKSPACE_SETUP_STATUSES,
  type WorkspaceSetupStatus,
} from '@identity/domain/aggregates/workspace.aggregate';
import { ApiProperty } from '@nestjs/swagger';

export class TeamResponseDto {
  @ApiProperty({ example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  readonly id: string;

  @ApiProperty({ example: 'Acme Inc.' })
  readonly name: string;

  @ApiProperty({
    description: 'Where to read its avatar, or null when it has none.',
    type: String,
    nullable: true,
    example:
      '/api/teams/9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84/avatar/9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  })
  readonly avatarUrl: string | null;

  constructor(id: string, name: string, avatarUrl: string | null) {
    this.id = id;
    this.name = name;
    this.avatarUrl = avatarUrl;
  }
}

export class CreatedWorkspaceResponseDto {
  @ApiProperty({ example: '5f1c2f0e-6e0a-4a1e-9a4a-0f6d2c1b8e77' })
  readonly id: string;

  @ApiProperty({ example: 'Acme Inc.' })
  readonly name: string;

  @ApiProperty({ example: 'acme-inc' })
  readonly slug: string;

  @ApiProperty({ type: TeamResponseDto, isArray: true })
  readonly teams: TeamResponseDto[];

  constructor(
    id: string,
    name: string,
    slug: string,
    teams: TeamResponseDto[],
  ) {
    this.id = id;
    this.name = name;
    this.slug = slug;
    this.teams = teams;
  }
}

export class WorkspaceResponseDto {
  @ApiProperty({ example: '5f1c2f0e-6e0a-4a1e-9a4a-0f6d2c1b8e77' })
  readonly id: string;

  @ApiProperty({ example: 'Acme Inc.' })
  readonly name: string;

  @ApiProperty({ example: 'acme-inc' })
  readonly slug: string;

  @ApiProperty({
    description: 'Where to read its avatar, or null when it has none.',
    type: String,
    nullable: true,
    example:
      '/api/workspaces/acme-inc/avatar/9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  })
  readonly avatarUrl: string | null;

  @ApiProperty({ type: TeamResponseDto, isArray: true })
  readonly teams: TeamResponseDto[];

  @ApiProperty({
    description: 'What the caller is in this workspace.',
    example: 'owner',
    enum: ['owner', 'admin', 'member'],
  })
  readonly role: string;

  @ApiProperty({
    description:
      'Whether Spotlight has created the first team of the workspace.',
    enum: WORKSPACE_SETUP_STATUSES,
    example: 'done',
  })
  readonly setupStatus: WorkspaceSetupStatus;

  constructor(
    id: string,
    name: string,
    slug: string,
    avatarUrl: string | null,
    teams: TeamResponseDto[],
    role: string,
    setupStatus: WorkspaceSetupStatus,
  ) {
    this.id = id;
    this.name = name;
    this.slug = slug;
    this.avatarUrl = avatarUrl;
    this.teams = teams;
    this.role = role;
    this.setupStatus = setupStatus;
  }
}

export class WorkspaceListingResponseDto {
  @ApiProperty({ example: '5f1c2f0e-6e0a-4a1e-9a4a-0f6d2c1b8e77' })
  readonly id: string;

  @ApiProperty({ example: 'Acme Inc.' })
  readonly name: string;

  @ApiProperty({ example: 'acme-inc' })
  readonly slug: string;

  @ApiProperty({
    description: 'Where to read its avatar, or null when it has none.',
    type: String,
    nullable: true,
    example:
      '/api/workspaces/acme-inc/avatar/9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
  })
  readonly avatarUrl: string | null;

  @ApiProperty({ example: 'owner', enum: ['owner', 'admin', 'member'] })
  readonly role: string;

  constructor(
    id: string,
    name: string,
    slug: string,
    avatarUrl: string | null,
    role: string,
  ) {
    this.id = id;
    this.name = name;
    this.slug = slug;
    this.avatarUrl = avatarUrl;
    this.role = role;
  }
}
