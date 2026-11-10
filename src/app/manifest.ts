import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'PERSONAL SITE — HUB PESSOAL',
    short_name: 'HUB PESSOAL',
    description:
      'HUB PESSOAL SINGLE-USER ESTILO SKETCH PARA CHAT IA, CALENDÁRIO, FINANÇAS, ACADÊMICO E COMPRAS',
    start_url: '/',
    display: 'standalone',
    background_color: '#121212',
    theme_color: '#121212',
    orientation: 'portrait-primary',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}
