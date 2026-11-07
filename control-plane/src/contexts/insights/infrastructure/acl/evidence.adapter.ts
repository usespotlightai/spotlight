import type {
  EvidencePort,
  RunEvidence,
} from '@insights/application/ports/evidence.port';
import type { RunEvidencePort } from '@work/application/ports/run-evidence.port';

export class Evidence implements EvidencePort {
  constructor(private readonly runs: RunEvidencePort) {}

  hasTask(runId: string): Promise<boolean> {
    return this.runs.hasTask(runId);
  }

  async of(runId: string): Promise<RunEvidence | null> {
    const run = await this.runs.of(runId);

    return (
      run && {
        runId: run.runId,
        taskId: run.taskId,
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
