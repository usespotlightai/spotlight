import { useEffect, useRef, useState } from 'react';

const ELLIPSIS = '…';

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

      const style = getComputedStyle(node);
      const width = measured(
        `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`,
      );

      if (!reading || !width || width(text) === 0) {
        return;
      }

      setShown(fitted(text, width, most));
    };

    cut();
    // The font may not have loaded yet, and the wrong font measures the wrong width.
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
