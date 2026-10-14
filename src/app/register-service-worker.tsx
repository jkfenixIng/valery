'use client';

import { useEffect } from 'react';

export function RegisterServiceWorker() {
  useEffect(() => {
    void navigator.serviceWorker?.register('/sw.js');
  }, []);

  return null;
}
