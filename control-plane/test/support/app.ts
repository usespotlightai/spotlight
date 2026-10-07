import type { Server } from 'node:http';
import type { INestApplication, OnApplicationShutdown } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { ENV } from '@platform/config/config.constants';
import { parseEnv } from '@platform/config/env';
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
};

class DroppedOnShutdown implements OnApplicationShutdown {
  constructor(private readonly url: string) {}

  onApplicationShutdown(): Promise<void> {
    return droppedDatabase(this.url);
  }
}

export const openApp = async (
  overriding: (module: TestingModuleBuilder) => TestingModuleBuilder = (
    module,
  ) => module,
): Promise<INestApplication> => {
  const env = { ...parseEnv(), DATABASE_URL: await clonedDatabase('app') };
  const compiled = await overriding(
    Test.createTestingModule({
      imports: [AppModule],
      providers: [
        {
          provide: DroppedOnShutdown,
          useValue: new DroppedOnShutdown(env.DATABASE_URL),
        },
      ],
    })
      .overrideProvider(SESSION_READER)
      .useValue(sessionsFromHeader)
      .overrideProvider(ENV)
      .useValue(env),
  ).compile();
  const app = configureApp(compiled.createNestApplication());

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
