import { DefineIntegrationCommand } from '@integrations/application/commands/define-integration.command';
import type { DefinedIntegrationDto } from '@integrations/application/dto/integration-resource.dto';
import {
  DEFINED_INTEGRATIONS,
  type DefinedIntegrationsPort,
} from '@integrations/application/ports/defined-integrations.port';
import { IntegrationDefinitionMovedOnError } from '@integrations/domain/exceptions/integration-definition-moved-on.error';
import {
  INTEGRATION_DEFINITIONS,
  type IntegrationDefinitionRepository,
} from '@integrations/domain/repositories/integration-definition.repository';
import { SourceKey } from '@integrations/domain/value-objects/source-key.vo';
import { IntegrationCompiler } from '@integrations/infrastructure/integrations/integration.compile';
import { INestApplication } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Test, TestingModule } from '@nestjs/testing';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import {
  TEAM_INTEGRATIONS,
  type TeamIntegrationsPort,
} from '@work/application/ports/team-integrations.port';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '@/app.module';
import * as schema from './support/schema';
import { seatTeam } from './support/team';

const LINEAR = {
  integration: 'linear',
  name: 'Linear',
  actions: {
    comment: {
      request: { method: 'POST', url: 'https://api.linear.app/graphql' },
    },
  },
  tools: {
    comment: { description: 'Comment on an issue', does: 'comment' },
  },
};

describe('an integration, defined and read back (e2e)', () => {
  let app: INestApplication;
  let db: DrizzleDatabase;
  let commands: CommandBus;
  let seat: Awaited<ReturnType<typeof seatTeam>>;
  const held = `integrations-${Date.now()}`;

  const define = (definition: unknown, by = seat.owner) =>
    commands.execute<DefineIntegrationCommand, DefinedIntegrationDto | null>(
      new DefineIntegrationCommand(held, by, definition),
    );

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    db = app.get(DRIZZLE);
    commands = app.get(CommandBus);
    seat = await seatTeam(db, held);
  });

  afterEach(async () => {
    await db
      .delete(schema.integrationDefinition)
      .where(eq(schema.integrationDefinition.teamId, held));
    await seat.unseat();
    await app.close();
  });

  it('is what the team is configured with from then on', async () => {
    expect(await define(LINEAR)).toMatchObject({
      ok: true,
      integration: { source: 'linear' },
    });

    const integrations = await app
      .get<DefinedIntegrationsPort>(DEFINED_INTEGRATIONS)
      .ofTeam(TeamId.of(held));

    expect(integrations).toEqual([
      expect.objectContaining({
        source: 'linear',
        definition: expect.objectContaining({ name: 'Linear' }),
      }),
    ]);
    expect(
      (
        await app
          .get<TeamIntegrationsPort>(TEAM_INTEGRATIONS)
          .offered(TeamId.of(held))
      ).map((each) => each.tool),
    ).toEqual(['linear.comment']);
  });

  it('replaces the one the team had for that host', async () => {
    await define(LINEAR);
    await define({ ...LINEAR, name: 'Linear, again' });

    const rows = await db
      .select()
      .from(schema.integrationDefinition)
      .where(eq(schema.integrationDefinition.teamId, held));

    expect(rows).toHaveLength(1);
    expect(rows[0]?.definition).toMatchObject({ name: 'Linear, again' });
  });

  it('refuses to save over a definition that changed since it was read', async () => {
    await define(LINEAR);

    const definitions = app.get<IntegrationDefinitionRepository>(
      INTEGRATION_DEFINITIONS,
    );
    const compiled = new IntegrationCompiler().compile({
      ...LINEAR,
      name: 'Linear, again',
    });

    if (!compiled.ok) {
      throw new Error('it did not compile');
    }

    const standing = await definitions.of(
      TeamId.of(held),
      SourceKey.of('linear'),
    );

    if (!standing) {
      throw new Error('it was not kept');
    }

    await definitions.save(standing.redefinedAs(compiled));

    await expect(
      definitions.save(standing.redefinedAs(compiled)),
    ).rejects.toBeInstanceOf(IntegrationDefinitionMovedOnError);
  });

  it('keeps nothing that will not compile', async () => {
    expect(await define({ integration: 'linear' })).toMatchObject({
      ok: false,
    });
    expect(
      await db
        .select()
        .from(schema.integrationDefinition)
        .where(eq(schema.integrationDefinition.teamId, held)),
    ).toEqual([]);
  });

  it('defines nothing for a member who does not administer the workspace', async () => {
    expect(await define(LINEAR, seat.member)).toBeNull();
  });
});
