import { useCallback, useEffect, useState } from 'react';

import type { CustomSettingsPageDto } from '@/lib/api';
import { loadCustomSettingsPageElement } from '@/lib/custom-settings-page-element';

export type CustomSettingsPageElementState = 'loading' | 'ready' | 'failed';

// Loads the script of a custom settings page, until its element is defined. retry loads it again from a new URL.
export function useCustomSettingsPageElement(
  page: Pick<CustomSettingsPageDto, 'script' | 'element'>,
) {
  const { script, element } = page;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<CustomSettingsPageElementState>(() =>
    customElements.get(element) ? 'ready' : 'loading',
  );

  useEffect(() => {
    let current = true;

    loadCustomSettingsPageElement({ script, element }, attempt).then(
      () => current && setState('ready'),
      () => current && setState('failed'),
    );

    return () => {
      current = false;
    };
  }, [script, element, attempt]);

  const retry = useCallback(() => {
    setState('loading');
    setAttempt((each) => each + 1);
  }, []);

  return { state, retry };
}
