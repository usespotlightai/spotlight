import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  type AuthenticatedUser,
  SESSION_READER,
  type SessionReaderPort,
} from '@shared-kernel/application/ports/session.port';
import request from 'supertest';
import { AppModule } from '@/app.module';
import { configureApp } from '@/app.setup';

export const TEST_USER_HEADER = 'x-test-user';

const sessionsFromHeader: SessionReaderPort = {
  read: async (headers): Promise<AuthenticatedUser | null> => {
    const id = headers[TEST_USER_HEADER];

    return typeof id === 'string'
      ? { id, email: `${id}@example.com`, name: id }
      : null;
  },
};

export const openApp = async (): Promise<INestApplication> => {
  const compiled = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(SESSION_READER)
    .useValue(sessionsFromHeader)
    .compile();
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
