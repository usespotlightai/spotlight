import { Inject, Injectable } from '@nestjs/common';
import {
  type ChangeNotice,
  messageOfNotice,
  type SequencedNotice,
} from '@platform/live/change-notices';
import { LIVE_FEED, type LiveFeedPort } from '@platform/live/live-feed.port';
import {
  LIVE_NOTICE_LOG,
  type LiveNoticeLogPort,
} from '@platform/live/live-notice-log.port';
import { LiveWrites } from '@platform/live/live-writes';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';

@Injectable()
export class LiveNotices {
  constructor(
    @Inject(LIVE_FEED) private readonly feed: LiveFeedPort,
    @Inject(LIVE_NOTICE_LOG) private readonly log: LiveNoticeLogPort,
    @Inject(LOGGER) private readonly logger: LoggerPort,
  ) {}

  publish(notices: readonly ChangeNotice[]): void {
    if (notices.length === 0) {
      return;
    }

    LiveWrites.track(
      this.sequenced(notices).then((sequenced) => {
        for (const notice of sequenced) {
          try {
            this.feed.publish(notice.channel, messageOfNotice(notice));
          } catch (error) {
            this.logger.warn(
              { err: error, channel: notice.channel },
              'Publishing a live change',
            );
          }
        }

        return sequenced;
      }),
    );
  }

  private async sequenced(
    notices: readonly ChangeNotice[],
  ): Promise<readonly SequencedNotice[]> {
    try {
      return await this.log.append(notices);
    } catch (error) {
      this.logger.warn({ err: error }, 'Numbering live changes');
      return notices.map((notice) => ({ ...notice, sequence: null }));
    }
  }
}
