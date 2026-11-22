import type {
  PullRequestSummariesPort,
  PullRequestSummaryDto,
} from '@github/application/ports/pull-request-summaries.port';
import type {
  NumberedPullRequest,
  PullRequestSummaryReaderPort,
} from '@github/application/ports/pull-request-summary-reader.port';
import type { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const keyOf = ({ repository, number }: NumberedPullRequest): string =>
  `${repository.value.toLowerCase()}#${number}`;

const numberedOf = (url: PullRequestUrl): NumberedPullRequest | null => {
  const { repository, number } = url;

  return repository && number !== null ? { repository, number } : null;
};

export class StoredPullRequestSummaries implements PullRequestSummariesPort {
  constructor(private readonly reader: PullRequestSummaryReaderPort) {}

  async of(
    workspaceId: WorkspaceId,
    urls: readonly PullRequestUrl[],
  ): Promise<readonly PullRequestSummaryDto[]> {
    const asked = urls.flatMap((url) => {
      const numbered = numberedOf(url);

      return numbered ? [{ url, numbered }] : [];
    });
    const found = await this.reader.summariesOf(
      workspaceId,
      asked.map((each) => each.numbered),
    );
    const summaries = new Map(found.map((each) => [keyOf(each), each]));

    return asked.flatMap(({ url, numbered }) => {
      const summary = summaries.get(keyOf(numbered));

      return summary
        ? [
            {
              url: url.value,
              state: summary.status,
              title: summary.title,
              author: summary.author,
              additions: summary.additions,
              deletions: summary.deletions,
              changedFiles: summary.changedFiles,
              updatedAt: summary.updatedAt,
            },
          ]
        : [];
    });
  }
}
