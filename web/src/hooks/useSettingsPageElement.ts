import { useCallback, useEffect, useState } from 'react';

import type { SettingsPageDto } from '@/lib/api';
import { loadSettingsPageElement } from '@/lib/settings-page-element';

export type SettingsPageElementState = 'loading' | 'ready' | 'failed';

// Loads the script of a settings page that the deployment adds, until its element is defined. retry loads it again from a new URL.
export function useSettingsPageElement(
  page: Pick<SettingsPageDto, 'script' | 'element'>,
) {
  const { script, element } = page;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<SettingsPageElementState>(() =>
    customElements.get(element) ? 'ready' : 'loading',
  );

  useEffect(() => {
    let current = true;

    loadSettingsPageElement({ script, element }, attempt).then(
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
