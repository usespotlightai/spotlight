import { Injectable } from '@nestjs/common';
import {
  type LiveChannel,
  type LiveMessage,
  personChannel,
  workspaceChannel,
} from '@platform/live/live-feed.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';

export interface ChangeNotice {
  readonly channel: LiveChannel;
  readonly topic: string;
  readonly ids: Readonly<Record<string, string>>;
}

export interface ChangeNoticeMapper {
  readonly name: string;
  readonly kinds: readonly string[];

  notices(event: DomainEvent): readonly ChangeNotice[];
}

export const noticing = <E extends DomainEvent>(
  name: string,
  kinds: readonly string[],
  notices: (event: E) => ChangeNotice | readonly ChangeNotice[],
): ChangeNoticeMapper => ({
  name,
  kinds,
  notices: (event) => [notices(event as E)].flat(),
});

export const changedIn = (
  workspaceId: string,
  topic: string,
  ids: Readonly<Record<string, string>>,
): ChangeNotice => ({ channel: workspaceChannel(workspaceId), topic, ids });

export const changedFor = (
  personId: string,
  topic: string,
  ids: Readonly<Record<string, string>>,
): ChangeNotice => ({ channel: personChannel(personId), topic, ids });

export const messageOfNotice = (notice: ChangeNotice): LiveMessage => ({
  type: 'changed',
  data: { topic: notice.topic, ids: notice.ids },
});

const keyOf = (notice: ChangeNotice): string =>
  JSON.stringify([
    notice.channel,
    notice.topic,
    Object.entries(notice.ids).sort(([a], [b]) => (a < b ? -1 : 1)),
  ]);

@Injectable()
export class ChangeNotices {
  readonly #named = new Set<string>();
  readonly #of = new Map<string, ChangeNoticeMapper[]>();

  register(mappers: readonly ChangeNoticeMapper[]): void {
    for (const mapper of mappers) {
      if (this.#named.has(mapper.name)) {
        throw new Error(`Two change notices are both called ${mapper.name}`);
      }

      this.#named.add(mapper.name);

      for (const kind of mapper.kinds) {
        this.#of.set(kind, [...(this.#of.get(kind) ?? []), mapper]);
      }
    }
  }

  of(
    events: readonly DomainEvent[],
    failed: (name: string, error: unknown) => void,
  ): readonly ChangeNotice[] {
    const distinct = new Map<string, ChangeNotice>();

    for (const event of events) {
      for (const mapper of this.#of.get(event.kind) ?? []) {
        let notices: readonly ChangeNotice[];

        try {
          notices = mapper.notices(event);
        } catch (error) {
          failed(mapper.name, error);
          continue;
        }

        for (const notice of notices) {
          distinct.set(keyOf(notice), notice);
        }
      }
    }

    return [...distinct.values()];
  }
}
