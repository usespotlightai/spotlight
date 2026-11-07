import type { RunnerAuthenticatorPort } from '@runners/application/ports/runner-authenticator.port';
import type {
  RecordHostCallResponseCommand,
  SentHostCallResponse,
} from '@runs/application/commands/host-call.commands';
import type { RecordHostCallResponseDto } from '@runs/application/dto/host-call.dto';
import { InvalidNetworkCallTransitionError } from '@runs/domain/exceptions/invalid-network-call-transition.error';
import { NetworkCallVersionConflictError } from '@runs/domain/exceptions/network-call-version-conflict.error';
import { NotThisHostsCallError } from '@runs/domain/exceptions/not-this-hosts-call.error';
import type { NetworkCallRepository } from '@runs/domain/repositories/network-call.repository';
import { CallingHost } from '@runs/domain/value-objects/calling-host.vo';
import { NetworkCallId } from '@runs/domain/value-objects/network-call-id.vo';
import { NetworkResponse } from '@runs/domain/value-objects/network-response.vo';
import { rethrowAsApplicationError } from '@shared-kernel/application/errors/rethrow-as-application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';

const texts = (raw: unknown): Record<string, string> =>
  raw && typeof raw === 'object'
    ? Object.fromEntries(
        Object.entries(raw).filter(
          (each): each is [string, string] => typeof each[1] === 'string',
        ),
      )
    : {};

const responseOf = (sent: SentHostCallResponse): NetworkResponse =>
  NetworkResponse.of({
    status: Number(sent.status),
    headers: texts(sent.headers),
    body: new Uint8Array(
      Buffer.from(typeof sent.body === 'string' ? sent.body : '', 'base64'),
    ),
    ms: Number(sent.ms),
    error: typeof sent.error === 'string' ? sent.error : null,
  });

export class RecordHostCallResponseHandler
  implements
    CommandHandlerPort<RecordHostCallResponseCommand, RecordHostCallResponseDto>
{
  constructor(
    private readonly authenticator: RunnerAuthenticatorPort,
    private readonly calls: NetworkCallRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(
    command: RecordHostCallResponseCommand,
  ): Promise<RecordHostCallResponseDto> {
    try {
      const authenticated = await this.authenticator.authenticate(
        command.credential,
      );

      if (!authenticated) {
        return { outcome: 'unauthorized' };
      }

      const call = await this.calls.find(NetworkCallId.of(command.callId));

      if (!call?.belongsTo(authenticated.workspaceId)) {
        return { outcome: 'unknown' };
      }

      const host = CallingHost.of(
        typeof command.response.host === 'string' ? command.response.host : '',
      );
      const response = responseOf(command.response);

      try {
        await this.calls.save(
          call.recordResponse(host, response, this.clock.now()),
        );
      } catch (error) {
        if (error instanceof InvalidNetworkCallTransitionError) {
          return { outcome: 'completed', reason: error.message };
        }

        if (error instanceof NetworkCallVersionConflictError) {
          return {
            outcome: 'completed',
            reason:
              'The network call completed while the host recorded its response.',
          };
        }

        if (error instanceof NotThisHostsCallError) {
          return { outcome: 'not-theirs' };
        }

        throw error;
      }

      return { outcome: 'answered' };
    } catch (error) {
      rethrowAsApplicationError(error);
    }
  }
}
