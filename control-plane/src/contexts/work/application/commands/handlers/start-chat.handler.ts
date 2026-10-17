import type { WorkspaceReaderPort } from '@identity/application/ports/workspace-reader.port';
import type { RunnerReaderPort } from '@runners/application/ports/runner-reader.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { HarnessModel } from '@shared-kernel/domain/value-objects/harness-model.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { StartChatCommand } from '@work/application/commands/chat.commands';
import type { AccessibleRepositoriesPort } from '@work/application/ports/accessible-repositories.port';
import type { HarnessLaunchPort } from '@work/application/ports/harness-launch.port';
import type { ChatDispatching } from '@work/application/services/chat-dispatch';
import type { FilesLoader } from '@work/application/services/files-loader.service';
import type { TracesLoader } from '@work/application/services/traces-loader.service';
import { Chat } from '@work/domain/aggregates/chat.aggregate';
import { ConfigHomeUnreachableError } from '@work/domain/exceptions/config-home-unreachable.error';
import { SetupNeedsEgressError } from '@work/domain/exceptions/setup-needs-egress.error';
import { UnknownHarnessError } from '@work/domain/exceptions/unknown-harness.error';
import { UnknownStationError } from '@work/domain/exceptions/unknown-station.error';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { ConfigHome } from '@work/domain/value-objects/config-home.vo';
import { Effort } from '@work/domain/value-objects/effort.vo';
import { ImprovedStation } from '@work/domain/value-objects/improved-station.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';

export class StartChatHandler
  implements CommandHandlerPort<StartChatCommand, string | null>
{
  constructor(
    private readonly workspaces: WorkspaceReaderPort,
    private readonly chats: ChatRepository,
    private readonly files: FilesLoader,
    private readonly traces: TracesLoader,
    private readonly lines: LineRepository,
    private readonly dispatch: ChatDispatching,
    private readonly launch: HarnessLaunchPort,
    private readonly repositories: AccessibleRepositoriesPort,
    private readonly runners: RunnerReaderPort,
    private readonly ids: IdGeneratorPort,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: StartChatCommand): Promise<string | null> {
    try {
      const startedBy = UserId.of(command.startedBy);
      const member = await this.workspaces.findTeamForMember(
        command.teamId,
        startedBy,
      );

      if (!member) {
        return null;
      }

      if (
        !this.launch.catalogue().some((each) => each.id === command.harness)
      ) {
        throw new UnknownHarnessError(command.harness);
      }

      const workspaceId = WorkspaceId.of(member.workspaceId);
      const teamId = TeamId.of(member.teamId);
      const setup = command.setup ? ConfigHome.of(command.setup) : null;

      if (
        setup &&
        !(await this.repositories.isAccessible(workspaceId, setup.repository))
      ) {
        throw new ConfigHomeUnreachableError(setup.repository.value);
      }

      if (setup && !(await this.runners.hasAWayOut(workspaceId))) {
        throw new SetupNeedsEgressError();
      }

      const started = await this.transaction.inTransaction(async () => {
        const attachments = await this.files.handedOver(
          workspaceId,
          command.attachments,
        );
        const traces = await this.traces.shared(command.traces);
        const improving = command.improving
          ? await this.improved(command.improving)
          : null;

        const chat = Chat.start({
          workspaceId,
          teamId,
          startedBy,
          harness: HarnessId.of(command.harness),
          model: command.model === null ? null : HarnessModel.of(command.model),
          effort: command.effort === null ? null : Effort.of(command.effort),
          repositories: command.repositories.map((each) => Repository.of(each)),
          body: ChatMessageBody.fromInput(
            command.body,
            attachments,
            traces,
            improving,
          ),
          attachments,
          traces,
          improving,
          setup,
          now: this.clock.now(),
          newId: () => this.ids.generate(),
        });

        const taken = await this.dispatch.takenUp(chat);
        await this.chats.add(taken);
        await this.files.takenIn(workspaceId, attachments);

        return taken;
      });

      return started.id.value;
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async improved(stationId: string): Promise<ImprovedStation> {
    const id = StationId.of(stationId);
    const line = await this.lines.findByStation(id);
    const station = line?.stationAt(id);

    if (!line || !station) {
      throw new UnknownStationError(stationId);
    }

    return ImprovedStation.at(line, station);
  }
}
