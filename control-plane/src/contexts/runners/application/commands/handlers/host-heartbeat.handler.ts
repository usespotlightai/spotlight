import type { HostHeartbeatCommand } from '@runners/application/commands/host.commands';
import type { HostHeartbeatDto } from '@runners/application/dto/host-heartbeat.dto';
import type { RunnerAdmissionsPort } from '@runners/application/ports/runner-admissions.port';
import { reviseHost } from '@runners/application/services/runner-host-revisions';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { HostInUseError } from '@runners/domain/exceptions/host-in-use.error';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import { Admission } from '@runners/domain/value-objects/admission.vo';
import { BootId } from '@runners/domain/value-objects/boot-id.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { HostReport } from '@runners/domain/value-objects/host-report.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class HostHeartbeatHandler
  implements CommandHandlerPort<HostHeartbeatCommand, HostHeartbeatDto>
{
  constructor(
    private readonly admissions: RunnerAdmissionsPort,
    private readonly hosts: RunnerHostRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: HostHeartbeatCommand): Promise<HostHeartbeatDto> {
    try {
      const admitted = await this.admissions.admit(command.credential);

      if (!admitted) {
        return { outcome: 'unauthorized' };
      }

      const id = HostId.of(command.hostId);
      const admission = Admission.of(admitted.way.kind, admitted.way.id);
      const bootId = BootId.of(command.bootId);
      const report = HostReport.of(command.report);
      const at = this.clock.now();

      await reviseHost(this.hosts, id, (known) =>
        known
          ? known.reportThrough({
              admission,
              workspaceId: admitted.workspaceId,
              bootId,
              report,
              at,
            })
          : RunnerHost.fromHeartbeat({
              id,
              workspaceId: admitted.workspaceId,
              admission,
              bootId,
              report,
              at,
            }),
      );

      return { outcome: 'accepted', workspaceId: admitted.workspaceId.value };
    } catch (error) {
      if (error instanceof HostInUseError) {
        return { outcome: 'host-in-use' };
      }
      rethrowAsApplicationError(error);
    }
  }
}
