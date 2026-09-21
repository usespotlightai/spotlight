import type {
  GitAnswer,
  GitCall,
} from '@github/application/ports/repository-git.port';

export const GIT_GATEWAY = Symbol('GIT_GATEWAY');

export const GIT_SERVICES = ['git-upload-pack', 'git-receive-pack'] as const;

export type GitService = (typeof GIT_SERVICES)[number];

export interface GitGatewayPort {
  carry(
    runId: string,
    runnerId: string,
    repo: string,
    service: GitService,
    call: GitCall,
  ): Promise<GitAnswer | null>;
}
