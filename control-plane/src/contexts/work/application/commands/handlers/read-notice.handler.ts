import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { ReadNoticeCommand } from '@work/application/commands/read-notice.command';
import type { NoticeAtHand } from '@work/application/services/notice-at-hand.service';
import type { NoticeRepository } from '@work/domain/repositories/notice.repository';

export class ReadNoticeHandler
  implements CommandHandlerPort<ReadNoticeCommand, void>
{
  constructor(
    private readonly atHand: NoticeAtHand,
    private readonly notices: NoticeRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ReadNoticeCommand): Promise<void> {
    try {
      const notice = await this.atHand.putTo(
        command.noticeId,
        command.slug,
        command.readBy,
      );
      const read = notice.read(this.clock.now());

      if (read !== notice) {
        await this.notices.save(read);
      }
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
