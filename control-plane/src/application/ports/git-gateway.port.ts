import type {
  GitAnswer,
  GitCall,
} from '@application/ports/repository-git.port';

export const GIT_GATEWAY = Symbol('GIT_GATEWAY');

/** Which repository this reaches is settled behind it. */
export interface GitGatewayPort {
  carry(
    runId: string,
    runnerId: string,
    call: GitCall,
  ): Promise<GitAnswer | null>;
}
