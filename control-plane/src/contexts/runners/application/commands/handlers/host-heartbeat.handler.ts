import type { HostHeartbeatCommand } from '@runners/application/commands/host.commands';
import type { HostHeartbeatDto } from '@runners/application/dto/host-heartbeat.dto';
import type { RunnerAuthenticatorPort } from '@runners/application/ports/runner-authenticator.port';
import type { SandboxUpkeepPort } from '@runners/application/ports/sandbox-upkeep.port';
import { reviseHost } from '@runners/application/services/runner-host-revisions';
import { RunnerHost } from '@runners/domain/aggregates/runner-host.aggregate';
import { HostInUseError } from '@runners/domain/exceptions/host-in-use.error';
import type { RunnerHostRepository } from '@runners/domain/repositories/runner-host.repository';
import { BootId } from '@runners/domain/value-objects/boot-id.vo';
import { CredentialSource } from '@runners/domain/value-objects/credential-source.vo';
import { HostId } from '@runners/domain/value-objects/host-id.vo';
import { HostReport } from '@runners/domain/value-objects/host-report.vo';
import { SandboxReport } from '@runners/domain/value-objects/sandbox-report.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

export class HostHeartbeatHandler implements CommandHandlerPort<
  HostHeartbeatCommand,
  HostHeartbeatDto
> {
  constructor(
    private readonly authenticator: RunnerAuthenticatorPort,
    private readonly hosts: RunnerHostRepository,
    private readonly sandboxes: SandboxUpkeepPort,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: HostHeartbeatCommand): Promise<HostHeartbeatDto> {
    try {
      const authenticated = await this.authenticator.authenticate(
        command.credential,
      );

      if (!authenticated) {
        return { outcome: 'unauthorized' };
      }

      const id = HostId.of(command.hostId);
      const source = CredentialSource.of(
        authenticated.source.kind,
        authenticated.source.id,
      );
      const bootId = BootId.of(command.bootId);
      const report = HostReport.of(command.report);
      const sandboxes = SandboxReport.of({
        sandboxes: command.sandboxes,
        stopping: command.stopping,
      });
      const at = this.clock.now();

      const host = await reviseHost(this.hosts, id, (known) =>
        known
          ? known.reportThrough({
              source,
              workspaceId: authenticated.workspaceId,
              bootId,
              report,
              sandboxes,
              at,
            })
          : RunnerHost.fromHeartbeat({
              id,
              workspaceId: authenticated.workspaceId,
              source,
              bootId,
              report,
              sandboxes,
              at,
            }),
      );

      return {
        outcome: 'accepted',
        workspaceId: authenticated.workspaceId.value,
        drain: await this.sandboxes.toDrainOn(host),
      };
    } catch (error) {
      if (error instanceof HostInUseError) {
        return { outcome: 'host-in-use' };
      }
      rethrowAsApplicationError(error);
    }
  }
}
