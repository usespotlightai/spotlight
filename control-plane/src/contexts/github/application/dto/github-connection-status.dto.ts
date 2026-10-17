export interface GitHubConnectionStatusDto {
  readonly connected: boolean;
  readonly installUrl: string | null;
}
