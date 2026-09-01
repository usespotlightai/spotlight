import type { EnrolRunnerCommand } from '@application/commands/runner.commands';
import type { EnrolledRunnerDto } from '@application/dto/run.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { RunnerTokenPort } from '@application/ports/runner-token.port';
import { Runner } from '@domain/aggregates/runner.aggregate';
import type { RunnerRepository } from '@domain/repositories/runner.repository';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { RunnerName } from '@domain/value-objects/runner-name.vo';
import { TokenHash } from '@domain/value-objects/token-hash.vo';

export class EnrolRunnerHandler
  implements CommandHandlerPort<EnrolRunnerCommand, EnrolledRunnerDto>
{
  constructor(
    private readonly runners: RunnerRepository,
    private readonly ids: IdGeneratorPort,
    private readonly tokens: RunnerTokenPort,
  ) {}

  async execute(command: EnrolRunnerCommand): Promise<EnrolledRunnerDto> {
    try {
      const minted = this.tokens.mint();
      const name = RunnerName.of(command.name);

      const enrolled = Runner.enrol({
        id: RunnerId.of(this.ids.generate()),
        name,
        tokenHash: TokenHash.of(minted.hash),
      });

      await this.runners.add(enrolled);

      return {
        runnerId: enrolled.id.value,
        name: name.value,
        token: minted.token,
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
