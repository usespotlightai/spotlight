import type { WorkspaceSetupStatus } from '@identity/domain/aggregates/workspace.aggregate';

interface TeamDto {
  readonly id: string;
  readonly name: string;
}

export interface WorkspaceDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly teams: readonly TeamDto[];
}

interface TeamWithAvatarDto extends TeamDto {
  readonly avatarDigest: string | null;
}

export interface WorkspaceDetailDto extends WorkspaceDto {
  readonly avatarDigest: string | null;
  readonly teams: readonly TeamWithAvatarDto[];
  readonly role: string;
  readonly setupStatus: WorkspaceSetupStatus;
}

export interface WorkspaceListingDto {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
  readonly avatarDigest: string | null;
  readonly role: string;
}
