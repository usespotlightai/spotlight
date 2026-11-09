export const LIVE_FEED = Symbol('LIVE_FEED');

export type LiveChannel = `workspace:${string}` | `person:${string}`;

export const workspaceChannel = (workspaceId: string): LiveChannel =>
  `workspace:${workspaceId}`;

export const personChannel = (personId: string): LiveChannel =>
  `person:${personId}`;

export interface LiveMessage {
  readonly type: string;
  readonly data: Readonly<Record<string, unknown>>;
}

export const RESYNC: LiveMessage = { type: 'resync', data: {} };

export type LiveListener = (message: LiveMessage) => void;

export interface LiveFeedPort {
  publish(channel: LiveChannel, message: LiveMessage): void;

  subscribe(
    channels: readonly LiveChannel[],
    listener: LiveListener,
  ): () => void;
}
