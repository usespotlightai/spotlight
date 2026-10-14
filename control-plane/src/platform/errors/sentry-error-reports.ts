import { Injectable } from '@nestjs/common';
import { captureException } from '@sentry/nestjs';
import type {
  ErrorAbout,
  ErrorReportsPort,
} from '@shared-kernel/application/ports/error-reports.port';

@Injectable()
export class SentryErrorReports implements ErrorReportsPort {
  report(error: unknown, about: ErrorAbout): void {
    const tags = Object.fromEntries(
      Object.entries({
        source: about.source,
        workspace: about.workspaceId,
        team: about.teamId,
        task: about.taskId,
        run: about.runId,
      }).filter(([, value]) => value !== undefined),
    );

    captureException(error, { tags });
  }
}
