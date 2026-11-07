import type {
  EvidencePort,
  RunEvidence,
} from '@insights/application/ports/evidence.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { RunEvidencePort } from '@work/application/ports/run-evidence.port';

export class Evidence implements EvidencePort {
  constructor(private readonly runs: RunEvidencePort) {}

  hasTask(runId: RunId): Promise<boolean> {
    return this.runs.hasTask(runId.value);
  }

  async of(runId: RunId): Promise<RunEvidence | null> {
    const run = await this.runs.of(runId.value);

    return (
      run && {
        runId: RunId.of(run.runId),
        taskId: TaskId.of(run.taskId),
        title: run.title,
        description: run.description,
        steps: run.steps.map((each) => ({
          index: each.index,
          kind: each.kind,
          tool: each.tool,
          text: each.text,
          input: each.input,
          output: each.output,
        })),
        hunks: run.hunks.map((each) => ({
          id: each.id,
          path: each.path,
          header: each.header,
          lines: each.lines,
        })),
      }
    );
  }
}
