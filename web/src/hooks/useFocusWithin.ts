import { type FocusEvent, useState } from 'react';

export type FocusWithinResult = {
  focused: boolean;
  handlers: {
    onFocus: () => void;
    onBlur: (event: FocusEvent<HTMLElement>) => void;
  };
};

export function useFocusWithin(): FocusWithinResult {
  const [focused, setFocused] = useState(false);

  return {
    focused,
    handlers: {
      onFocus: () => setFocused(true),
      onBlur: (event: FocusEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setFocused(false);
        }
      },
    },
  };
}
