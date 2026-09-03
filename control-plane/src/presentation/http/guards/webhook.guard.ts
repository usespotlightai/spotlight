import {
  WORKSPACE_READER,
  type WorkspaceReaderPort,
} from '@application/ports/workspace-reader.port';
import { SourceForDelivery } from '@application/services/source-for-delivery.service';
import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

interface DeliveredRequest {
  readonly rawBody?: Uint8Array;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly body?: unknown;
  readonly params?: Record<string, string>;
  /** Written here for the controller, which would otherwise look it up twice. */
  deliveredTo?: { workspaceId: string; teamId: string };
}

@Injectable()
export class WebhookGuard implements CanActivate {
  constructor(
    private readonly sources: SourceForDelivery,
    @Inject(WORKSPACE_READER)
    private readonly workspaces: WorkspaceReaderPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<DeliveredRequest>();
    const slug = request.params?.slug;
    const teamKey = request.params?.teamKey;

    // The door says whose it is. A team nobody here has is turned away
    // exactly like a bad signature, so knocking tells you nothing.
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

    request.deliveredTo = at ?? { workspaceId: '', teamId: '' };

    return true;
  }
}
