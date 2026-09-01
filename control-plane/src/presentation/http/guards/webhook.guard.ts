import { WebhookSources } from '@application/services/webhook-sources.service';
import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

interface DeliveredRequest {
  readonly rawBody?: Uint8Array;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body?: unknown;
  readonly params?: Record<string, string>;
}

@Injectable()
export class WebhookGuard implements CanActivate {
  constructor(private readonly sources: WebhookSources) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<DeliveredRequest>();
    const source = this.sources.find(request.params?.source ?? '');

    // A source nobody registered is turned away the same way a bad signature
    // is, so posting at the door tells you nothing about what is behind it.
    if (
      !source?.verifies({
        headers: request.headers,
        body: request.body,
        raw: request.rawBody ?? null,
      })
    ) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
