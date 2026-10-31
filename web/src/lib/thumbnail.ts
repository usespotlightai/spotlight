const THUMBNAIL_SIDE = 112;

export const thumbnailOf = async (image: Blob): Promise<string | null> => {
  try {
    const bitmap = await createImageBitmap(image);
    const scale = Math.min(
      1,
      THUMBNAIL_SIDE / Math.max(bitmap.width, bitmap.height),
    );
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d');

    if (!context) {
      return null;
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.7);
  } catch {
    return null;
  }
};

export const fileOfThumbnail = (dataUrl: string, name: string): File => {
  const [head = '', data = ''] = dataUrl.split(',');
  const type = /^data:([^;,]+)/.exec(head)?.[1] ?? 'image/jpeg';

  return new File([Uint8Array.from(atob(data), (c) => c.charCodeAt(0))], name, {
    type,
  });
};
