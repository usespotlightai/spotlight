import type { GradesPort } from '@insights/application/ports/grades.port';
import type { StationFactsPort } from '@insights/application/ports/station-facts.port';
import type { ScoreRecorded } from '@insights/domain/events/score-recorded.event';
import {
  freeLabelCoverageOf,
  GRADING_WINDOW_RUNS,
  needsGrades,
} from '@insights/domain/services/grading-need';
import { sampledForGrading } from '@insights/domain/services/judge-sampling';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';

export class GradeInboxRequests {
  constructor(
    private readonly grades: GradesPort,
    private readonly facts: StationFactsPort,
    private readonly clock: ClockPort,
  ) {}

  async recorded(event: ScoreRecorded): Promise<void> {
    if (event.source === 'person') {
      await this.grades.resolve(event.location.taskId, event.runId);
      return;
    }

    if (
      event.origin !== 'live' ||
      !sampledForGrading(event.runId) ||
      !(await this.stationNeedsGrades(event))
    ) {
      return;
    }

    await this.grades.ask(event.location.taskId, event.runId);
  }

  private async stationNeedsGrades(event: ScoreRecorded): Promise<boolean> {
    const judged = await this.facts.judgedAtStation({
      workspaceId: event.workspaceId,
      teamId: event.location.teamId,
      lineId: event.location.lineId,
      stationId: event.location.stationId,
      last: GRADING_WINDOW_RUNS,
    });
    const facts = await this.facts.ofRuns(judged.map((each) => each.runId));

    return needsGrades(
      freeLabelCoverageOf({ judged, facts, now: this.clock.now() }),
    );
  }
}
