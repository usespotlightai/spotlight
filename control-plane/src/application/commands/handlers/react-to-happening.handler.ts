import type { ReactToHappeningCommand } from '@application/commands/react-to-happening.command';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { StoredDelivery } from '@application/ports/delivery-inbox.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { MemberReaderPort } from '@application/ports/member-reader.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { AttendToNotices } from '@application/services/attend-to-notices.service';
import { ReactToHappenings } from '@application/services/react-to-happenings.service';
import type { SourceForDelivery } from '@application/services/source-for-delivery.service';
import type { TaskDispatching } from '@application/services/task-dispatch';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';

/**
 * Word came in about a task, and the line said what to do with it. A word
 * about a task nobody here has, or one nowhere waits for, is not an error:
 * the host tells us about everything it knows of.
 *
 * The reacting itself is a service, so a poll reaches the board the same way a
 * delivery does; this reads the delivery and hands the words over.
 */
export class ReactToHappeningHandler
  implements CommandHandlerPort<ReactToHappeningCommand, void>
{
  private readonly reactions: ReactToHappenings;

  constructor(
    private readonly sources: SourceForDelivery,
    tasks: TaskRepository,
    lines: AssemblyLineRepository,
    dispatch: TaskDispatching,
    transaction: TransactionPort,
    clock: ClockPort,
    /** What the delivery said about the workspace, rather than about a task. */
    private readonly notices: AttendToNotices,
    ids: IdGeneratorPort,
    members: MemberReaderPort,
  ) {
    this.reactions = new ReactToHappenings(
      tasks,
      lines,
      dispatch,
      transaction,
      clock,
      ids,
      members,
    );
  }

  /**
   * Worked after the host has been answered, so nothing here is racing a
   * timeout. Taking the delivery in is what made it ours, and only once.
   */
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

      // Attended to before anything else: a delivery may be saying that what
      // Spotlight reads a workspace's words by has just changed.
      await this.notices.attend(source.noticed?.(delivered) ?? []);

      // What Spotlight itself did is not news to Spotlight.
      const news = (await source.read(delivered)).filter(
        (each) => !each.ourOwn,
      );

      if (news.length === 0) {
        return;
      }

      // Whose word this is, before anything is looked up on it. A host
      // speaking for nobody here reaches no task.
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
