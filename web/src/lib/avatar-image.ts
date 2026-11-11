import type { SetAvatarRequestDto } from '@/lib/api';

const SIDE = 256;

const ENCODED: readonly SetAvatarRequestDto['contentType'][] = [
  'image/webp',
  'image/png',
];

const encodedType = (type: string): SetAvatarRequestDto['contentType'] => {
  const found = ENCODED.find((each) => each === type);

  if (!found) {
    throw new Error('Sorry, the image couldn’t be prepared.');
  }

  return found;
};

const base64Of = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
};

export async function avatarUploadOf(file: File): Promise<SetAvatarRequestDto> {
  const image = await createImageBitmap(file).catch(() => {
    throw new Error('That file is not an image this browser can read.');
  });
  const side = Math.min(image.width, image.height);
  const canvas = document.createElement('canvas');
  canvas.width = SIDE;
  canvas.height = SIDE;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Sorry, the image couldn’t be prepared.');
  }

  context.imageSmoothingQuality = 'high';
  context.drawImage(
    image,
    (image.width - side) / 2,
    (image.height - side) / 2,
    side,
    side,
    0,
    0,
    SIDE,
    SIDE,
  );
  image.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.9),
  );

  if (!blob) {
    throw new Error('Sorry, the image couldn’t be prepared.');
  }

  return { contentType: encodedType(blob.type), data: await base64Of(blob) };
}
