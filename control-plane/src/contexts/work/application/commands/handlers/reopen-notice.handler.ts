import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { ReopenNoticeCommand } from '@work/application/commands/reopen-notice.command';
import type { NoticeLoader } from '@work/application/services/notice-loader.service';
import type { NoticeRepository } from '@work/domain/repositories/notice.repository';

export class ReopenNoticeHandler
  implements CommandHandlerPort<ReopenNoticeCommand, void>
{
  constructor(
    private readonly loader: NoticeLoader,
    private readonly notices: NoticeRepository,
  ) {}

  async execute(command: ReopenNoticeCommand): Promise<void> {
    try {
      const notice = await this.loader.putTo(
        command.noticeId,
        command.slug,
        command.reopenedBy,
      );
      const reopened = notice.reopen();

      if (reopened !== notice) {
        await this.notices.save(reopened);
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
