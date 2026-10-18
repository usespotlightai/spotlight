import { getResponse } from 'msw';
import { handlers } from '@/mocks/handlers';

const abortedBy = (signal: AbortSignal) =>
  new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), {
      once: true,
    });
  });

export const send: typeof fetch = async (input, init) => {
  const request = new Request(input, init);
  request.signal.throwIfAborted();

  const response = await Promise.race([
    getResponse(handlers, request),
    abortedBy(request.signal),
  ]);

  if (!response) {
    throw new TypeError(
      `The mock API has no answer for ${request.method} ${request.url}.`,
    );
  }
  return response;
};
