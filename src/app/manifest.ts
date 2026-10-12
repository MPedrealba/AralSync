import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AralSync — Learning Recovery Analytics',
    short_name: 'AralSync',
    description: 'DepEd ARAL Learning Recovery Analytics, OMR Diagnostic Scoring & Phil-IRI Reading Assessment',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#991b1b',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/aral-logo.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/aral-logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  };
}
