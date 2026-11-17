import { Inject, Injectable } from '@nestjs/common';
import type {
  ChangeNotice,
  SequencedNotice,
} from '@platform/live/change-notices';
import type { LiveChannel } from '@platform/live/live-feed.port';
import type {
  ChannelLog,
  LiveNoticeLogPort,
  LivePositions,
} from '@platform/live/live-notice-log.port';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  liveChannel,
  liveNotice,
} from '@platform/persistence/drizzle/schemas/live.schema';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';
import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm';

interface AppendedRow extends Record<string, unknown> {
  readonly sequence: string;
}

@Injectable()
export class DrizzleLiveNoticeLog implements LiveNoticeLogPort {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDatabase,
    @Inject(LOGGER) private readonly logger: LoggerPort,
  ) {}

  async append(
    notices: readonly ChangeNotice[],
  ): Promise<readonly SequencedNotice[]> {
    const byChannel = new Map<LiveChannel, ChangeNotice[]>();

    for (const notice of notices) {
      byChannel.set(notice.channel, [
        ...(byChannel.get(notice.channel) ?? []),
        notice,
      ]);
    }

    const sequenced = await Promise.all(
      [...byChannel].map(async ([channel, each]) => {
        const last = await this.claimed(channel, each).catch(
          (error: unknown) => {
            this.logger.warn({ err: error, channel }, 'Numbering live changes');
            return null;
          },
        );

        return each.map((notice, index) => ({
          ...notice,
          sequence: last === null ? null : last - each.length + index + 1,
        }));
      }),
    );

    return sequenced.flat();
  }

  async logs(
    channels: readonly LiveChannel[],
    since: LivePositions,
    limit: number,
  ): Promise<ReadonlyMap<LiveChannel, ChannelLog>> {
    const logs = new Map<LiveChannel, ChannelLog>();

    if (channels.length === 0) {
      return logs;
    }

    const heads = await this.db
      .select({
        channel: liveChannel.channel,
        lastSequence: liveChannel.lastSequence,
      })
      .from(liveChannel)
      .where(inArray(liveChannel.channel, [...channels]));
    const headOf = new Map(
      heads.map((row) => [row.channel, row.lastSequence] as const),
    );

    for (const channel of channels) {
      const from = since.get(channel);
      const head = headOf.get(channel) ?? 0;

      if (from === undefined || from >= head) {
        logs.set(channel, { head, after: [] });
        continue;
      }

      const after = await this.db
        .select({
          sequence: liveNotice.sequence,
          topic: liveNotice.topic,
          ids: liveNotice.ids,
        })
        .from(liveNotice)
        .where(
          and(eq(liveNotice.channel, channel), gt(liveNotice.sequence, from)),
        )
        .orderBy(asc(liveNotice.sequence))
        .limit(limit);

      logs.set(channel, {
        head,
        after: after
          .filter((row) => row.sequence <= head)
          .map((row) => ({ channel, ...row })),
      });
    }

    return logs;
  }

  async prune(before: Date, limit: number): Promise<number> {
    const result = await this.db.execute(sql`
      delete from live_notice
      where (channel, sequence) in (
        select channel, sequence from live_notice
        where recorded_at < ${before.toISOString()}
        limit ${limit}
      )
    `);

    return result.rowCount ?? 0;
  }

  private async claimed(
    channel: LiveChannel,
    notices: readonly ChangeNotice[],
  ): Promise<number> {
    const rows = JSON.stringify(
      notices.map((notice, index) => ({
        position: index + 1,
        topic: notice.topic,
        ids: notice.ids,
      })),
    );
    const result = await this.db.execute<AppendedRow>(sql`
      with claimed as (
        insert into live_channel (channel, last_sequence)
        values (${channel}, ${notices.length})
        on conflict (channel) do update
          set last_sequence = live_channel.last_sequence + excluded.last_sequence
        returning last_sequence
      )
      insert into live_notice (channel, sequence, topic, ids)
      select ${channel}, claimed.last_sequence - ${notices.length} + notice.position, notice.topic, notice.ids
      from claimed, jsonb_to_recordset(${rows}::jsonb) as notice(position int, topic text, ids jsonb)
      returning sequence
    `);

    return Math.max(...result.rows.map((row) => Number(row.sequence)));
  }
}
