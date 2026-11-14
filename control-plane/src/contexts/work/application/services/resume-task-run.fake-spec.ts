import type { RunsPort } from '@runs/application/ports/runs.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { TeamIntegrationsPort } from '@work/application/ports/team-integrations.port';
import { ResumeTaskRun } from '@work/application/services/resume-task-run.service';
import { TeamIntegrations } from '@work/application/services/team-integrations.service';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';

export const NO_TOOL_CHANGE = { removed: [], added: [] };

export const resumingWith = (
  runs: Pick<RunsPort, 'resume'>,
  dispatches: DispatchRepository,
  integrations: TeamIntegrationsPort = {
    provided: async () => [],
    toolsOnMarks: async () => [],
  },
  logger: LoggerPort = {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
  },
): ResumeTaskRun =>
  new ResumeTaskRun(
    runs as RunsPort,
    dispatches,
    new TeamIntegrations(integrations),
    { inTransaction: (work) => work() },
    logger,
  );
