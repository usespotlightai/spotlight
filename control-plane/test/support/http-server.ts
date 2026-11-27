import { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { INestApplication } from '@nestjs/common';

const isServer = (value: unknown): value is Server => value instanceof Server;

export const httpServerOf = (app: INestApplication): Server => {
  const server: unknown = app.getHttpServer();

  if (!isServer(server)) {
    throw new Error('expected the app to serve over node:http');
  }

  return server;
};

export const addressOf = (server: Server): AddressInfo => {
  const address = server.address();

  if (address === null || typeof address === 'string') {
    throw new Error('expected the server to listen on a port');
  }

  return address;
};
