import { type FocusEvent, useState } from 'react';

export function useFocusWithin() {
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
