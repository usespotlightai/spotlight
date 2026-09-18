import type {
  GitAnswer,
  GitCall,
} from '@github/application/ports/repository-git.port';

export const GIT_GATEWAY = Symbol('GIT_GATEWAY');

export interface GitGatewayPort {
  carry(
    runId: string,
    runnerId: string,
    repo: string,
    call: GitCall,
  ): Promise<GitAnswer | null>;
}
