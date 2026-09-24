import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { buildOpenApiDocument } from '@platform/http/openapi';
import {
  RESOURCE_OPERATIONS,
  type ResourceOperation,
} from '@platform/http/resources/resource-api';
import {
  API_VERSION,
  PROBLEM_CONTENT_TYPE,
  RESOURCE_EXTENSION,
} from '@platform/http/resources/resource-headers';
import request, { type Response } from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { openApp, TEST_USER_HEADER } from './app';

type Body = Readonly<Record<string, unknown>>;

export interface ResourceFixture {
  readonly admin: string;
  readonly viewer: string;
  readonly collection: string;
  readonly item: (id: string) => string;
  readonly importing: (address: string) => string;
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
        readonly content?: Readonly<Record<string, unknown>>;
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

const header = (operation: DocumentedOperation, name: string) =>
  operation.parameters?.find(
    (each) => each.in === 'header' && each.name === name,
  );

export function conformsAsResource(resource: ResourceUnderTest): void {
  describe(`the ${resource.kind} resource, held to the resource conventions (e2e)`, () => {
    let app: INestApplication;
    let fixture: ResourceFixture;

    const as = (user: string | null) => {
      const http = request(app.getHttpServer());
      const signed = <T extends request.Test>(test: T): T =>
        (user ? test.set(TEST_USER_HEADER, user) : test) as T;

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
      const operations = documented(app, resource.kind);

      expect([...operations.keys()].sort()).toEqual(
        [...RESOURCE_OPERATIONS].sort(),
      );

      for (const [name, operation] of operations) {
        expect(header(operation, 'Spotlight-Api-Version'), name).toBeDefined();

        for (const status of ['400', '401', '404']) {
          expect(
            operation.responses[status]?.content,
            `${name} ${status}`,
          ).toHaveProperty([PROBLEM_CONTENT_TYPE]);
        }

        if (name !== 'delete') {
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

      for (const [name, operation] of operations) {
        expect(
          everyId.filter((each) => each === operation.operationId),
          `${name} is the only ${operation.operationId}`,
        ).toHaveLength(1);
      }

      const create = operations.get('create') as DocumentedOperation;
      const update = operations.get('update') as DocumentedOperation;
      const remove = operations.get('delete') as DocumentedOperation;
      const importing = operations.get('import') as DocumentedOperation;

      expect(header(create, 'Idempotency-Key')?.required).toBe(true);
      expect(header(update, 'If-Match')?.required).toBe(true);
      expect(header(remove, 'If-Match')?.required).toBe(true);
      expect(
        importing.parameters?.find((each) => each.name === 'address'),
      ).toMatchObject({ in: 'query', required: true });

      for (const [operation, statuses] of [
        [create, ['403', '409', '422']],
        [update, ['403', '409', '422', '428']],
        [remove, ['403', '409', '428']],
      ] as const) {
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

    it('keeps its id through a change, while its version rises', async () => {
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
    });

    it('answers an import by address as a read would', async () => {
      const made = await created();
      const imported = await admin().import(fixture.address);

      expect(imported.status).toBe(200);
      expect(imported.body).toEqual(made);
      expect(imported.headers.etag).toBe(`"${made.version}"`);
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

      problem(
        await admin().update(made.id, fixture.changed, null),
        428,
        'precondition-required',
      );
      problem(
        await admin().remove(made.id, null),
        428,
        'precondition-required',
      );
    });

    it('refuses a change to a version no longer current, naming the current one', async () => {
      const made = await created();
      const changed = await admin().update(
        made.id,
        fixture.changed,
        made.version,
      );
      const stale = problem(
        await admin().update(made.id, fixture.changedAgain, made.version),
        409,
        'moved-on',
      );

      expect(stale.currentVersion).toBe(changed.body.version);
    });

    it('lets one of two concurrent writes through, and refuses the other with the current version', async () => {
      const made = await created();
      const writes = await Promise.all([
        admin().update(made.id, fixture.changed, made.version),
        admin().update(made.id, fixture.changedAgain, made.version),
      ]);
      const [won, lost] = [...writes].sort((a, b) => a.status - b.status);

      expect(won?.status).toBe(200);
      expect(lost?.headers.etag).toBe(`"${won?.body.version}"`);
      expect(problem(lost as Response, 409, 'moved-on').currentVersion).toBe(
        won?.body.version,
      );
      expect((await admin().read(made.id)).body).toEqual(won?.body);
    });

    it('refuses an invalid create or change, pointing at the field', async () => {
      const refused = problem(
        await admin().create(fixture.invalid.body),
        422,
        'invalid',
      );

      expect(refused.errors).toContainEqual(
        expect.objectContaining({ path: fixture.invalid.path }),
      );

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
      const changed = await admin().update(
        made.id,
        fixture.changed,
        made.version,
      );

      problem(await admin().remove(made.id, made.version), 409, 'moved-on');

      const removed = await admin().remove(made.id, changed.body.version);

      expect(removed.status).toBe(204);
      problem(await admin().read(made.id), 404, 'not-found');
      problem(await admin().import(fixture.address), 404, 'not-found');
    });

    it('lets someone who may not configure it read it, and nothing more', async () => {
      const made = await created();
      const viewer = as(fixture.viewer);

      await fixture.admit?.(made);

      expect((await viewer.read(made.id)).body).toEqual(made);

      if (!fixture.anyoneCreates) {
        problem(await viewer.create(fixture.changed), 403, 'forbidden');
      }

      problem(
        await viewer.update(made.id, fixture.changed, made.version),
        403,
        'forbidden',
      );
      problem(await viewer.remove(made.id, made.version), 403, 'forbidden');
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
