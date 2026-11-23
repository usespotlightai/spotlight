import type { RepositorySettingsPort } from '@github/application/ports/repository-settings.port';
import { Branch } from '@work/domain/value-objects/branch.vo';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { RequestedBase } from '@work/domain/value-objects/requested-base.vo';

export const requestedBase = async (
  settings: Pick<RepositorySettingsPort, 'defaultBranchNameOf'>,
  line: LineMap,
  branch: Branch | null,
): Promise<RequestedBase | null> =>
  branch
    ? RequestedBase.of(
        branch,
        await Promise.all(
          line.repositories.all.map(async (repository) =>
            Branch.of(
              await settings.defaultBranchNameOf(line.workspaceId, repository),
            ),
          ),
        ),
      )
    : null;
