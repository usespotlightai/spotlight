export const GITHUB_APP = Symbol('GITHUB_APP');

export interface GitHubAppPort {
  installUrl(): Promise<string | null>;
}
