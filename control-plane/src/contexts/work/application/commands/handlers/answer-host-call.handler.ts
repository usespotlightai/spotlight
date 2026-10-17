import type { RunnerAdmissionsPort } from '@runners/application/ports/runner-admissions.port';
import { rethrowAsFault } from '@shared-kernel/application/errors/rethrow-as-fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { CommandHandlerPort } from '@shared-kernel/application/ports/command-handler.port';
import type {
  AnswerHostCallCommand,
  SentHostCallAnswer,
} from '@work/application/commands/host-call.commands';
import type { HostCallAnswerDto } from '@work/application/dto/host-call.dto';
import { InvalidNetworkCallTransitionError } from '@work/domain/exceptions/invalid-network-call-transition.error';
import { NetworkCallVersionConflictError } from '@work/domain/exceptions/network-call-version-conflict.error';
import { NotThisHostsCallError } from '@work/domain/exceptions/not-this-hosts-call.error';
import type { NetworkCallRepository } from '@work/domain/repositories/network-call.repository';
import { CallingHost } from '@work/domain/value-objects/calling-host.vo';
import { NetworkAnswer } from '@work/domain/value-objects/network-answer.vo';
import { NetworkCallId } from '@work/domain/value-objects/network-call-id.vo';

const texts = (raw: unknown): Record<string, string> =>
  raw && typeof raw === 'object'
    ? Object.fromEntries(
        Object.entries(raw).filter(
          (each): each is [string, string] => typeof each[1] === 'string',
        ),
      )
    : {};

const answerOf = (sent: SentHostCallAnswer): NetworkAnswer =>
  NetworkAnswer.of({
    status: Number(sent.status),
    headers: texts(sent.headers),
    body: new Uint8Array(
      Buffer.from(typeof sent.body === 'string' ? sent.body : '', 'base64'),
    ),
    ms: Number(sent.ms),
    error: typeof sent.error === 'string' ? sent.error : null,
  });

export class AnswerHostCallHandler
  implements CommandHandlerPort<AnswerHostCallCommand, HostCallAnswerDto>
{
  constructor(
    private readonly admissions: RunnerAdmissionsPort,
    private readonly calls: NetworkCallRepository,
    private readonly clock: ClockPort,
  ) {}

  async execute(command: AnswerHostCallCommand): Promise<HostCallAnswerDto> {
    try {
      const admitted = await this.admissions.admit(command.credential);

      if (!admitted) {
        return { outcome: 'refused' };
      }

      const call = await this.calls.find(NetworkCallId.of(command.callId));

      if (!call?.belongsTo(admitted.workspaceId)) {
        return { outcome: 'unknown' };
      }

      const host = CallingHost.of(
        typeof command.answer.host === 'string' ? command.answer.host : '',
      );
      const answer = answerOf(command.answer);

      try {
        await this.calls.save(
          call.answeredWith(host, answer, this.clock.now()),
        );
      } catch (error) {
        if (error instanceof InvalidNetworkCallTransitionError) {
          return { outcome: 'settled', reason: error.message };
        }

        if (error instanceof NetworkCallVersionConflictError) {
          return {
            outcome: 'settled',
            reason: 'The network call was settled while the host answered it.',
          };
        }

        if (error instanceof NotThisHostsCallError) {
          return { outcome: 'not-theirs' };
        }

        throw error;
      }

      return { outcome: 'answered' };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
