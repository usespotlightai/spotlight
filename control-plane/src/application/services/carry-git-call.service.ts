import type { GitGatewayPort } from '@application/ports/git-gateway.port';
import type {
  GitAnswer,
  GitCall,
  RepositoryGitPort,
} from '@application/ports/repository-git.port';
import { UnknownRunError } from '@domain/exceptions/unknown-run.error';
import type { RunRepository } from '@domain/repositories/run.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';

export class CarryGitCall implements GitGatewayPort {
  constructor(
    private readonly runs: RunRepository,
    private readonly tasks: TaskRepository,
    private readonly git: RepositoryGitPort,
  ) {}

  async carry(
    runId: string,
    runnerId: string,
    call: GitCall,
  ): Promise<GitAnswer | null> {
    const run = await this.runs.findById(RunId.of(runId));

    if (!run) {
      throw new UnknownRunError(`there is no run ${runId}`);
    }

    // Held by whoever is asking, so one run's access reaches no other's code.
    run.assertHeldBy(RunnerId.of(runnerId));

    const task = run.taskId ? await this.tasks.find(run.taskId) : null;
    const repository = task?.repository;

    return repository ? this.git.call(repository, call) : null;
  }
}
