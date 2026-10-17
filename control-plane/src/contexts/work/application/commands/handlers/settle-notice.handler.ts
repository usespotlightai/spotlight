import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { SettleNoticeCommand } from '@work/application/commands/settle-notice.command';
import type { NoticeLoader } from '@work/application/services/notice-loader.service';
import type { NoticeRepository } from '@work/domain/repositories/notice.repository';

export class SettleNoticeHandler
  implements CommandHandlerPort<SettleNoticeCommand, void>
{
  constructor(
    private readonly loader: NoticeLoader,
    private readonly notices: NoticeRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: SettleNoticeCommand): Promise<void> {
    try {
      const notice = await this.loader.putTo(
        command.noticeId,
        command.slug,
        command.settledBy,
      );
      const settled = notice.settled(this.clock.now());

      if (settled !== notice) {
        await this.notices.save(settled);
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
