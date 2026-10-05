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
