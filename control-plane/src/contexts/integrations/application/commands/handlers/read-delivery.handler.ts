import type { ReadDeliveryCommand } from '@integrations/application/commands/read-delivery.command';
import type { HookFiringHistoryPort } from '@integrations/application/ports/hook-firing-history.port';
import type { ProviderForDelivery } from '@integrations/application/services/provider-for-delivery.service';
import { CauseLinks } from '@integrations/domain/services/cause-links';
import { DeliveryFailure } from '@integrations/domain/value-objects/delivery-failure.vo';
import { HookFiringId } from '@integrations/domain/value-objects/hook-firing-id.vo';
import {
  ApplicationError,
  type ApplicationErrorKind,
} from '@shared-kernel/application/errors/application-error';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import { UpstreamError } from '@shared-kernel/application/errors/upstream.error';
import type { CausationPort } from '@shared-kernel/application/ports/causation.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import {
  DomainError,
  type DomainErrorKind,
} from '@shared-kernel/domain/exceptions/domain-error';
import { CausalChain } from '@shared-kernel/domain/value-objects/causal-chain.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { HappeningReactionsPort } from '@work/application/ports/happening-reactions.port';

type FailureKind = DomainErrorKind | ApplicationErrorKind;

const PERMANENT_KINDS: ReadonlySet<FailureKind> = new Set([
  'invalid',
  'not-allowed',
  'not-found',
]);

const kindOf = (error: unknown): FailureKind | null =>
  error instanceof DomainError || error instanceof ApplicationError
    ? error.kind
    : null;

const failureOf = (error: unknown): DeliveryFailure | null => {
  if (error instanceof UpstreamError) {
    return error.retryable
      ? DeliveryFailure.transient(error.message)
      : DeliveryFailure.permanent(error.message);
  }

  const kind = kindOf(error);

  if (kind === 'conflict') {
    return DeliveryFailure.transient((error as Error).message);
  }

  return kind !== null && PERMANENT_KINDS.has(kind)
    ? DeliveryFailure.permanent((error as Error).message)
    : null;
};

export class ReadDeliveryHandler
  implements CommandHandlerPort<ReadDeliveryCommand, DeliveryFailure | null>
{
  constructor(
    private readonly providers: ProviderForDelivery,
    private readonly reactions: HappeningReactionsPort,
    private readonly history: HookFiringHistoryPort,
    private readonly causation: CausationPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(command: ReadDeliveryCommand): Promise<DeliveryFailure | null> {
    try {
      await this.read(command);

      return null;
    } catch (error) {
      const failure = failureOf(error);

      if (failure) {
        return failure;
      }

      rethrowAsApplicationError(error);
    }
  }

  private async read(command: ReadDeliveryCommand): Promise<void> {
    {
      const stored = command.delivered;
      const provider = await this.providers.find({
        integration: stored.integration,
        to: stored.to,
      });

      if (!provider) {
        this.ignored(stored, 'no-provider');
        return;
      }

      const delivered = {
        headers: stored.headers,
        body: stored.body,
        raw: null,
      };

      const news = (await provider.read(delivered)).filter(
        (each) => !each.ourOwn,
      );

      if (news.length === 0) {
        this.ignored(stored, 'nothing-new');
        return;
      }

      const workspaceId = await provider.routes(delivered);

      if (!workspaceId) {
        this.ignored(stored, 'no-workspace');
        return;
      }

      const cause = stored.causeFiringId;
      const fired = cause
        ? await this.history.chainOf(workspaceId, HookFiringId.of(cause))
        : null;

      await this.causation.runWith(
        this.deliveryChain(fired, stored.integration),
        () =>
          this.reactions.react(
            workspaceId,
            stored.to ? TeamId.of(stored.to.teamId) : null,
            news,
            `delivery:${stored.integration}:${stored.to?.teamId ?? ''}:${stored.id}`,
          ),
      );
    }
  }

  private ignored(
    stored: ReadDeliveryCommand['delivered'],
    reason: 'no-provider' | 'nothing-new' | 'no-workspace',
  ): void {
    this.logger.info(
      {
        deliveryId: stored.id,
        integration: stored.integration,
        workspaceId: stored.to?.workspaceId,
        teamId: stored.to?.teamId,
        reason,
      },
      'Ignored a delivery',
    );
  }

  private deliveryChain(
    fired: CausalChain | null,
    integration: string,
  ): CausalChain {
    return fired
      ? fired.append(CauseLinks.delivery(integration))
      : CausalChain.none();
  }
}
