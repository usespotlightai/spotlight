import { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { DefineLineCommand } from '@work/application/commands/define-line.command';
import type { DefinedLineDto } from '@work/application/dto/line-resource.dto';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import {
  BUILT_IN_LINES,
  type LineOpening,
} from '@work/domain/services/built-in-lines';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { DrizzleLineRepository } from '@work/infrastructure/persistence/drizzle/repositories/line.repository';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '@/app.module';
import { definitionOf, type LineDefinition } from './support/line-definition';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const DELIVERY = definitionOf(BUILT_IN_LINES[0] as LineOpening);

const withDesign = (line: LineDefinition): LineDefinition => ({
  ...line,
  stations: line.stations.map((each) =>
    each.key === 'spec'
      ? {
          ...each,
          key: 'design',
          name: 'Design',
          color: '#5c66d9',
          tools: [],
          passesTo: ['implementation'],
        }
      : {
          ...each,
          passesTo: each.passesTo.map((to) => (to === 'spec' ? 'design' : to)),
        },
  ),
});

describe('a line reconciled with its definition (e2e)', () => {
  let app: INestApplication;
  let lines: DrizzleLineRepository;
  let db: DrizzleDatabase;
  let commands: CommandBus;
  const held = `reconcile-${Date.now()}`;
  let seat: Awaited<ReturnType<typeof seatTeam>>;

  const define = (definition: unknown, by = seat.owner) =>
    commands.execute<DefineLineCommand, DefinedLineDto | null>(
      new DefineLineCommand(held, by, definition),
    );

  const defined = async (definition: unknown): Promise<Line> => {
    const result = await define(definition);

    if (!result?.ok) {
      throw new Error(JSON.stringify(result));
    }

    return (await lines.find(LineId.of(result.line.id))) as Line;
  };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    lines = app.get(DrizzleLineRepository);
    db = app.get(DRIZZLE);
    commands = app.get(CommandBus);

    seat = await seatTeam(db, held);
  });

  afterEach(async () => {
    await seat.unseat();
    await app.close();
  });

  it('opens a line the team does not have, and keeps its definition', async () => {
    const opened = await defined(DELIVERY);
    const [kept] = await db
      .select()
      .from(schema.lineDefinition)
      .where(eq(schema.lineDefinition.lineId, opened.id.value));

    expect(opened.stations.map((each) => each.key.value)).toEqual(
      DELIVERY.stations.map((each) => each.key),
    );
    expect(kept?.definition).toMatchObject({ key: 'delivery' });
  });

  it('adds a station the definition describes and drops one it no longer does', async () => {
    const opened = await defined(DELIVERY);
    const read = await defined(withDesign(DELIVERY));
    const rows = await db
      .select({ key: schema.station.key })
      .from(schema.station)
      .where(eq(schema.station.lineId, opened.id.value));

    const keys = DELIVERY.stations.map((each) =>
      each.key === 'spec' ? 'design' : each.key,
    );
    expect(read.id).toEqual(opened.id);
    expect(read.stations.map((each) => each.key.value)).toEqual(keys);
    expect(rows.map((each) => each.key).sort()).toEqual([...keys].sort());
    expect(
      read.stations
        .find((each) => each.key.value === 'design')
        ?.wayOut.stations.map((to) => read.stationAt(to)?.key.value),
    ).toEqual(['implementation']);
  });

  it('leaves every station it keeps the station it was', async () => {
    const opened = await defined(DELIVERY);
    const read = await defined({ ...DELIVERY, name: 'Shipping' });

    expect(read.name.value).toBe('Shipping');
    expect(read.stations.map((each) => each.id.value)).toEqual(
      opened.stations.map((each) => each.id.value),
    );
  });

  it('says where a definition is wrong, and changes nothing', async () => {
    const opened = await defined(DELIVERY);

    expect(
      await define({
        ...DELIVERY,
        name: 'Broken',
        reactions: [{ happening: 'github.checks.failed', to: 'nowhere' }],
      }),
    ).toMatchObject({
      ok: false,
      problems: [
        { path: 'lines/delivery', field: FieldPath.dotted('reactions.0.to') },
      ],
    });
    expect((await lines.find(opened.id))?.name.value).toBe(DELIVERY.name);
  });

  it('defines nothing for a member who does not administer the workspace', async () => {
    expect(await define(DELIVERY, seat.member)).toBeNull();
    expect(await lines.ofTeam(TeamId.of(held))).toEqual([]);
  });
});
