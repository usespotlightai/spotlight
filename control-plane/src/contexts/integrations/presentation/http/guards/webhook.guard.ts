import {
  WORKSPACE_READER,
  type WorkspaceReaderPort,
} from '@identity/application/ports/workspace-reader.port';
import type {
  Delivered,
  WebhookSourcePort,
} from '@integrations/application/ports/webhook-source.port';
import { SourceForDelivery } from '@integrations/application/services/source-for-delivery.service';
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
  deliveredTo?: { workspaceId: string; teamId: string };
  answered?: string | null;
}

@Injectable()
export class WebhookGuard implements CanActivate {
  constructor(
    private readonly sources: SourceForDelivery,
    @Inject(WORKSPACE_READER)
    private readonly workspaces: WorkspaceReaderPort,
    @Inject(LOGGER)
    private readonly logger: LoggerPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<DeliveredRequest>();
    const slug = request.params?.slug;
    const teamKey = request.params?.teamKey;

    const at =
      slug && teamKey
        ? await this.workspaces.identifyTeam(slug, teamKey)
        : { workspaceId: '', teamId: '' };

    const source = at
      ? await this.sources.find({
          workspaceId: at.workspaceId,
          teamId: at.teamId,
          teamKey: teamKey ?? '',
          source: request.params?.source ?? '',
        })
      : null;

    const delivered = {
      headers: request.headers,
      body: request.body,
      raw: request.rawBody ?? null,
    };

    // Unknown teams and sources fail as bad signatures do. This gives no data to the caller.
    if (!source || !(await this.trusts(source, delivered))) {
      throw new UnauthorizedException();
    }

    request.deliveredTo = at ?? { workspaceId: '', teamId: '' };
    request.answered = source.answer?.(delivered) ?? null;

    return true;
  }

  private async trusts(
    source: WebhookSourcePort,
    delivered: Delivered,
  ): Promise<boolean> {
    try {
      return await source.verifies(delivered);
    } catch (error) {
      this.logger.warn(
        { source: source.key, error: (error as Error).message },
        'A webhook delivery could not be verified',
      );

      return false;
    }
  }
}
