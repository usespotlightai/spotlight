import type { RepositoryGitPort } from '@github/application/ports/repository-git.port';
import type { WorkspaceConnectionsPort } from '@github/application/ports/workspace-connections.port';
import type { RunnerLeasesPort } from '@runners/application/ports/runner-leases.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { nonEmpty } from '@shared-kernel/domain/non-empty';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type {
  GitAnswerDto,
  GitCallDto,
  GitService,
} from '@work/application/dto/git-call.dto';
import type {
  Push,
  ReceivePackPort,
} from '@work/application/ports/receive-pack.port';
import type {
  ReviewWorkAccessPort,
  LeasedReviewWork,
} from '@work/application/ports/review-work-access.port';
import type { RunWork } from '@work/application/services/run-work';
import type {
  CheckedRepository,
  RunWorks,
} from '@work/application/services/run-works.service';
import { WorkNotLeasedError } from '@work/domain/exceptions/work-not-leased.error';
import { ReviewGitAccess } from '@work/domain/services/review-git-access';

const PUSH = 'git-receive-pack';
const OK = 200;

interface AllowedRepository extends CheckedRepository {
  readonly work: RunWork | null;
}

export class CarryGitCall {
  constructor(
    private readonly works: RunWorks,
    private readonly workspaces: WorkspaceConnectionsPort,
    private readonly git: RepositoryGitPort,
    private readonly reviewing: ReviewWorkAccessPort,
    private readonly leases: RunnerLeasesPort,
    private readonly receivePack: ReceivePackPort,
    private readonly clock: ClockPort,
    private readonly logger: LoggerPort,
  ) {}

  async carry(
    workId: string,
    runnerId: string,
    repo: string,
    service: GitService,
    call: GitCallDto,
  ): Promise<GitAnswerDto | null> {
    const allowed = await this.allowedRepository(
      workId,
      runnerId,
      repo,
      service,
    ).catch(rethrowAsApplicationError);

    if (!allowed) {
      return null;
    }

    if (!(await this.workspaces.isConnected(allowed.workspaceId))) {
      return null;
    }

    const checked =
      service === PUSH && call.method === 'POST' && allowed.work?.limitsPushes
        ? await this.checkedPush(allowed.work, allowed.repository, call)
        : { kind: 'carry' as const, call, push: null };

    if (checked.kind === 'answer') {
      return checked.answer;
    }

    const { push } = checked;
    const answered = await this.git.call(
      allowed.workspaceId,
      allowed.repository,
      {
        method: checked.call.method,
        path: checked.call.path,
        search: checked.call.search,
        headers: checked.call.headers,
        body: checked.call.body,
      },
    );

    const work = allowed.work;
    const answer =
      push !== null && work !== null && answered.status === OK
        ? push.reported(answered, (updates) =>
            work.pushed(allowed.repository, updates).catch((error: unknown) => {
              this.logger.error(
                {
                  err: error,
                  workspaceId: allowed.workspaceId.value,
                  repository: allowed.repository.value,
                },
                'Could not keep the commit a task run pushed',
              );
            }),
          )
        : answered;

    return {
      status: answer.status,
      headers: answer.headers,
      body: answer.body,
    };
  }

  private async checkedPush(
    work: RunWork,
    repository: Repository,
    call: GitCallDto,
  ): Promise<
    | {
        readonly kind: 'carry';
        readonly call: GitCallDto;
        readonly push: Push;
      }
    | { readonly kind: 'answer'; readonly answer: GitAnswerDto }
  > {
    const read = await this.receivePack.read(call);

    if (read.kind === 'unreadable') {
      return { kind: 'answer', answer: read.answer };
    }

    const refusal = await work.pushRefusal(repository, read.push.updates);

    return nonEmpty(refusal)
      ? { kind: 'answer', answer: await read.push.refused(refusal) }
      : { kind: 'carry', call: read.push.call, push: read.push };
  }

  private async allowedRepository(
    workId: string,
    runnerId: string,
    repo: string,
    service: GitService,
  ): Promise<AllowedRepository | null> {
    const runner = RunnerId.of(runnerId);
    const held = await this.leases.leaseOf(runner);

    return held && held.kind !== 'run' && ReviewGitAccess.mayCall(service)
      ? this.reviewWorkRepository(
          { kind: held.kind, id: held.id },
          workId,
          runner,
          repo,
        )
      : this.runRepository(workId, runnerId, repo, service);
  }

  private async runRepository(
    workId: string,
    runnerId: string,
    repo: string,
    service: GitService,
  ): Promise<AllowedRepository | null> {
    const leased = await this.works.leasedRunWork(workId, runnerId);

    if (!leased) {
      await this.works.leasedBy(workId, runnerId);

      return null;
    }

    const { work } = leased;
    const repository = work ? await work.repositoryNamed(repo, service) : null;

    return work && repository
      ? { workspaceId: work.workspaceId, repository, work }
      : null;
  }

  private async reviewWorkRepository(
    held: { readonly kind: 'check' | 'diff'; readonly id: string },
    workId: string,
    runner: RunnerId,
    repo: string,
  ): Promise<AllowedRepository | null> {
    const leased =
      held.id === workId
        ? await this.reviewing.leasedWork(held, runner, this.clock.now())
        : null;

    if (!leased) {
      throw new WorkNotLeasedError(workId);
    }

    return this.reviewedRepository(leased, repo);
  }

  private async reviewedRepository(
    leased: LeasedReviewWork,
    repo: string,
  ): Promise<AllowedRepository | null> {
    const found = leased.runId
      ? await this.works.repositoryForCheck(leased.runId, repo)
      : leased.taskId
        ? await this.works.repositoryForTask(leased.taskId, repo)
        : null;

    if (!found) {
      return null;
    }

    return ReviewGitAccess.mayRead(leased.repository, found.repository)
      ? { ...found, work: null }
      : null;
  }
}
