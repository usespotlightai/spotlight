import type { Server } from 'node:net';

export const portOf = (server: Pick<Server, 'address'>): number => {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('expected a TCP address');
  }
  return address.port;
};
