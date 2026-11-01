import type { CallSecretFetchesPort } from '@secrets/application/ports/call-secret-fetches.port';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type { TokenIssuer } from '@shared-kernel/application/ports/token-issuer.port';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import type { RedeemCallSecretsCommand } from '@work/application/commands/host-call.commands';
import type { RedeemCallSecretsDto } from '@work/application/dto/host-call.dto';
import type { NetworkCall } from '@work/domain/aggregates/network-call.aggregate';
import { CallSecretsExpiredError } from '@work/domain/exceptions/call-secrets-expired.error';
import { CallSecretsRedeemedError } from '@work/domain/exceptions/call-secrets-redeemed.error';
import { InvalidNetworkCallError } from '@work/domain/exceptions/invalid-network-call.error';
import { InvalidNetworkCallTransitionError } from '@work/domain/exceptions/invalid-network-call-transition.error';
import { NetworkCallVersionConflictError } from '@work/domain/exceptions/network-call-version-conflict.error';
import { NotThisHostsCallError } from '@work/domain/exceptions/not-this-hosts-call.error';
import { WrongCallSecretsTokenError } from '@work/domain/exceptions/wrong-call-secrets-token.error';
import type { NetworkCallRepository } from '@work/domain/repositories/network-call.repository';
import { CallingHost } from '@work/domain/value-objects/calling-host.vo';
import { NetworkCallId } from '@work/domain/value-objects/network-call-id.vo';

const TAKEN = [
  CallSecretsRedeemedError,
  NotThisHostsCallError,
  InvalidNetworkCallTransitionError,
];

const textOf = (value: unknown): string =>
  typeof value === 'string' ? value : '';

export class RedeemCallSecretsHandler
  implements CommandHandlerPort<RedeemCallSecretsCommand, RedeemCallSecretsDto>
{
  constructor(
    private readonly calls: NetworkCallRepository,
    private readonly fetches: CallSecretFetchesPort,
    private readonly tokens: TokenIssuer,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    command: RedeemCallSecretsCommand,
  ): Promise<RedeemCallSecretsDto> {
    try {
      const token = textOf(command.token);

      if (token === '') {
        return { outcome: 'unauthorized' };
      }

      const call = await this.found(command.callId);

      if (!call) {
        return { outcome: 'unauthorized' };
      }

      let redeemed: NetworkCall;

      try {
        redeemed = call.redeemSecrets(
          CallingHost.of(textOf(command.host)),
          TokenHash.of(this.tokens.hash(token)),
          this.clock.now(),
        );
      } catch (error) {
        return refusalOf(error);
      }

      const fetched = await this.fetches.sealedForCall({
        workspaceId: call.workspaceId.value,
        callId: call.id.value,
        secrets: call.secrets.map((each) => each.value),
        recipient: textOf(command.recipient),
      });

      try {
        await this.calls.save(redeemed);
      } catch (error) {
        if (error instanceof NetworkCallVersionConflictError) {
          return {
            outcome: 'taken',
            reason: `Network call ${call.id.value} changed while its secrets were redeemed.`,
          };
        }

        throw error;
      }

      return {
        outcome: 'fetched',
        runId: call.id.value,
        extraAllowedHosts: [],
        bound: [...new Set(fetched.secrets.map((each) => each.host))].sort(),
        secrets: fetched.secrets,
        denied: fetched.denied,
        spotlightApi: null,
      };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }

  private async found(callId: string): Promise<NetworkCall | null> {
    let id: NetworkCallId;

    try {
      id = NetworkCallId.of(callId);
    } catch (error) {
      if (error instanceof InvalidNetworkCallError) {
        return null;
      }

      throw error;
    }

    return this.calls.find(id);
  }
}

const refusalOf = (error: unknown): RedeemCallSecretsDto => {
  if (
    error instanceof WrongCallSecretsTokenError ||
    error instanceof InvalidNetworkCallError
  ) {
    return { outcome: 'unauthorized' };
  }

  if (error instanceof CallSecretsExpiredError) {
    return { outcome: 'expired', reason: error.message };
  }

  if (TAKEN.some((kind) => error instanceof kind)) {
    return { outcome: 'taken', reason: (error as Error).message };
  }

  throw error;
};
