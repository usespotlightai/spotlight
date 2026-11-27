import type { WebPushPort } from '@notifications/application/ports/web-push.port';
import type { GetPushKeyQuery } from '@notifications/application/queries/get-push-key.query';
import type { QueryHandlerPort } from '@shared-kernel/application/ports/query-handler.port';

export class GetPushKeyHandler implements QueryHandlerPort<
  GetPushKeyQuery,
  string | null
> {
  constructor(private readonly push: WebPushPort) {}

  execute(): Promise<string | null> {
    return Promise.resolve(this.push.publicKey);
  }
}
