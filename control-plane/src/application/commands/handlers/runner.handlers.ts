import type {
  AppendRunEventsCommand,
  ClaimRunCommand,
  CompleteRunCommand,
  EnqueueRunCommand,
  EnrolRunnerCommand,
  RegisterRunnerCommand,
  RenewLeaseCommand,
  RevokeRunnerCommand,
} from '@application/commands/runner.commands';
import type {
  ClaimedRunDto,
  EnqueuedRunDto,
  EnrolledRunnerDto,
  RegisteredRunnerDto,
} from '@application/dto/run.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { HandoverPort } from '@application/ports/handover.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { RunStreamPort } from '@application/ports/run-stream.port';
import type { RunnerRevocationPort } from '@application/ports/runner-revocation.port';
import type { RunnerTokenPort } from '@application/ports/runner-token.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import { Run } from '@domain/aggregates/run.aggregate';
import { Runner } from '@domain/aggregates/runner.aggregate';
import { UnknownRunError } from '@domain/exceptions/unknown-run.error';
import type { RunRepository } from '@domain/repositories/run.repository';
import type { RunnerRepository } from '@domain/repositories/runner.repository';
import { Declaration } from '@domain/value-objects/declaration.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { RunnerName } from '@domain/value-objects/runner-name.vo';
import { UnknownHarnessError } from '@domain/exceptions/unknown-harness.error';
import { harnessNamed } from '@domain/value-objects/built-in-harnesses';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { TokenHash } from '@domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

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

/**
 * A runner checking in. Its identity comes from the token it presented, so a
 * restart lands on the record it already had instead of making another one.
 */
