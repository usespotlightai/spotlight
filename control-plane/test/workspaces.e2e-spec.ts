import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';

describe('WorkspaceController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = configureApp(moduleFixture.createNestApplication());
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/workspaces (GET) is rejected without a session', () => {
    return request(app.getHttpServer()).get('/api/workspaces').expect(401);
  });

  it('/workspaces (POST) is rejected without a session', () => {
    return request(app.getHttpServer())
      .post('/api/workspaces')
      .send({ name: 'Acme', slug: 'acme' })
      .expect(401);
  });
});
