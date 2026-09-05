export const GITHUB_APP = Symbol('GITHUB_APP');

export interface GitHubAppPort {
  /**
   * Where a person goes to install it, or null where GitHub would not say
   * what the App is called. Nothing depends on it but a link.
   */
  installUrl(): Promise<string | null>;
}
