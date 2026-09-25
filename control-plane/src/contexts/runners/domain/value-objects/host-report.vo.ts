import { InvalidHostReportError } from '@runners/domain/exceptions/invalid-host-report.error';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

const MOST_RUNNING = 1_000;

const bounded = (field: string, raw: string, most: number): string => {
  const held = raw.trim();

  if (!held || held.length > most) {
    throw new InvalidHostReportError(
      field,
      `is between 1 and ${most} characters`,
    );
  }

  return held;
};

export class HostReport {
  private constructor(
    readonly name: string,
    readonly release: string,
    readonly executor: string,
    readonly capacity: number,
    readonly running: readonly RunnerId[],
    readonly harnesses: readonly InstalledHarness[],
  ) {}

  static of(input: {
    name: string;
    release: string;
    executor: string;
    capacity: number;
    running: readonly string[];
    harnesses: readonly {
      id: string;
      models: readonly string[];
      version?: string;
    }[];
  }): HostReport {
    if (
      !Number.isInteger(input.capacity) ||
      input.capacity < 1 ||
      input.capacity > MOST_RUNNING
    ) {
      throw new InvalidHostReportError(
        'capacity',
        `is a whole number from 1 to ${MOST_RUNNING}`,
      );
    }

    if (new Set(input.running).size > input.capacity) {
      throw new InvalidHostReportError(
        'running',
        'names no more runners than its capacity',
      );
    }

    return new HostReport(
      bounded('name', input.name, 120),
      bounded('release', input.release, 64),
      bounded('executor', input.executor, 200),
      input.capacity,
      [...new Set(input.running)].map((id) => RunnerId.of(id)),
      input.harnesses.map((each) =>
        InstalledHarness.reported(each.id, each.models, each.version),
      ),
    );
  }
}
