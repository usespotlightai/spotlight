import type { INestApplication } from '@nestjs/common';
import {
  API_VERSION,
  PROBLEM_CONTENT_TYPE,
} from '@platform/http/resources/resource-headers';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openApp, served, TEST_USER_HEADER } from './support/app';

const WHEN = 'integration.webhook.events[0].when';

const DEFINITION = {
  integration: 'linear',
  webhook: {
    verify: { hmac: { secret: 'secret.LINEAR_SIGNING' } },
    events: [
      {
        // biome-ignore lint/suspicious/noTemplateCurlyInString: the definition's own expression syntax
        when: '${{ body.type == "Issue" }}',
        raise: {
          happening: 'linear.issue.completed',
          // biome-ignore lint/suspicious/noTemplateCurlyInString: the definition's own expression syntax
          marks: [{ kind: 'linear.issue', value: '${{ body.data.id }}' }],
        },
      },
    ],
  },
  actions: {
    comment: { request: { url: 'https://api.linear.app/graphql' } },
  },
  on: {
    'task.opened': {
      do: 'comment',
      // biome-ignore lint/suspicious/noTemplateCurlyInString: the definition's own expression syntax
      to: { thread: '${{ ask.body }}' },
    },
  },
};

describe('checking expressions for a plan', () => {
  let app: INestApplication;

  const check = (body: object) =>
    served(app)
      .post('/api/expressions/check')
      .set(TEST_USER_HEADER, 'expression-checker')
      .send({ definition: DEFINITION, ...body });

  beforeAll(async () => {
    app = await openApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers the type of a sound expression, in the API version requested', async () => {
    const answer = await check({
      position: WHEN,
      expression: 'body.type == "Issue"',
    });

    expect(answer.status).toBe(200);
    expect(answer.headers['spotlight-api-version']).toBe(API_VERSION);
    expect(answer.body).toEqual({ type: 'bool', errors: [], warnings: [] });
  });

  it('fails a when that does not return a bool', async () => {
    const answer = await check({ position: WHEN, expression: '"Issue"' });

    expect(answer.status).toBe(200);
    expect(answer.body.errors).toEqual([
      {
        message: 'must return a bool, not a string',
        span: { start: 0, end: 7 },
        suggestion: null,
      },
    ]);
  });

  it('points at a misspelt field, at a key Terraform quotes', async () => {
    const answer = await check({
      position: 'integration.on["task.opened"].to.thread',
      expression: 'task.marks["slack.thread"] + ask.bdoy',
    });

    expect(answer.body.errors).toEqual([
      {
        message: 'No such key: bdoy',
        span: { start: 33, end: 37 },
        suggestion: 'ask.body',
      },
    ]);
  });

  it('rejects a position where the definition has no expression, as a problem', async () => {
    const answer = await check({
      position: 'integration.webhook.events[0].wehn',
      expression: 'true',
    });

    expect(answer.status).toBe(422);
    expect(answer.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
    expect(answer.body).toMatchObject({
      type: 'urn:spotlight:problem:invalid',
      errors: [{ path: 'position' }],
    });
  });

  it('rejects a position that is not an integration’s', async () => {
    const answer = await check({
      position: 'line.stations[0].check',
      expression: 'true',
    });

    expect(answer.status).toBe(422);
    expect(answer.body.errors).toEqual([
      expect.objectContaining({
        path: 'position',
        message: expect.stringMatching(/names an attribute of an integration/),
      }),
    ]);
  });

  it('rejects a definition that is not valid, naming each error in it', async () => {
    const answer = await check({
      position: WHEN,
      expression: 'true',
      definition: { ...DEFINITION, types: { Issue: { id: 5 } } },
    });

    expect(answer.status).toBe(422);
    expect(answer.body.errors).toEqual([
      expect.objectContaining({ path: 'definition.types.Issue.id' }),
    ]);
  });

  it('lists every position with what it sees', async () => {
    const answer = await served(app)
      .get('/api/expressions/positions')
      .set(TEST_USER_HEADER, 'expression-checker');

    expect(answer.status).toBe(200);
    expect(answer.body).toContainEqual(
      expect.objectContaining({
        position: 'integration.webhook.events[*].when',
        returns: 'bool',
        alsoSees: ['item'],
      }),
    );
  });

  it('answers only a signed-in caller', async () => {
    const answer = await served(app)
      .post('/api/expressions/check')
      .send({ position: WHEN, expression: 'true', definition: DEFINITION });

    expect(answer.status).toBe(401);
    expect(answer.headers['content-type']).toContain(PROBLEM_CONTENT_TYPE);
  });
});
