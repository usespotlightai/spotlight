import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { ENV } from '@platform/config/config.constants';
import { parseEnv } from '@platform/config/env';
import type { Env } from '@platform/config/env.schema';
import {
  type AuthenticatedUser,
  SESSION_READER,
  type SessionReaderPort,
} from '@shared-kernel/application/ports/session.port';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';
import { clonedDatabase, droppedDatabase } from './database';

export const TEST_USER_HEADER = 'x-test-user';

const sessionsFromHeader: SessionReaderPort = {
  read: async (headers): Promise<AuthenticatedUser | null> => {
    const id = headers[TEST_USER_HEADER];

    return typeof id === 'string'
      ? { id, email: `${id}@example.com`, name: id }
      : null;
  },
  readBearer: async () => null,
};

export const openApp = async (
  overriding: (
    module: TestingModuleBuilder,
    env: Env,
  ) => TestingModuleBuilder = (module) => module,
): Promise<INestApplication> => {
  const env = { ...parseEnv(), DATABASE_URL: await clonedDatabase('app') };
  const compiled = await overriding(
    Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SESSION_READER)
      .useValue(sessionsFromHeader)
      .overrideProvider(ENV)
      .useValue(env),
    env,
  ).compile();
  const app = configureApp(compiled.createNestApplication());
  const closed = app.close.bind(app);

  app.close = async () => {
    await closed();
    await droppedDatabase(env.DATABASE_URL);
  };

  await app.listen(0, '127.0.0.1');

  return app;
};

export const served = (app: INestApplication) => {
  const server = app.getHttpServer() as Server;

  if (!server.listening) {
    throw new Error('Open the app with openApp, which serves it on 127.0.0.1');
  }

  return request(server);
};
