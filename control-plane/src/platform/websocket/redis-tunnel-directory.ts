import type { RedisPubSub } from '@platform/redis/redis-connection';
import type {
  Ask,
  TunnelDirectory,
} from '@platform/websocket/tunnel-directory';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const PEER_MS = 90_000;
const STREAM_MS = 30_000;

const RELEASE = `
if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end
return 0`;

const RENEW = `
local owner = redis.call('get', KEYS[1])
if owner == false or owner == ARGV[1] then
  return redis.call('set', KEYS[1], ARGV[1], 'PX', ARGV[2])
end
return 0`;

export class RedisTunnelDirectory implements TunnelDirectory {
  constructor(
    private readonly redis: RedisPubSub,
    readonly address: string,
    private readonly namespace: string,
    private readonly logger: LoggerPort,
  ) {}

  async claimPeer(peer: string): Promise<void> {
    await this.redis.client.set(
      this.key('peer', peer),
      this.address,
      'PX',
      PEER_MS,
    );
  }

  async renewPeer(peer: string): Promise<void> {
    await this.redis.client.eval(
      RENEW,
      1,
      this.key('peer', peer),
      this.address,
      PEER_MS,
    );
  }

  async releasePeer(peer: string): Promise<void> {
    await this.redis.client.eval(
      RELEASE,
      1,
      this.key('peer', peer),
      this.address,
    );
  }

  ownerOfPeer(peer: string): Promise<string | null> {
    return this.redis.client.get(this.key('peer', peer));
  }

  async claimStream(stream: string): Promise<void> {
    await this.redis.client.set(
      this.key('stream', stream),
      this.address,
      'PX',
      STREAM_MS,
    );
  }

  ownerOfStream(stream: string): Promise<string | null> {
    return this.redis.client.get(this.key('stream', stream));
  }

  async ask(
    owner: string,
    peer: string,
    message: Readonly<Record<string, unknown>>,
  ): Promise<boolean> {
    const receivers = await this.redis.client.publish(
      this.key('ask', owner),
      JSON.stringify({ peer, message }),
    );

    return receivers > 0;
  }

  async stopAsking(): Promise<void> {
    await this.redis.subscriber.unsubscribe(this.key('ask', this.address));
  }

  onAsk(ask: Ask): void {
    const channel = this.key('ask', this.address);

    this.redis.subscriber.on('message', (from: string, payload: string) => {
      if (from !== channel) {
        return;
      }

      try {
        const { peer, message } = JSON.parse(payload) as {
          peer: string;
          message: Record<string, unknown>;
        };
        ask(peer, message);
      } catch (error) {
        this.logger.warn({ err: error }, 'A tunnel ask could not be read');
      }
    });
    this.redis.subscriber
      .subscribe(channel)
      .catch((error: unknown) =>
        this.logger.warn({ err: error }, 'Could not listen for tunnel asks'),
      );
  }

  private key(kind: string, id: string): string {
    return `spotlight:${this.namespace}:${kind}:${id}`;
  }
}
