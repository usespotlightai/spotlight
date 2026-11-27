export interface GitHubInstallationDto {
  readonly id: string;
  readonly account: string;
  readonly usedElsewhere: boolean;
  // The workspace that uses it, where the caller may see that workspace.
  readonly usedBy: string | null;
}
