import type { ReactToHappeningCommand } from '@application/commands/react-to-happening.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { AttachmentStorePort } from '@application/ports/attachment-store.port';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { StoredDelivery } from '@application/ports/delivery-inbox.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { LoggerPort } from '@application/ports/logger.port';
import type { MemberReaderPort } from '@application/ports/member-reader.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { AnnounceTaskEvents } from '@application/services/announce-task-events';
import type { AttendToNotices } from '@application/services/attend-to-notices.service';
import { ReactToHappenings } from '@application/services/react-to-happenings.service';
import type { SourceForDelivery } from '@application/services/source-for-delivery.service';
import type { TaskDispatching } from '@application/services/task-dispatch';
import type { LineRepository } from '@domain/repositories/line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';

export class ReactToHappeningHandler
  implements CommandHandlerPort<ReactToHappeningCommand, void>
{
  private readonly reactions: ReactToHappenings;

  constructor(
    private readonly sources: SourceForDelivery,
    tasks: TaskRepository,
    lines: LineRepository,
    dispatch: TaskDispatching,
    transaction: TransactionPort,
    clock: ClockPort,
    private readonly notices: AttendToNotices,
    ids: IdGeneratorPort,
    members: MemberReaderPort,
    announce: AnnounceTaskEvents,
    files: AttachmentStorePort,
    logger: LoggerPort,
  ) {
    this.reactions = new ReactToHappenings(
      tasks,
      lines,
      dispatch,
      transaction,
      clock,
      ids,
      members,
      announce,
      files,
      logger,
    );
  }

  async execute(command: ReactToHappeningCommand): Promise<void> {
    try {
      const stored: StoredDelivery = command.delivered;
      const source = await this.sources.find({
        source: stored.source,
        workspaceId: stored.workspaceId,
        teamId: stored.teamId,
        teamKey: stored.teamKey,
      });

      if (!source) {
        return;
      }

      const delivered = {
        headers: stored.headers,
        body: stored.body,
        raw: null,
      };

      // Notices first: they may change how this workspace's words are read.
      await this.notices.attend(source.noticed?.(delivered) ?? []);

      const news = (await source.read(delivered)).filter(
        (each) => !each.ourOwn,
      );

      if (news.length === 0) {
        return;
      }

      const workspaceId = await source.routes(delivered);

      if (!workspaceId) {
        return;
      }

      await this.reactions.react(workspaceId, stored.teamId, news);
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
