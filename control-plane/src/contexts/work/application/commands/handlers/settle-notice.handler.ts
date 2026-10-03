import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { SettleNoticeCommand } from '@work/application/commands/settle-notice.command';
import type { NoticeAtHand } from '@work/application/services/notice-at-hand.service';
import type { NoticeRepository } from '@work/domain/repositories/notice.repository';

export class SettleNoticeHandler
  implements CommandHandlerPort<SettleNoticeCommand, void>
{
  constructor(
    private readonly atHand: NoticeAtHand,
    private readonly notices: NoticeRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: SettleNoticeCommand): Promise<void> {
    try {
      const notice = await this.atHand.putTo(
        command.noticeId,
        command.slug,
        command.settledBy,
      );
      const settled = notice.settled(this.clock.now());

      if (settled !== notice) {
        await this.notices.save(settled);
      }
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
