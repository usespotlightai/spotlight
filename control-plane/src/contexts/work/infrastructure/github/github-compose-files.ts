import type { RepositoryContentsPort } from '@github/application/ports/repository-contents.port';
import { checkoutPathOf } from '@runs/application/contracts/run-spec.contract';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type {
  ComposeFilesPort,
  ServicesAt,
} from '@work/application/ports/compose-files.port';
import {
  COMPOSE_FILES,
  type ComposeFile,
} from '@work/domain/services/compose-services';
import {
  COMPOSE_ENV_FILE,
  declaredServicesOf,
  envFileOf,
} from '@work/infrastructure/compose/compose-file';

const NAMES: readonly string[] = [...COMPOSE_FILES, COMPOSE_ENV_FILE];

export class GitHubComposeFiles implements ComposeFilesPort {
  constructor(private readonly contents: RepositoryContentsPort) {}

  async at(
    workspaceId: WorkspaceId,
    checkout: ServicesAt,
  ): Promise<readonly ComposeFile[]> {
    const top = await this.contents.topFiles(
      workspaceId,
      checkout.repository,
      NAMES,
      checkout.ref,
    );
    const env = envFileOf(
      top.files.find((file) => file.path === COMPOSE_ENV_FILE)?.content ?? '',
    );

    return top.files
      .filter((file) => file.path !== COMPOSE_ENV_FILE)
      .map((file) => ({
        from: `${checkoutPathOf(checkout.repository)}/${file.path}`,
        name: file.path,
        services: declaredServicesOf(file.content, env),
      }));
  }
}
