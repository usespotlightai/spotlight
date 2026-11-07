import {
  type SeededTeam,
  SeedLines,
} from '@lines/application/events/handlers/seed-lines.handler';
import type {
  HeldLine,
  StationHoldersPort,
} from '@lines/application/ports/station-holders.port';
import type { Line } from '@lines/domain/aggregates/line.aggregate';
import type { LineRepository } from '@lines/domain/repositories/line.repository';
import { BUILT_IN_LINES } from '@lines/domain/services/built-in-lines';
import type { IdGeneratorPort } from '@shared-kernel/application/ports/id-generator.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { LineRole } from '@shared-kernel/domain/value-objects/line-role.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const ids = (): IdGeneratorPort => {
  let next = 0;
  return { generate: () => `id_${++next}` };
};

const created: SeededTeam = {
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
};

const seeding = (existing: Line[] = []) => {
  const seeded: Line[] = [...existing];
  const transactions = vi.fn(<T>(work: () => Promise<T>) => work());
  const held: HeldLine[] = [];
  const seeder = new SeedLines(
    {
      add: vi.fn(async (line: Line) => void seeded.push(line)),
      ofTeam: vi.fn(async () => [...seeded]),
    } as unknown as LineRepository,
    {
      hold: vi.fn(async (line: HeldLine) => void held.push(line)),
    } as unknown as StationHoldersPort,
    { inTransaction: transactions } as TransactionPort,
    ids(),
    HarnessId.of('claude-code'),
  );

  return { seeder, seeded, held, transactions };
};

describe('SeedLines', () => {
  it('opens every line a team starts with, for that team, each in its own transaction', async () => {
    const { seeder, seeded, transactions } = seeding();

    await seeder.seed(created);

    expect(seeded.map((line) => line.key.value)).toEqual(
      BUILT_IN_LINES.map((line) => line.key.value),
    );
    expect(seeded.every((line) => line.teamId.equals(created.teamId))).toBe(
      true,
    );
    expect(transactions).toHaveBeenCalledTimes(BUILT_IN_LINES.length);
  });

  it('lets the holders hold the stations of every line it opens', async () => {
    const { seeder, seeded, held } = seeding();

    await seeder.seed(created);

    expect(held.map((line) => line.lineId)).toEqual(
      seeded.map((line) => line.id.value),
    );
  });

  it('opens no line twice when told again', async () => {
    const { seeder, seeded } = seeding();

    await seeder.seed(created);
    await seeder.seed(created);

    expect(seeded).toHaveLength(BUILT_IN_LINES.length);
  });

  it('opens every worked station on the seeding harness, and the rest on none', async () => {
    const { seeder, seeded } = seeding();

    await seeder.seed(created);

    for (const line of seeded) {
      for (const station of line.stations) {
        expect(station.harness?.value ?? null).toBe(
          station.isAgentStation ? 'claude-code' : null,
        );
      }
    }
  });

  it('opens the delivery and review lines and nothing else', async () => {
    const { seeder, seeded } = seeding();

    await seeder.seed(created);

    expect(seeded.map((line) => line.key.value)).toEqual([
      'delivery',
      'review',
    ]);
  });

  it('opens a review line that waits to be mentioned on a pull request', async () => {
    const { seeder, seeded } = seeding();

    await seeder.seed(created);

    const review = seeded.find((line) => line.role?.equals(LineRole.REVIEW));

    expect(review?.name.value).toBe('Review');
    expect(review?.reviews?.start).toBe('mentioned');
  });
});
