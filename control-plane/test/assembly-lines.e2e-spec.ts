import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';

describe('AssemblyLineController (e2e)', () => {
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

  it('/teams/:teamId/assembly-lines (GET) is rejected without a session', () => {
    return request(app.getHttpServer())
      .get('/api/teams/team_1/assembly-lines')
      .expect(401);
  });
});
