import type {
  EvidencePort,
  RunEvidence,
  StationJudge,
} from '@outcomes/application/ports/evidence.port';
import type { RunEvidencePort } from '@work/application/ports/run-evidence.port';

export class Evidence implements EvidencePort {
  constructor(private readonly runs: RunEvidencePort) {}

  holds(runId: string): Promise<boolean> {
    return this.runs.holds(runId);
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
          given: each.given,
          returned: each.returned,
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

  async judgeAt(stationId: string): Promise<StationJudge | null> {
    const judge = await this.runs.judgeAt(stationId);

    return (
      judge && {
        teamId: judge.teamId,
        lineId: judge.lineId,
        rubric: judge.rubric,
        rubricVersion: judge.rubricVersion,
        sample: judge.sample,
        trust: judge.trust,
      }
    );
  }
}
