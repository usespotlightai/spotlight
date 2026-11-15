import type { StationJudgesPort } from '@insights/application/ports/station-judges.port';
import type { FactRecorder } from '@insights/application/services/fact-recorder.service';
import type { StationJudgeReports } from '@insights/application/services/station-judge-reports.service';
import { ClaimsRevision } from '@insights/domain/aggregates/claims-revision.aggregate';
import type { JudgeDisagreementAnswered } from '@insights/domain/events/judge-disagreement-answered.event';
import type { JudgeDisagreementOpened } from '@insights/domain/events/judge-disagreement-opened.event';
import { ClaimsRevisionVersionConflictError } from '@insights/domain/exceptions/claims-revision-version-conflict.error';
import type { ClaimsRevisionRepository } from '@insights/domain/repositories/claims-revision.repository';
import type { JudgeDisagreementRepository } from '@insights/domain/repositories/judge-disagreement.repository';
import { revisionTriggerOf } from '@insights/domain/services/revision-trigger';
import { ClaimsRevisionId } from '@insights/domain/value-objects/claims-revision-id.vo';
import { FactOwner } from '@insights/domain/value-objects/fact-owner.vo';
import { Rubric } from '@insights/domain/value-objects/rubric.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';

export class StartClaimsRevisions {
  constructor(
    private readonly revisions: ClaimsRevisionRepository,
    private readonly disagreements: JudgeDisagreementRepository,
    private readonly judges: StationJudgesPort,
    private readonly reports: StationJudgeReports,
    private readonly recorder: FactRecorder,
    private readonly transaction: TransactionPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
  ) {}

  async disagreed(
    event: JudgeDisagreementOpened | JudgeDisagreementAnswered,
  ): Promise<void> {
    const { location, workspaceId } = event;
    const judge = await this.judges.judgeAt(location.stationId);
    const rubric =
      judge && judge.rubricVersion === event.rubricVersion
        ? Rubric.readable({
            claims: judge.claims,
            passThreshold: judge.passThreshold,
            version: judge.rubricVersion,
          })
        : null;
    const now = this.clock.now();
    const latest = await this.revisions.latestAt(location.stationId);
    if (!rubric || !ClaimsRevision.mayStart(latest, now)) {
      return;
    }

    const station = {
      workspaceId,
      teamId: location.teamId,
      lineId: location.lineId,
      stationId: location.stationId,
    };
    const answers = await this.disagreements.answeredAt({
      stationId: location.stationId,
      rubricVersion: rubric.version,
      since: latest?.startedAt ?? null,
    });
    const { calibration, rubricVersion } =
      await this.reports.calibrationAt(station);
    const trigger = revisionTriggerOf({
      answers,
      calibration: rubricVersion === rubric.version ? calibration : null,
    });

    if (!trigger) {
      return;
    }

    try {
      await this.transaction.inTransaction(async () => {
        if (
          !(await this.recorder.admits(
            FactOwner.of(workspaceId, { teamId: location.teamId }),
          ))
        ) {
          return;
        }

        await this.revisions.add(
          ClaimsRevision.started({
            id: ClaimsRevisionId.of(this.ids.generate()),
            station,
            rubric,
            trigger,
            latest,
            now,
          }),
        );
      });
    } catch (error) {
      if (error instanceof ClaimsRevisionVersionConflictError) {
        return;
      }
      throw error;
    }
  }
}
