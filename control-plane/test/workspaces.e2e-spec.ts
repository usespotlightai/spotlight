import type { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { openApp, served } from './support/app';

describe('WorkspaceController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await openApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/workspaces (GET) is rejected without a session', () => {
    return served(app).get('/api/workspaces').expect(401);
  });

  it('/workspaces (POST) is rejected without a session', () => {
    return served(app)
      .post('/api/workspaces')
      .send({ name: 'Acme', slug: 'acme' })
      .expect(401);
  });
});
