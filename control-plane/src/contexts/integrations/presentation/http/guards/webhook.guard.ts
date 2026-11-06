import {
  WORKSPACE_READER,
  type WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import type { DeliveryAddressee } from '@integrations/application/ports/delivery-queue.port';
import type {
  Delivered,
  WebhookProviderPort,
} from '@integrations/application/ports/webhook-provider.port';
import { ProviderForDelivery } from '@integrations/application/services/provider-for-delivery.service';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';

interface DeliveredRequest {
  readonly rawBody?: Uint8Array;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body?: unknown;
  readonly params?: Record<string, string>;
  deliveredTo?: DeliveryAddressee | null;
  answered?: string | null;
}

@Injectable()
export class WebhookGuard implements CanActivate {
  constructor(
    private readonly providers: ProviderForDelivery,
    @Inject(WORKSPACE_READER)
    private readonly workspaces: WorkspaceReaderPort,
    @Inject(LOGGER)
    private readonly logger: LoggerPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<DeliveredRequest>();
    const slug = request.params?.slug;
    const teamKey = request.params?.teamKey;

    const team =
      slug && teamKey
        ? await this.workspaces.identifyTeam(slug, teamKey)
        : null;
    const to = team && teamKey ? { ...team, teamKey } : null;
    const known = !(slug && teamKey) || to !== null;

    const provider = known
      ? await this.providers.find({
          integration: request.params?.integration ?? '',
          to,
        })
      : null;

    const delivered = {
      headers: request.headers,
      body: request.body,
      raw: request.rawBody ?? null,
    };

    // Unknown teams and providers fail as bad signatures do. This shows no data to the caller.
    if (!known || !provider || !(await this.trusts(provider, delivered))) {
      this.logger.warn(
        {
          workspaceId: to?.workspaceId,
          teamId: to?.teamId,
          integration: request.params?.integration,
          reason: !known
            ? 'unknown-team'
            : !provider
              ? 'unknown-integration'
              : 'bad-signature',
        },
        'Refused a webhook delivery',
      );
      throw new UnauthorizedException();
    }

    request.deliveredTo = to;
    request.answered = provider.answer?.(delivered) ?? null;

    return true;
  }

  private async trusts(
    provider: WebhookProviderPort,
    delivered: Delivered,
  ): Promise<boolean> {
    try {
      return await provider.verifies(delivered);
    } catch (error) {
      this.logger.warn(
        { integration: provider.key, error: (error as Error).message },
        'A webhook delivery could not be verified',
      );

      return false;
    }
  }
}
