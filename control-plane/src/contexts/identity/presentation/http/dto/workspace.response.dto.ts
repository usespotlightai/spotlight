import {
  PROVISIONINGS,
  type Provisioning,
} from '@identity/application/ports/workspace-provisioning.port';
import { ApiProperty } from '@nestjs/swagger';

export class TeamResponseDto {
  @ApiProperty({ example: '9c2e6d5a-1f47-4c8b-9a3d-2b7e5f0c1d84' })
  readonly id: string;

  @ApiProperty({ example: 'Acme Inc.' })
  readonly name: string;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
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
      'Whether Spotlight has opened the first team of the workspace. The value is failed after Spotlight stopped its attempts.',
    enum: PROVISIONINGS,
    example: 'done',
  })
  readonly provisioning: Provisioning;

  constructor(
    id: string,
    name: string,
    slug: string,
    teams: TeamResponseDto[],
    role: string,
    provisioning: Provisioning,
  ) {
    this.id = id;
    this.name = name;
    this.slug = slug;
    this.teams = teams;
    this.role = role;
    this.provisioning = provisioning;
  }
}

export class WorkspaceListingResponseDto {
  @ApiProperty({ example: '5f1c2f0e-6e0a-4a1e-9a4a-0f6d2c1b8e77' })
  readonly id: string;

  @ApiProperty({ example: 'Acme Inc.' })
  readonly name: string;

  @ApiProperty({ example: 'acme-inc' })
  readonly slug: string;

  @ApiProperty({ example: 'owner', enum: ['owner', 'admin', 'member'] })
  readonly role: string;

  constructor(id: string, name: string, slug: string, role: string) {
    this.id = id;
    this.name = name;
    this.slug = slug;
    this.role = role;
  }
}
