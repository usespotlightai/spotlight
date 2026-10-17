import type { GradesPort } from '@outcomes/application/ports/grades.port';
import type { ScoreRecorded } from '@outcomes/domain/events/score-recorded.event';
import { sampledForGrading } from '@outcomes/domain/services/judge-sampling';

export class GradeAsides {
  constructor(private readonly grades: GradesPort) {}

  async recorded(event: ScoreRecorded): Promise<void> {
    if (event.source === 'person') {
      await this.grades.resolve(event.place.taskId, event.runId);
      return;
    }

    if (sampledForGrading(event.runId)) {
      await this.grades.ask(event.place.taskId, event.runId);
    }
  }
}
