import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { buildOpenApiDocument } from '@platform/http/openapi';
import { FORBIDDEN_ACTS } from '@platform/http/resources/problem.exception';
import {
  RESOURCE_OPERATIONS,
  type ResourceOperation,
} from '@platform/http/resources/resource-api';
import {
  API_VERSION,
  PROBLEM_CONTENT_TYPE,
  RESOURCE_EXTENSION,
} from '@platform/http/resources/resource-headers';
import type { DrizzleDatabase } from '@platform/persistence/drizzle/drizzle.client';
import { DRIZZLE } from '@platform/persistence/drizzle/drizzle.constants';
import {
  TOKEN_MINT,
  type TokenMintPort,
} from '@shared-kernel/application/ports/token-mint.port';
import { eq } from 'drizzle-orm';
import type { Response, Test } from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './app';
import * as schema from './schema';

type Body = Readonly<Record<string, unknown>>;

interface Bearer {
  readonly bearer: string;
}

type Caller = string | Bearer | null;

export interface ResourceFixture {
  readonly admin: string;
  readonly viewer: string;
  readonly viewerToken?: string;
  readonly collection: string;
  readonly item: (id: string) => string;
  readonly importing: (address: string) => string;
  readonly listing: (workspaceId: string) => string;
  readonly workspaceOf: (created: Body & { id: string }) => string;
  readonly listsAcrossWorkspaces?: boolean;
  readonly address: string;
  readonly valid: Body;
  readonly changed: Body;
  readonly changedAgain: Body;
  readonly invalid: { readonly body: Body; readonly path: string };
  readonly anyoneCreates?: boolean;
  readonly admit?: (created: Body & { id: string }) => Promise<void>;
  readonly close: () => Promise<void>;
}

export interface ResourceUnderTest {
  readonly kind: string;
  readonly open: (app: INestApplication) => Promise<ResourceFixture>;
  readonly operations?: readonly ResourceOperation[];
}

interface DocumentedOperation {
  readonly operationId?: string;
  readonly parameters?: readonly {
    readonly name: string;
    readonly in: string;
    readonly required?: boolean;
  }[];
  readonly responses: Readonly<
    Record<
      string,
      {
        readonly headers?: Readonly<Record<string, unknown>>;
        readonly content?: Readonly<
          Record<string, { readonly schema?: { readonly $ref?: string } }>
        >;
      }
    >
  >;
  readonly [RESOURCE_EXTENSION]?: { kind: string; operation: string };
}

