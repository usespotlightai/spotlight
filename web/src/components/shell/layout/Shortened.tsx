import { useEffect, useRef, useState } from 'react';
import { fitToWidth, measured } from '@/lib/textFit';

export function Shortened({
  text,
  max,
  className,
}: {
  text: string;
  max: number;
  className?: string;
}) {
  const [shown, setShown] = useState(text);
  const textRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let reading = true;

    const cut = () => {
      const node = textRef.current;

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

      setShown(fitToWidth(text, width, max));
    };

    cut();
    void document.fonts?.ready.then(cut);

    return () => {
      reading = false;
    };
  }, [text, max]);

  return (
    <span
      ref={textRef}
      className={className}
      title={shown === text ? undefined : text}
    >
      {shown}
    </span>
  );
}
