import { RunnerEnrolled } from '@runners/domain/events/runner-enrolled.event';
import { RunnerRegistered } from '@runners/domain/events/runner-registered.event';
import { RunnerReportedHarnesses } from '@runners/domain/events/runner-reported-harnesses.event';
import { RunnerRevoked } from '@runners/domain/events/runner-revoked.event';
import { InstalledHarness } from '@runners/domain/value-objects/installed-harness.vo';
import { RunnerName } from '@runners/domain/value-objects/runner-name.vo';

export const RUNNERS_EVENT_TYPES = [
  InstalledHarness,
  RunnerName,
  RunnerEnrolled,
  RunnerRegistered,
  RunnerReportedHarnesses,
  RunnerRevoked,
] as const;
