import { useEffect, useRef, useState } from 'react';

const ELLIPSIS = '…';

/**
 * Measured against the font actually in use. A canvas is asked rather than the
 * page, so nothing is written to the document to find out how wide it would be.
 */
const measured = (font: string) => {
  const canvas = document.createElement('canvas');
  const pen = canvas.getContext('2d');

  if (!pen) {
    return null;
  }

  pen.font = font;
  return (text: string) => pen.measureText(text).width;
};

const fitted = (
  text: string,
  width: (of: string) => number,
  most: number,
): string => {
  if (width(text) <= most) {
    return text;
  }

  let fits = 0;
  let over = text.length;

  while (fits < over) {
    const half = Math.ceil((fits + over) / 2);

    if (width(text.slice(0, half) + ELLIPSIS) <= most) {
      fits = half;
    } else {
      over = half - 1;
    }
  }

  return text.slice(0, fits).trimEnd() + ELLIPSIS;
};

/**
 * Text cut to a width, sized to what it shows.
 *
 * The browser's own truncation leaves the box at its full width however little
 * of the text it drew, so the padding after it reads wider than the padding
 * before. Cutting the text here means the box ends where the words do.
 */
export function Shortened({
  text,
  most,
  className,
}: {
  text: string;
  most: number;
  className?: string;
}) {
  const [shown, setShown] = useState(text);
  const held = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let reading = true;

    const cut = () => {
      const node = held.current;

      if (!node) {
        return;
      }

      // The element's own font, not the page's: a breadcrumb is not set in
      // the same size or weight as the body it sits above.
      const style = getComputedStyle(node);
      const width = measured(
        `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
      );

      // Nothing to measure with, in a test or an older browser: the whole
      // text is better than a guess at where to cut it.
      if (!reading || !width || width(text) === 0) {
        return;
      }

      setShown(fitted(text, width, most));
    };

    cut();
    // The font it is measured against may not have loaded yet, and the wrong
    // font measures the wrong width.
    void document.fonts?.ready.then(cut);

    return () => {
      reading = false;
    };
  }, [text, most]);

  return (
    <span
      ref={held}
      className={className}
      title={shown === text ? undefined : text}
    >
      {shown}
    </span>
  );
}
