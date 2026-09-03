import { SetLineReactionsHandler } from '@application/commands/handlers/set-line-reactions.handler';
import { SetLineReactionsCommand } from '@application/commands/set-line-reactions.command';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { TransactionPort } from '@application/ports/transaction.port';
import type {
  HappeningDeclaration,
  WebhookSourcePort,
} from '@application/ports/webhook-source.port';
import { WebhookSources } from '@application/services/webhook-sources.service';
import { AssemblyLine } from '@domain/aggregates/assembly-line.aggregate';
import { Station } from '@domain/entities/station.entity';
import type { AssemblyLineRepository } from '@domain/repositories/assembly-line.repository';
import { AssemblyLineId } from '@domain/value-objects/assembly-line-id.vo';
import { AssemblyLineName } from '@domain/value-objects/assembly-line-name.vo';
import { FactoryId } from '@domain/value-objects/factory-id.vo';
import { Happening } from '@domain/value-objects/happening.vo';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { StationColor } from '@domain/value-objects/station-color.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { StationName } from '@domain/value-objects/station-name.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const COMMENTED = 'github.pull_request.commented';
const MERGED = 'github.pull_request.merged';

const transaction: TransactionPort = { run: (work) => work() };

const declares = (...keys: string[]): HappeningDeclaration[] =>
  keys.map((key) => ({
    happening: Happening.of(key),
    label: key,
    told: `${key} happened.`,
    spoken: false,
  }));

const sources = WebhookSources.of([
  {
    key: 'github',
    happenings: declares(COMMENTED, MERGED),
    verifies: () => true,
    delivery: () => 'delivery_1',
    routes: async () => null,
    read: () => [],
  } satisfies WebhookSourcePort,
]);

const at = (
  id: string,
  name: string,
  position: number,
  kind: 'backlog' | 'work' | 'completed' = 'work',
) =>
  Station.create({
    id: StationId.of(id),
    name: StationName.of(name),
    position,
    color: StationColor.of('#a3a8b0'),
    harness: kind === 'work' ? HarnessId.of('dev') : undefined,
    kind,
  });

const line = () =>
  AssemblyLine.of({
    id: AssemblyLineId.of('line_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    factoryId: FactoryId.of('factory_1'),
    name: AssemblyLineName.of('Default'),
    stations: [
      at('station_0', 'Backlog', 0, 'backlog'),
      at('station_1', 'Review', 1),
      at('station_2', 'Completed', 2, 'completed'),
    ],
  });

const setting = (found: AssemblyLine | null = line()) => {
  const saved: AssemblyLine[] = [];
  const handler = new SetLineReactionsHandler(
    {
      find: vi.fn(async () => found),
      save: vi.fn(async (each: AssemblyLine) => {
        saved.push(each);
      }),
    } as unknown as AssemblyLineRepository,
    sources,
    transaction,
  );

  return { handler, saved };
};

const rule = (happening: string, to: string, from: string | null = null) => ({
  happening,
  from,
  to,
});

describe('SetLineReactionsHandler', () => {
  it('sets the rules the line is given', async () => {
    const { handler, saved } = setting();

    const dto = await handler.execute(
      new SetLineReactionsCommand('line_1', [rule(COMMENTED, 'station_1')]),
    );

    expect(saved[0]?.reactions).toHaveLength(1);
    expect(dto.reactions).toEqual([
      { happening: COMMENTED, from: null, to: 'station_1' },
    ]);
  });

  it('keeps where a rule says the task must be standing', async () => {
    const { handler, saved } = setting();

    await handler.execute(
      new SetLineReactionsCommand('line_1', [
        rule(COMMENTED, 'station_1', 'station_0'),
      ]),
    );

    expect(saved[0]?.reactions[0]?.from).toEqual(StationId.of('station_0'));
  });

  // Written whole: a rule left out of the set stops applying.
  it('drops what it was not given again', async () => {
    const { handler, saved } = setting(
      line().reactsWith([
        {
          happening: Happening.of(MERGED),
          from: null,
          to: StationId.of('station_2'),
        } as never,
      ]),
    );

    await handler.execute(new SetLineReactionsCommand('line_1', []));

    expect(saved[0]?.reactions).toEqual([]);
  });

  // A station waiting on silence would never react, and never say why.
  it('refuses a word no source here raises', async () => {
    const { handler, saved } = setting();

    await expect(
      handler.execute(
        new SetLineReactionsCommand('line_1', [
          rule('sentry.alert.firing', 'station_1'),
        ]),
      ),
    ).rejects.toBeInstanceOf(UseCaseFault);
    expect(saved).toHaveLength(0);
  });

  it('refuses a word that is not written as one', async () => {
    const { handler, saved } = setting();

    await expect(
      handler.execute(
        new SetLineReactionsCommand('line_1', [rule('merged', 'station_1')]),
      ),
    ).rejects.toBeInstanceOf(UseCaseFault);
    expect(saved).toHaveLength(0);
  });

  it('refuses a rule sending a word off the line', async () => {
    const { handler, saved } = setting();

    await expect(
      handler.execute(
        new SetLineReactionsCommand('line_1', [
          rule(COMMENTED, 'station_elsewhere'),
        ]),
      ),
    ).rejects.toBeInstanceOf(UseCaseFault);
    expect(saved).toHaveLength(0);
  });

  it('refuses two rules that would fork the same word', async () => {
    const { handler, saved } = setting();

    await expect(
      handler.execute(
        new SetLineReactionsCommand('line_1', [
          rule(COMMENTED, 'station_1'),
          rule(COMMENTED, 'station_2'),
        ]),
      ),
    ).rejects.toBeInstanceOf(UseCaseFault);
    expect(saved).toHaveLength(0);
  });

  it('answers with nothing to say about a line that is not there', async () => {
    const { handler } = setting(null);

    await expect(
      handler.execute(new SetLineReactionsCommand('line_1', [])),
    ).rejects.toBeInstanceOf(UseCaseFault);
  });
});
