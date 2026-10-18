import type { GradesPort } from '@insights/application/ports/grades.port';
import type { ScoreRecorded } from '@insights/domain/events/score-recorded.event';
import { sampledForGrading } from '@insights/domain/services/judge-sampling';

export class GradeAsides {
  constructor(private readonly grades: GradesPort) {}

  async recorded(event: ScoreRecorded): Promise<void> {
    if (event.source === 'person') {
      await this.grades.resolve(event.location.taskId, event.runId);
      return;
    }

    if (sampledForGrading(event.runId)) {
      await this.grades.ask(event.location.taskId, event.runId);
    }
  }
}