const problem = (answer: Response, status: number, slug: string): Body => {
  expect(answer.status).toBe(status);
  expect(answer.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
  expect(answer.body).toMatchObject({
    type: `urn:spotlight:problem:${slug}`,
    status,
  });

  return answer.body as Body;
};

const documented = (
  app: INestApplication,
  kind: string,
): Map<ResourceOperation, DocumentedOperation> => {
  const found = new Map<ResourceOperation, DocumentedOperation>();

  for (const methods of Object.values(buildOpenApiDocument(app).paths)) {
    for (const each of Object.values(methods) as DocumentedOperation[]) {
      const marked = each?.[RESOURCE_EXTENSION];

      if (marked?.kind === kind) {
        found.set(marked.operation as ResourceOperation, each);
      }
    }
  }

  return found;
};

const answeredSchema = (operation: DocumentedOperation | undefined) =>
  operation?.responses['200']?.content?.['application/json']?.schema?.$ref;

const header = (operation: DocumentedOperation, name: string) =>
  operation.parameters?.find(
    (each) => each.in === 'header' && each.name === name,
  );

export function conformsAsResource(resource: ResourceUnderTest): void {
  const operations = resource.operations ?? RESOURCE_OPERATIONS;
  const updates = operations.includes('update');

  describe(`the ${resource.kind} resource, held to the resource conventions (e2e)`, () => {
    let app: INestApplication;
    let fixture: ResourceFixture;

    const as = (user: Caller) => {
      const http = served(app);
      const signed = <T extends Test>(test: T): T => {
        if (user === null) {
          return test;
        }

        return (
          typeof user === 'string'
            ? test.set(TEST_USER_HEADER, user)
            : test.set('Authorization', `Bearer ${user.bearer}`)
        ) as T;
      };

      return {
        create: (body: Body, key: string | null = randomUUID()) => {
          const test = signed(http.post(fixture.collection)).send(body);

          return key ? test.set('Idempotency-Key', key) : test;
        },
        read: (id: string) => signed(http.get(fixture.item(id))),
        update: (id: string, body: Body, version: number | null) => {
          const test = signed(http.put(fixture.item(id))).send(body);

          return version === null ? test : test.set('If-Match', `"${version}"`);
        },
        remove: (id: string, version: number | null) => {
          const test = signed(http.delete(fixture.item(id)));

          return version === null ? test : test.set('If-Match', `"${version}"`);
        },
        import: (address: string) =>
          signed(http.get(fixture.importing(address))),
        list: (workspaceId: string) =>
          signed(http.get(fixture.listing(workspaceId))),
      };
    };

    const listed = (answer: Response): Body[] => {
      expect(answer.status).toBe(200);
      expect(answer.body).toEqual({ items: expect.any(Array) });

      return answer.body.items;
    };

    const memberElsewhere = async () => {
      const db = app.get<DrizzleDatabase>(DRIZZLE);
      const person = randomUUID();
      const workspaceId = randomUUID();

      await db
        .insert(schema.user)
        .values({ id: person, name: 'Cy', email: `${person}@example.com` });
      await db.insert(schema.workspace).values({
        id: workspaceId,
        name: 'Elsewhere',
        slug: `elsewhere-${workspaceId.slice(0, 8)}`,
      });
      await db
        .insert(schema.workspaceMember)
        .values({ workspaceId, userId: person, role: 'owner' });

      return {
        person,
        workspaceId,
        leave: async () => {
          await db
            .delete(schema.workspace)
            .where(eq(schema.workspace.id, workspaceId));
          await db.delete(schema.user).where(eq(schema.user.id, person));
        },
      };
    };

    const readOnlyToken = async (workspaceId: string) => {
      const db = app.get<DrizzleDatabase>(DRIZZLE);
      const bearer = randomUUID();
      const id = randomUUID();

      await db.insert(schema.workspaceToken).values({
        id,
        workspaceId,
        name: `reader-${id.slice(0, 8)}`,
        scopes: ['read'],
        tokenHash: app.get<TokenMintPort>(TOKEN_MINT).hash(bearer),
        issuedBy: fixture.admin,
        issuedAt: new Date(),
      });

      return {
        list: () =>
          served(app)
            .get(fixture.listing(workspaceId))
            .set('Authorization', `Bearer ${bearer}`),
        revoke: () =>
          db
            .delete(schema.workspaceToken)
            .where(eq(schema.workspaceToken.id, id)),
      };
    };

    const admin = () => as(fixture.admin);

    const created = async (): Promise<
      Body & { id: string; version: number }
    > => {
      const answer = await admin().create(fixture.valid);

      expect(answer.status).toBe(201);

      return answer.body;
    };

    beforeAll(async () => {
      app = await openApp();
    });

    afterAll(async () => {
      await app.close();
    });

    beforeEach(async () => {
      fixture = await resource.open(app);
    });

    afterEach(async () => {
      await fixture.close();
    });

    it('documents each convention in the OpenAPI spec, on every operation', () => {
      const served = documented(app, resource.kind);

      expect([...served.keys()].sort()).toEqual([...operations].sort());

      for (const [name, operation] of served) {
        expect(header(operation, 'Spotlight-Api-Version'), name).toBeDefined();

        const statuses =
          name === 'list' && fixture.listsAcrossWorkspaces
            ? ['400', '401']
            : ['400', '401', '404'];

        for (const status of statuses) {
          expect(
            operation.responses[status]?.content,
            `${name} ${status}`,
          ).toHaveProperty([PROBLEM_CONTENT_TYPE]);
        }

        if (name === 'list' && fixture.listsAcrossWorkspaces) {
          expect(operation.responses['404'], name).toBeUndefined();
        }

        if (name !== 'delete' && name !== 'list') {
          const answered =
            operation.responses[name === 'create' ? '201' : '200'];

          expect(answered?.headers, name).toHaveProperty(['ETag']);
        }
      }

      const everyId = Object.values(buildOpenApiDocument(app).paths).flatMap(
        (methods) =>
          (Object.values(methods) as DocumentedOperation[]).map(
            (each) => each?.operationId,
          ),
      );

      for (const [name, operation] of served) {
        expect(
          everyId.filter((each) => each === operation.operationId),
          `${name} is the only ${operation.operationId}`,
        ).toHaveLength(1);
      }

      const create = served.get('create') as DocumentedOperation;
      const update = served.get('update');
      const remove = served.get('delete') as DocumentedOperation;
      const importing = served.get('import') as DocumentedOperation;

      const read = answeredSchema(served.get('read'));
      const list = answeredSchema(served.get('list'));
      const schemas = buildOpenApiDocument(app).components?.schemas ?? {};

      expect(read).toBeDefined();
      expect(
        schemas[list?.split('/').pop() ?? ''] as Record<string, unknown>,
      ).toMatchObject({
        required: ['items'],
        properties: { items: { type: 'array', items: { $ref: read } } },
      });

      expect(header(create, 'Idempotency-Key')?.required).toBe(true);
      expect(header(remove, 'If-Match')?.required).toBe(true);
      expect(
        importing.parameters?.find((each) => each.name === 'address'),
      ).toMatchObject({ in: 'query', required: true });

      if (update) {
        expect(header(update, 'If-Match')?.required).toBe(true);
      }

      for (const [operation, statuses] of [
        [create, ['403', '409', '422']],
        ...(update ? [[update, ['403', '409', '422', '428']] as const] : []),
        [remove, ['403', '409', '428']],
      ] as const) {
        expect(operation).toBeDefined();

        for (const status of statuses) {
          expect(operation.responses[status]?.content).toHaveProperty([
            PROBLEM_CONTENT_TYPE,
          ]);
        }
      }
    });

    it('issues an id and a version on create, and carries the version as its ETag', async () => {
      const answer = await admin().create(fixture.valid);

      expect(answer.status).toBe(201);
      expect(answer.body).toMatchObject({
        id: expect.any(String),
        version: expect.any(Number),
        address: fixture.address,
      });
      expect(answer.headers.etag).toBe(`"${answer.body.version}"`);
      expect(answer.headers['spotlight-api-version']).toBe(API_VERSION);
    });

    it('reads back every field the create answered', async () => {
      const made = await created();
      const read = await admin().read(made.id);

      expect(read.status).toBe(200);
      expect(read.body).toEqual(made);
      expect(read.headers.etag).toBe(`"${made.version}"`);
    });

    it.skipIf(!updates)(
      'keeps its id through a change, while its version rises',
      async () => {
        const made = await created();
        const changed = await admin().update(
          made.id,
          fixture.changed,
          made.version,
        );

        expect(changed.status).toBe(200);
        expect(changed.body.id).toBe(made.id);
        expect(changed.body.version).toBeGreaterThan(made.version);
        expect(changed.headers.etag).toBe(`"${changed.body.version}"`);
        expect((await admin().read(made.id)).body).toEqual(changed.body);
      },
    );

    it('answers an import by address as a read would', async () => {
      const made = await created();
      const imported = await admin().import(fixture.address);

      expect(imported.status).toBe(200);
      expect(imported.body).toEqual(made);
      expect(imported.headers.etag).toBe(`"${made.version}"`);
    });

    it('lists it in its workspace, as a read would answer it', async () => {
      const made = await created();

      expect(
        listed(await admin().list(fixture.workspaceOf(made))),
      ).toContainEqual(made);
    });

    it('lists it to a token that may only read', async () => {
      const made = await created();
      const token = await readOnlyToken(fixture.workspaceOf(made));

      try {
        const items = listed(await token.list());

        expect(items).toContainEqual(made);

        if (fixture.listsAcrossWorkspaces) {
          expect(items.map((each) => each.id)).toEqual([made.id]);
        }
      } finally {
        await token.revoke();
      }
    });

    it('lists nothing of a workspace to a member of another', async () => {
      const made = await created();
      const elsewhere = await memberElsewhere();

      try {
        const stranger = await as(elsewhere.person).list(
          fixture.workspaceOf(made),
        );

        if (fixture.listsAcrossWorkspaces) {
          expect(listed(stranger).map((each) => each.id)).toEqual([
            elsewhere.workspaceId,
          ]);
        } else {
          problem(stranger, 404, 'not-found');
          problem(await admin().list(randomUUID()), 404, 'not-found');
        }
      } finally {
        await elsewhere.leave();
      }
    });

    it('refuses a create without an Idempotency-Key, creating nothing', async () => {
      problem(
        await admin().create(fixture.valid, null),
        400,
        'idempotency-key-required',
      );
      problem(await admin().import(fixture.address), 404, 'not-found');
    });

    it('answers a retried create as the first attempt did, creating nothing more', async () => {
      const key = randomUUID();
      const first = await admin().create(fixture.valid, key);
      const retried = await admin().create(fixture.valid, key);

      expect(first.status).toBe(201);
      expect(retried.status).toBe(201);
      expect(retried.body).toEqual(first.body);
      expect(retried.headers['idempotent-replayed']).toBe('true');
    });

    it('answers concurrent attempts of one create with one resource', async () => {
      const key = randomUUID();
      const attempts = await Promise.all(
        Array.from({ length: 8 }, () => admin().create(fixture.valid, key)),
      );
      const [first] = attempts;

      for (const each of attempts) {
        expect(each.status).toBe(201);
        expect(each.body).toEqual(first?.body);
      }
    });

    it('refuses an Idempotency-Key used for a different request', async () => {
      const key = randomUUID();

      await admin().create(fixture.valid, key);

      problem(
        await admin().create(fixture.changed, key),
        422,
        'idempotency-key-reused',
      );
    });

    it('refuses a second create at an address already taken', async () => {
      await created();

      problem(await admin().create(fixture.valid), 409, 'already-exists');
    });

    it('refuses a change or delete that does not say which version it is of', async () => {
      const made = await created();

      if (updates) {
        problem(
          await admin().update(made.id, fixture.changed, null),
          428,
          'precondition-required',
        );
      }
      problem(
        await admin().remove(made.id, null),
        428,
        'precondition-required',
      );
    });

    it.skipIf(!updates)(
      'refuses a change to a version no longer current, naming the current one',
      async () => {
        const made = await created();
        const changed = await admin().update(
          made.id,
          fixture.changed,
          made.version,
        );
        const stale = problem(
          await admin().update(made.id, fixture.changedAgain, made.version),
          409,
          'version-conflict',
        );

        expect(stale.currentVersion).toBe(changed.body.version);
      },
    );

    it.skipIf(updates)(
      'lets one of two concurrent deletes through, and finds nothing for the other',
      async () => {
        const made = await created();
        const deletes = await Promise.all([
          admin().remove(made.id, made.version),
          admin().remove(made.id, made.version),
        ]);
        const [won, lost] = [...deletes].sort((a, b) => a.status - b.status);

        expect(won?.status).toBe(204);
        problem(lost as Response, 404, 'not-found');
      },
    );

    it.skipIf(!updates)(
      'lets one of two concurrent writes through, and refuses the other with the current version',
      async () => {
        const made = await created();
        const writes = await Promise.all([
          admin().update(made.id, fixture.changed, made.version),
          admin().update(made.id, fixture.changedAgain, made.version),
        ]);
        const [won, lost] = [...writes].sort((a, b) => a.status - b.status);

        expect(won?.status).toBe(200);
        expect(lost?.headers.etag).toBe(`"${won?.body.version}"`);
        expect(
          problem(lost as Response, 409, 'version-conflict').currentVersion,
        ).toBe(won?.body.version);
        expect((await admin().read(made.id)).body).toEqual(won?.body);
      },
    );

    it('refuses an invalid create or change, pointing at the field', async () => {
      const refused = problem(
        await admin().create(fixture.invalid.body),
        422,
        'invalid',
      );

      expect(refused.errors).toContainEqual(
        expect.objectContaining({ path: fixture.invalid.path }),
      );

      if (!updates) {
        return;
      }

      const made = await created();
      const unchanged = problem(
        await admin().update(made.id, fixture.invalid.body, made.version),
        422,
        'invalid',
      );

      expect(unchanged.errors).toContainEqual(
        expect.objectContaining({ path: fixture.invalid.path }),
      );
      expect((await admin().read(made.id)).body).toEqual(made);
    });

    it('deletes only the version it was asked to, and is gone after', async () => {
      const made = await created();
      const current = updates
        ? (await admin().update(made.id, fixture.changed, made.version)).body
            .version
        : made.version;
      const stale = updates ? made.version : made.version + 1;

      expect(
        problem(await admin().remove(made.id, stale), 409, 'version-conflict')
          .currentVersion,
      ).toBe(current);

      const removed = await admin().remove(made.id, current);

      expect(removed.status).toBe(204);
      problem(await admin().read(made.id), 404, 'not-found');
      problem(await admin().import(fixture.address), 404, 'not-found');
      expect(
        listed(await admin().list(fixture.workspaceOf(made))).map(
          (each) => each.id,
        ),
      ).not.toContain(made.id);
    });

    it('lets someone who may not configure it read it, and nothing more', async () => {
      const made = await created();
      const viewer = as(
        fixture.viewerToken ? { bearer: fixture.viewerToken } : fixture.viewer,
      );

      await fixture.admit?.(made);

      expect((await viewer.read(made.id)).body).toEqual(made);
      expect(
        listed(await viewer.list(fixture.workspaceOf(made))),
      ).toContainEqual(made);

      const refusals = [
        ...(fixture.anyoneCreates
          ? []
          : [problem(await viewer.create(fixture.changed), 403, 'forbidden')]),
        ...(updates
          ? [
              problem(
                await viewer.update(made.id, fixture.changed, made.version),
                403,
                'forbidden',
              ),
            ]
          : []),
        problem(await viewer.remove(made.id, made.version), 403, 'forbidden'),
      ];

      for (const refusal of refusals) {
        expect(FORBIDDEN_ACTS).toContain(refusal.permission);
      }
    });

    it('answers someone with no credentials with a problem', async () => {
      problem(await as(null).read(randomUUID()), 401, 'unauthenticated');
    });

    it('refuses an API version it does not serve, and names its own on every answer', async () => {
      const made = await created();
      const answer = await admin()
        .read(made.id)
        .set('Spotlight-Api-Version', '1999-01-01');

      problem(answer, 400, 'unsupported-api-version');
      expect(answer.headers['spotlight-api-version']).toBe(API_VERSION);

      const current = await admin()
        .read(made.id)
        .set('Spotlight-Api-Version', API_VERSION);

      expect(current.status).toBe(200);
    });
  });
}
