'use client';

import { useEffect } from 'react';

const SELECTED_MODEL_KEY = 'abhiai_selected_model';

export default function AutoModelBootstrap() {
  useEffect(() => {
    try {
      if (!localStorage.getItem(SELECTED_MODEL_KEY)) {
        localStorage.setItem(SELECTED_MODEL_KEY, 'auto');
      }
    } catch {
      // Model selector keeps its in-memory fallback when storage is unavailable.
    }
  }, []);

  return null;
}
