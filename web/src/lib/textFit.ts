const ELLIPSIS = '…';

export const measured = (font: string) => {
  const canvas = document.createElement('canvas');
  const pen = canvas.getContext('2d');

  if (!pen) {
    return null;
  }

  pen.font = font;
  return (text: string) => pen.measureText(text).width;
};

export const fitToWidth = (
  text: string,
  width: (of: string) => number,
  max: number,
): string => {
  if (width(text) <= max) {
    return text;
  }

  let fits = 0;
  let over = text.length;

  while (fits < over) {
    const half = Math.ceil((fits + over) / 2);

    if (width(text.slice(0, half) + ELLIPSIS) <= max) {
      fits = half;
    } else {
      over = half - 1;
    }
  }

  return text.slice(0, fits).trimEnd() + ELLIPSIS;
};
