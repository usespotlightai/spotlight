import type { LeaveAsHostCommand } from '@runners/application/commands/host.commands';
import type { HostLeftDto } from '@runners/application/dto/host-standing.dto';
import type { RunnerAdmissionsPort } from '@runners/application/ports/runner-admissions.port';
import { forgetHost } from '@runners/application/services/runner-host-revisions';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import { Admission } from '@runners/domain/value-objects/admission.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class LeaveAsHostHandler
  implements CommandHandlerPort<LeaveAsHostCommand, HostLeftDto>
{
  constructor(
    private readonly admissions: RunnerAdmissionsPort,
    private readonly hosts: RunnerHostRepository,
  ) {}

  async execute(command: LeaveAsHostCommand): Promise<HostLeftDto> {
    try {
      const admitted = await this.admissions.admit(command.credential);

      if (!admitted) {
        return { outcome: 'refused' };
      }

      const through = Admission.of(admitted.way.kind, admitted.way.id);

      await forgetHost(this.hosts, HostId.of(command.hostId), (known) =>
        known.servesThrough(through),
      );

      return { outcome: 'left' };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
