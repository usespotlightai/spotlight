import type { ReportHostPresenceCommand } from '@runners/application/commands/host.commands';
import type { HostStandingDto } from '@runners/application/dto/host-standing.dto';
import type { RunnerAdmissionsPort } from '@runners/application/ports/runner-admissions.port';
import { reviseHost } from '@runners/application/services/runner-host-revisions';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { HostTakenError } from '@runners/domain/exceptions/host-taken.error';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import { Admission } from '@runners/domain/value-objects/admission.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { HostReport } from '@runners/domain/value-objects/host-report.vo';
import { HostSession } from '@runners/domain/value-objects/host-session.vo';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class ReportHostPresenceHandler
  implements CommandHandlerPort<ReportHostPresenceCommand, HostStandingDto>
{
  constructor(
    private readonly admissions: RunnerAdmissionsPort,
    private readonly hosts: RunnerHostRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ReportHostPresenceCommand): Promise<HostStandingDto> {
    try {
      const admitted = await this.admissions.admit(command.credential);

      if (!admitted) {
        return { outcome: 'refused' };
      }

      const id = HostId.of(command.hostId);
      const admission = Admission.of(admitted.way.kind, admitted.way.id);
      const session = HostSession.of(command.session);
      const report = HostReport.of(command.report);
      const at = this.clock.now();

      await reviseHost(this.hosts, id, (known) =>
        known
          ? known.reportedThrough({
              admission,
              workspaceId: admitted.workspaceId,
              session,
              report,
              at,
            })
          : RunnerHost.present({
              id,
              workspaceId: admitted.workspaceId,
              admission,
              session,
              report,
              at,
            }),
      );

      return { outcome: 'present', workspaceId: admitted.workspaceId.value };
    } catch (error) {
      if (error instanceof HostTakenError) {
        return { outcome: 'taken' };
      }
      rethrowAsFault(error);
    }
  }
}
