import {
  REPOSITORY_ACCESS,
  type RepositoryAccessPort,
} from '@github/application/ports/repository-access.port';
import type {
  DefaultBranchDto,
  RepositorySettingsPort,
  VariablesWrite,
} from '@github/application/ports/repository-settings.port';
import {
  answered,
  call,
  sending,
} from '@github/infrastructure/github/github.rest';
import { Inject, Injectable } from '@nestjs/common';
import { UpstreamError } from '@shared-kernel/domain/exceptions/upstream.error';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const NOT_FOUND = 404;

const FORBIDDEN = 403;

const PULL_REQUEST_RULE = 'pull_request';

interface Branch {
  readonly protected?: boolean;
}

interface BranchRule {
  readonly type?: string;
}

@Injectable()
export class GitHubRepositorySettings implements RepositorySettingsPort {
  constructor(
    @Inject(REPOSITORY_ACCESS)
    private readonly access: RepositoryAccessPort,
  ) {}

  async defaultBranchOf(
    workspaceId: WorkspaceId,
    repository: Repository,
  ): Promise<DefaultBranchDto> {
    const token = await this.tokenFor(workspaceId);
    const { default_branch: name } = await answered<{
      default_branch: string;
    }>(
      await call(this.at(repository), token),
      `GitHub would not return the default branch of ${repository.value}`,
    );

    const [branch, rules] = await Promise.all([
      call(`${this.at(repository)}/branches/${encodeURI(name)}`, token).then(
        (response) =>
          answered<Branch>(
            response,
            `GitHub would not return the branch ${name} of ${repository.value}`,
          ),
      ),
      call(
        `${this.at(repository)}/rules/branches/${encodeURI(name)}`,
        token,
      ).then((response) =>
        answered<BranchRule[]>(
          response,
          `GitHub would not return the rules on ${name} of ${repository.value}`,
        ),
      ),
    ]);

    return {
      name,
      protected:
        branch.protected === true ||
        rules.some((rule) => rule.type === PULL_REQUEST_RULE),
    };
  }

  async putVariables(
    workspaceId: WorkspaceId,
    repository: Repository,
    variables: Readonly<Record<string, string>>,
  ): Promise<VariablesWrite> {
    const token = await this.tokenFor(workspaceId);

    for (const [name, value] of Object.entries(variables)) {
      try {
        await this.putVariable(repository, token, name, value);
      } catch (error) {
        if (this.notPermitted(error)) {
          return 'not-permitted';
        }
        throw error;
      }
    }

    return 'written';
  }

  private async putVariable(
    repository: Repository,
    token: string,
    name: string,
    value: string,
  ): Promise<void> {
    const operation = `GitHub would not set the Actions variable ${name} of ${repository.value}`;
    const updated = await call(
      `${this.at(repository)}/actions/variables/${encodeURIComponent(name)}`,
      token,
      { ...sending({ name, value }), method: 'PATCH' },
    );

    if (updated.status !== NOT_FOUND) {
      await answered(updated, operation);
      return;
    }

    await answered(
      await call(
        `${this.at(repository)}/actions/variables`,
        token,
        sending({ name, value }),
      ),
      operation,
    );
  }

  private notPermitted(error: unknown): boolean {
    return (
      error instanceof UpstreamError &&
      error.status === FORBIDDEN &&
      !error.retryable
    );
  }

  private at(repository: Repository): string {
    return `/repos/${repository.owner}/${repository.name}`;
  }

  private async tokenFor(workspaceId: WorkspaceId): Promise<string> {
    const { password } = await this.access.credential(workspaceId);

    return password;
  }
}
