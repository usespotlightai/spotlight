import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  forbiddenTo,
  type ResourceCreated,
  type ResourceUpdated,
} from '@shared-kernel/application/dto/resource-outcomes.dto';
import { actorFor } from '@shared-kernel/domain/value-objects/change-actor.fake-spec';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { CreateLineCommand } from '@work/application/commands/create-line.command';
import { UpdateLineCommand } from '@work/application/commands/update-line.command';
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
  const workspaceId = `reconcile-${Date.now()}`;
  let seat: Awaited<ReturnType<typeof seatTeam>>;

  const apply = async <T extends { readonly key: string }>(
    definition: T,
    by = seat.owner,
  ): Promise<ResourceCreated | ResourceUpdated | null> => {
    const existing = (await lines.ofTeam(TeamId.of(workspaceId))).find(
      (each) => each.key.value === definition.key,
    );

    return existing
      ? commands.execute<UpdateLineCommand, ResourceUpdated | null>(
          new UpdateLineCommand(
            existing.id.value,
            actorFor(by),
            existing.version,
            definition,
          ),
        )
      : commands.execute<CreateLineCommand, ResourceCreated | null>(
          new CreateLineCommand(
            workspaceId,
            actorFor(by),
            randomUUID(),
            definition,
          ),
        );
  };

  const applied = async <T extends { readonly key: string }>(
    definition: T,
  ): Promise<Line> => {
    const result = await apply(definition);

    if (result?.outcome !== 'created' && result?.outcome !== 'updated') {
      throw new Error(JSON.stringify(result));
    }

    return (await lines.find(LineId.of(result.id))) as Line;
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

    seat = await seatTeam(db, workspaceId);
  });

  afterEach(async () => {
    await seat.unseat();
    await app.close();
  });

  it('creates a line the team does not have, as its definition says', async () => {
    const created = await applied(DELIVERY);

    expect(created.stations.map((each) => each.key.value)).toEqual(
      DELIVERY.stations.map((each) => each.key),
    );
  });

  it('adds a station the definition describes and drops one it no longer does', async () => {
    const created = await applied(DELIVERY);
    const read = await applied(withDesign(DELIVERY));
    const rows = await db
      .select({ key: schema.station.key })
      .from(schema.station)
      .where(eq(schema.station.lineId, created.id.value));

    const keys = DELIVERY.stations.map((each) =>
      each.key === 'spec' ? 'design' : each.key,
    );
    expect(read.id).toEqual(created.id);
    expect(read.stations.map((each) => each.key.value)).toEqual(keys);
    expect(rows.map((each) => each.key).sort()).toEqual([...keys].sort());
    expect(
      read.stations
        .find((each) => each.key.value === 'design')
        ?.routes.stations.map((to) => read.stationAt(to)?.key.value),
    ).toEqual(['implementation']);
  });

  it('leaves every station it keeps the station it was', async () => {
    const created = await applied(DELIVERY);
    const read = await applied({ ...DELIVERY, name: 'Shipping' });

    expect(read.name.value).toBe('Shipping');
    expect(read.stations.map((each) => each.id.value)).toEqual(
      created.stations.map((each) => each.id.value),
    );
  });

  it('says where a definition is wrong, and changes nothing', async () => {
    const created = await applied(DELIVERY);

    expect(
      await apply({
        ...DELIVERY,
        name: 'Broken',
        reactions: [{ happening: 'github.checks.failed', to: 'nowhere' }],
      }),
    ).toMatchObject({
      outcome: 'invalid',
      problems: [
        { path: 'lines/delivery', field: FieldPath.dotted('reactions.0.to') },
      ],
    });
    expect((await lines.find(created.id))?.name.value).toBe(DELIVERY.name);
  });

  it('forbids a member who does not administer the workspace, changing nothing', async () => {
    expect(await apply(DELIVERY, seat.member)).toEqual(
      forbiddenTo('configure'),
    );
    expect(await lines.ofTeam(TeamId.of(workspaceId))).toEqual([]);
  });
});
