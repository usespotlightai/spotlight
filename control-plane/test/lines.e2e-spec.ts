import type { INestApplication } from '@nestjs/common';
import { afterEach, beforeEach, describe, it } from 'vitest';
import { openApp, served } from './support/app';

describe('LineController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    app = await openApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/teams/:teamId/lines (GET) is rejected without a session', () => {
    return served(app).get('/api/teams/team_1/lines').expect(401);
  });

  it('/resources/teams/:teamId/lines (POST) is rejected without a session', () => {
    return served(app)
      .post('/api/resources/teams/team_1/lines')
      .send({ key: 'delivery', name: 'Delivery', stations: [] })
      .expect(401);
  });

  it('/resources/teams/:teamId/integrations (POST) is rejected without a session', () => {
    return served(app)
      .post('/api/resources/teams/team_1/integrations')
      .send({ integration: 'linear' })
      .expect(401);
  });

  it('/teams/:teamId/tasks (GET) is rejected without a session', () => {
    return served(app).get('/api/teams/team_1/tasks').expect(401);
  });

  it('/stations/:stationId/tasks (POST) is rejected without a session', () => {
    return served(app)
      .post('/api/teams/team_1/lines/line_1/stations/station_1/tasks')
      .send({ title: 'Fix the queue' })
      .expect(401);
  });

  it('/teams/:teamId/tasks/:taskId (DELETE) is rejected without a session', () => {
    return served(app).delete('/api/teams/team_1/tasks/task_1').expect(401);
  });

  it('/tasks/:taskId/move (POST) is rejected without a session', () => {
    return served(app)
      .post('/api/teams/team_1/lines/line_1/tasks/task_1/move')
      .send({ stationId: 'station_1' })
      .expect(401);
  });
});
