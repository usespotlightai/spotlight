import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { ResolveNoticeCommand } from '@work/application/commands/resolve-notice.command';
import type { NoticeLoader } from '@work/application/services/notice-loader.service';
import type { NoticeRepository } from '@work/domain/repositories/notice.repository';

export class ResolveNoticeHandler
  implements CommandHandlerPort<ResolveNoticeCommand, void>
{
  constructor(
    private readonly loader: NoticeLoader,
    private readonly notices: NoticeRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: ResolveNoticeCommand): Promise<void> {
    try {
      const notice = await this.loader.putTo(
        command.noticeId,
        command.slug,
        command.resolvedBy,
      );
      const resolved = notice.resolve(this.clock.now());

      if (resolved !== notice) {
        await this.notices.save(resolved);
      }
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
