export const cappedText = async (
  reply: Response,
  most: number,
  tooLarge: () => Error,
): Promise<string> => {
  const declared = Number(reply.headers.get('content-length'));

  if (Number.isFinite(declared) && declared > most) {
    await reply.body?.cancel();
    throw tooLarge();
  }

  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = reply.body?.getReader();

  while (reader) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    size += value.byteLength;

    if (size > most) {
      await reader.cancel();
      throw tooLarge();
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks).toString('utf8');
};

export const cappedReply = (
  reply: Response,
  most: number,
  tooLarge: () => Error,
): Response => {
  if (!reply.body) {
    return reply;
  }

  const declared = Number(reply.headers.get('content-length'));

  if (Number.isFinite(declared) && declared > most) {
    void reply.body.cancel();
    throw tooLarge();
  }

  let size = 0;
  const body = reply.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        size += chunk.byteLength;

        if (size > most) {
          controller.error(tooLarge());
          return;
        }

        controller.enqueue(chunk);
      },
    }),
  );

  return new Response(body, {
    status: reply.status,
    statusText: reply.statusText,
    headers: reply.headers,
  });
};
