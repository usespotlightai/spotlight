import type {
  AppendRunEventsCommand,
  ClaimRunCommand,
  CompleteRunCommand,
  EnqueueRunCommand,
  RegisterRunnerCommand,
  RenewLeaseCommand,
} from '@application/commands/runner.commands';
import type {
  ClaimedRunDto,
  EnqueuedRunDto,
  RegisteredRunnerDto,
} from '@application/dto/run.dto';
import { rethrowAsFault } from '@application/errors/rethrow-as-fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { CommandHandlerPort } from '@application/ports/command-handler.port';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { RunStreamPort } from '@application/ports/run-stream.port';
import { Run } from '@domain/aggregates/run.aggregate';
import { Runner } from '@domain/aggregates/runner.aggregate';
import { UnknownRunError } from '@domain/exceptions/unknown-run.error';
import type { RunRepository } from '@domain/repositories/run.repository';
import type { RunnerRepository } from '@domain/repositories/runner.repository';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';

export class RegisterRunnerHandler
  implements CommandHandlerPort<RegisterRunnerCommand, RegisteredRunnerDto>
{
  constructor(
    private readonly runners: RunnerRepository,
    private readonly ids: IdGeneratorPort,
  ) {}

  async execute(command: RegisterRunnerCommand): Promise<RegisteredRunnerDto> {
    try {
      const registered = Runner.register({
        id: RunnerId.of(this.ids.generate()),
        pool: command.pool,
        labels: command.labels,
      });

      await this.runners.add(registered);

      return { runnerId: registered.id.value };
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
      await this.runners.touch(runnerId, this.clock.now());

      // Once per claim, not per attempt. A runner whose host died leaves a run
      // held until its lease lapses, and somebody has to notice.
      await this.runs.requeueLapsed(this.clock.now());

      const deadline = this.clock.now().getTime() + POLL_TIMEOUT_MS;

      for (;;) {
        const claimed = await this.runs.claimNext(
          asking.pool,
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
  ) {}

  async execute(command: RenewLeaseCommand): Promise<void> {
    try {
      const renewing = RunnerId.of(command.runnerId);
      const at = this.clock.now();

      const found = await this.load(command.runId);
      found.renewLease(renewing, at);
      await this.runs.save(found);
      await this.runners.touch(renewing, at);
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
  constructor(private readonly runs: RunRepository) {}

  async execute(command: CompleteRunCommand): Promise<void> {
    try {
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
      const queued = Run.enqueue({
        id: RunId.of(this.ids.generate()),
        workspaceId: WorkspaceId.of(command.workspaceId),
        pool: command.pool,
        spec: command.spec,
        targetRunner: command.targetRunnerId
          ? RunnerId.of(command.targetRunnerId)
          : null,
      });

      await this.runs.add(queued);

      return {
        id: queued.id.value,
        pool: queued.pool,
        state: queued.state,
        targetRunnerId: queued.targetRunner?.value ?? null,
      };
    } catch (error) {
      rethrowAsFault(error);
    }
  }
}