export class RegisterRunnerHandler
  implements CommandHandlerPort<RegisterRunnerCommand, RegisteredRunnerDto>
{
  constructor(
    private readonly runners: RunnerRepository,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: RegisterRunnerCommand): Promise<RegisteredRunnerDto> {
    try {
      const id = RunnerId.of(command.runnerId);

      const registering = await this.runners.find(id);
      if (!registering) {
        throw new UnknownRunError(`runner ${command.runnerId} is not enrolled`);
      }

      const found = command.harnesses.map(HarnessId.of);

      await this.transaction.run(async () => {
        registering.reports(found);
        registering.seen(this.clock.now());
        await this.runners.save(registering);
      });

      return { runnerId: registering.id.value };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

export class RevokeRunnerHandler
  implements CommandHandlerPort<RevokeRunnerCommand, void>
{
  constructor(
    private readonly runners: RunnerRepository,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
    private readonly revocation: RunnerRevocationPort,
  ) {}

  async execute(command: RevokeRunnerCommand): Promise<void> {
    try {
      const id = RunnerId.of(command.runnerId);

      const revoking = await this.runners.find(id);
      if (!revoking) {
        throw new UnknownRunError(`runner ${command.runnerId} is not enrolled`);
      }

      revoking.revoke(this.clock.now());

      await this.transaction.run(async () => {
        await this.runners.save(revoking);

        for (const event of revoking.pullEvents()) {
          await this.revocation.onRunnerRevoked(event);
        }
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

/**
 * How long a claim is held open before answering empty. The runner polls in a
 * tight loop, so holding the request here is what keeps it off the database.
 */
const POLL_TIMEOUT_MS = 10_000;
const POLL_INTERVAL_MS = 500;

export class ClaimRunHandler
  implements CommandHandlerPort<ClaimRunCommand, ClaimedRunDto | null>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly runners: RunnerRepository,
    private readonly clock: ClockPort,
    private readonly handover: HandoverPort,
  ) {}

  async execute(command: ClaimRunCommand): Promise<ClaimedRunDto | null> {
    try {
      const runnerId = RunnerId.of(command.runnerId);

      const asking = await this.runners.find(runnerId);
      if (!asking) {
        throw new UnknownRunError(
          `runner ${command.runnerId} is not registered`,
        );
      }

      // The poll doubles as the heartbeat. A runner that stops asking stops
      // being counted on.
      asking.seen(this.clock.now());
      await this.runners.save(asking);

      // Once per claim, not per attempt. A runner whose host died leaves a run
      // held until its lease lapses, and somebody has to notice.
      for (const abandoned of await this.runs.requeueLapsed(this.clock.now())) {
        await this.handover.handOver(abandoned);
      }

      const deadline = this.clock.now().getTime() + POLL_TIMEOUT_MS;

      for (;;) {
        const claimed = await this.runs.claimNext(
          asking.harnesses,
          runnerId,
          this.clock.now(),
        );

        if (claimed) {
          return {
            id: claimed.id.value,
            spec: claimed.spec,
            leaseExpiresAt: (
              claimed.leaseExpiresAt ?? this.clock.now()
            ).toISOString(),
          };
        }

        if (this.clock.now().getTime() >= deadline) {
          return null;
        }

        await this.clock.sleep(POLL_INTERVAL_MS);
      }
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

export class RenewLeaseHandler
  implements CommandHandlerPort<RenewLeaseCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly runners: RunnerRepository,
    private readonly clock: ClockPort,
    private readonly transaction: TransactionPort,
  ) {}

  async execute(command: RenewLeaseCommand): Promise<void> {
    try {
      const renewing = RunnerId.of(command.runnerId);
      const at = this.clock.now();

      const holder = await this.runners.find(renewing);
      if (!holder) {
        throw new UnknownRunError(`runner ${command.runnerId} is not enrolled`);
      }

      const found = await this.load(command.runId);
      found.renewLease(renewing, at);

      await this.transaction.run(async () => {
        await this.runs.save(found);
        holder.seen(at);
        await this.runners.save(holder);
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }

  private async load(id: string): Promise<Run> {
    const found = await this.runs.findById(RunId.of(id));
    if (!found) {
      throw new UnknownRunError(`there is no run ${id}`);
    }
    return found;
  }
}

export class AppendRunEventsHandler
  implements CommandHandlerPort<AppendRunEventsCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly stream: RunStreamPort,
  ) {}

  async execute(command: AppendRunEventsCommand): Promise<void> {
    try {
      const id = RunId.of(command.runId);

      const journalling = await this.runs.findById(id);
      if (!journalling) {
        throw new UnknownRunError(`there is no run ${command.runId}`);
      }

      await this.runs.appendEvents(
        id,
        journalling.attempt,
        command.events.map((event) => ({
          seq: event.seq,
          type: event.type,
          at: new Date(event.at),
          message: event.message,
          data: event.data,
          offset: event.offset,
        })),
      );
      this.stream.publish(
        command.runId,
        command.events.map((event) => ({
          seq: event.seq,
          type: event.type,
          at: event.at,
          message: event.message,
          data: event.data,
          offset: event.offset,
        })),
      );
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

export class CompleteRunHandler
  implements CommandHandlerPort<CompleteRunCommand, void>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly transaction: TransactionPort,
    private readonly handover: HandoverPort,
  ) {}

  async execute(command: CompleteRunCommand): Promise<void> {
    try {
      await this.transaction.run(async () => {
        const found = await this.runs.findById(RunId.of(command.runId));
        if (!found) {
          throw new UnknownRunError(`there is no run ${command.runId}`);
        }

        found.complete(RunnerId.of(command.runnerId), {
          exitCode: command.exitCode,
          failed: command.failed,
          message: command.message,
        });

        await this.runs.save(found);
        await this.handover.handOver(
          found,
          command.declared ? Declaration.of(command.declared) : null,
        );
      });
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}

export class EnqueueRunHandler
  implements CommandHandlerPort<EnqueueRunCommand, EnqueuedRunDto>
{
  constructor(
    private readonly runs: RunRepository,
    private readonly ids: IdGeneratorPort,
  ) {}

  async execute(command: EnqueueRunCommand): Promise<EnqueuedRunDto> {
    try {
      const harness = harnessNamed(HarnessId.of(command.harness));
      if (!harness) {
        throw new UnknownHarnessError(command.harness);
      }

      const queued = Run.enqueue({
        id: RunId.of(this.ids.generate()),
        workspaceId: WorkspaceId.of(command.workspaceId),
        harness: harness.id,
        // How to start a harness is not the caller's to know.
        spec: {
          ...(command.spec as Record<string, unknown>),
          command: harness.command.started(),
        },
        targetRunner: command.targetRunnerId
          ? RunnerId.of(command.targetRunnerId)
          : null,
      });

      await this.runs.add(queued);

      return {
        id: queued.id.value,
        harness: queued.harness.value,
        state: queued.state,
        targetRunnerId: queued.targetRunner?.value ?? null,
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
