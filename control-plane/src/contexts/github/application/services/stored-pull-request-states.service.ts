import type {
  PullRequestStatesPort,
  StoredPullRequestStateDto,
} from '@github/application/ports/pull-request-states.port';
import type {
  NumberedPullRequest,
  PullRequestStatusReaderPort,
} from '@github/application/ports/pull-request-status-reader.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const keyOf = ({ repository, number }: NumberedPullRequest): string =>
  `${repository.value.toLowerCase()}#${number}`;

const numberedOf = (url: PullRequestUrl): NumberedPullRequest | null => {
  const { repository, number } = url;

  return repository && number !== null ? { repository, number } : null;
};

export class StoredPullRequestStates implements PullRequestStatesPort {
  constructor(private readonly reader: PullRequestStatusReaderPort) {}

  async of(
    workspaceId: WorkspaceId,
    urls: readonly PullRequestUrl[],
  ): Promise<readonly StoredPullRequestStateDto[]> {
    const asked = urls.flatMap((url) => {
      const numbered = numberedOf(url);

      return numbered ? [{ url, numbered }] : [];
    });
    const found = await this.reader.statusesOf(
      workspaceId,
      asked.map((each) => each.numbered),
    );
    const statuses = new Map(found.map((each) => [keyOf(each), each.status]));

    return asked.flatMap(({ url, numbered }) => {
      const status = statuses.get(keyOf(numbered));

      return status ? [{ url: url.value, state: status }] : [];
    });
  }
}
