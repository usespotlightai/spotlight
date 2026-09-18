import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';

describe('LineController (e2e)', () => {
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

  it('/teams/:teamId/lines (GET) is rejected without a session', () => {
    return request(app.getHttpServer())
      .get('/api/teams/team_1/lines')
      .expect(401);
  });

  it('/teams/:teamId/tasks (GET) is rejected without a session', () => {
    return request(app.getHttpServer())
      .get('/api/teams/team_1/tasks')
      .expect(401);
  });

  it('/stations/:stationId/tasks (POST) is rejected without a session', () => {
    return request(app.getHttpServer())
      .post('/api/teams/team_1/lines/line_1/stations/station_1/tasks')
      .send({ title: 'Fix the queue' })
      .expect(401);
  });

  it('/teams/:teamId/tasks/:taskId (DELETE) is rejected without a session', () => {
    return request(app.getHttpServer())
      .delete('/api/teams/team_1/tasks/task_1')
      .expect(401);
  });

  it('/tasks/:taskId/move (POST) is rejected without a session', () => {
    return request(app.getHttpServer())
      .post('/api/teams/team_1/lines/line_1/tasks/task_1/move')
      .send({ stationId: 'station_1' })
      .expect(401);
  });

  it('/teams/../stations/.. (PATCH) is rejected without a session', () => {
    return request(app.getHttpServer())
      .patch('/api/teams/team_1/lines/line_1/stations/station_1')
      .send({ pool: 'dev' })
      .expect(401);
  });
});
