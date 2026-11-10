'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="top-center"
      richColors
      closeButton
      visibleToasts={4}
      toastOptions={{
        duration: 3200,
        className: 'font-sans',
      }}
    />
  );
}

export default Toaster;
