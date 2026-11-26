import type {
  ConflictingPullRequestDto,
  PullRequestConflictsPort,
} from '@github/application/ports/pull-request-conflicts.port';
import type { RepositoryAccessPort } from '@github/application/ports/repository-access.port';
import { answered, call } from '@github/infrastructure/github/github.rest';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const PER_PAGE = 100;

const READS = 3;

const REREAD_AFTER_MS = 2_000;

interface Listed {
  readonly number?: number;
}

interface Read {
  readonly html_url?: string;
  readonly mergeable?: boolean | null;
  readonly head?: { readonly ref?: string };
}

export class GitHubPullRequestConflicts implements PullRequestConflictsPort {
  constructor(
    private readonly access: RepositoryAccessPort,
    private readonly clock: Pick<ClockPort, 'sleep'>,
  ) {}

  async conflictingWith(
    workspaceId: WorkspaceId,
    repository: Repository,
    base: string,
  ): Promise<readonly ConflictingPullRequestDto[]> {
    const { password: token } = await this.access.credential(workspaceId);
    const at = `/repos/${repository.owner}/${repository.name}`;
    const open = await answered<Listed[]>(
      await call(
        `${at}/pulls?state=open&base=${encodeURIComponent(base)}&per_page=${PER_PAGE}`,
        token,
      ),
      `GitHub would not list the open pull requests into ${base}`,
    );
    const conflicting: ConflictingPullRequestDto[] = [];
    let unknown = open.flatMap((each) => (each.number ? [each.number] : []));

    // GitHub computes mergeability after it is first asked, so a pull request it has not computed yet is read again.
    for (let read = 1; unknown.length > 0 && read <= READS; read += 1) {
      if (read > 1) {
        await this.clock.sleep(REREAD_AFTER_MS);
      }

      const computing: number[] = [];

      for (const number of unknown) {
        const found = await answered<Read>(
          await call(`${at}/pulls/${number}`, token),
          `GitHub would not return ${repository.value}#${number}`,
        );

        if (found.mergeable === false && found.html_url) {
          conflicting.push({
            url: found.html_url,
            branch: found.head?.ref ?? null,
          });
        }

        if (found.mergeable === null || found.mergeable === undefined) {
          computing.push(number);
        }
      }

      unknown = computing;
    }

    return conflicting;
  }
}
