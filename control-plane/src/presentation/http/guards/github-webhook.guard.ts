import {
  WEBHOOK_SIGNATURE,
  type WebhookSignaturePort,
} from '@application/ports/webhook-signature.port';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

interface SignedRequest {
  readonly rawBody?: Uint8Array;
  readonly headers: Record<string, string | string[] | undefined>;
}

const headed = (request: SignedRequest, name: string): string | undefined => {
  const value = request.headers[name];

  return Array.isArray(value) ? value[0] : value;
};

@Injectable()
export class GitHubWebhookGuard implements CanActivate {
  constructor(
    @Inject(WEBHOOK_SIGNATURE)
    private readonly signature: WebhookSignaturePort,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<SignedRequest>();

    if (
      !request.rawBody ||
      !this.signature.signs(
        request.rawBody,
        headed(request, 'x-hub-signature-256'),
      )
    ) {
      throw new UnauthorizedException();
    }

    return true;
  }
}
