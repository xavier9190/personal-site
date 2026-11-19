import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'PERSONAL SITE — HUB PESSOAL',
    short_name: 'HUB PESSOAL',
    description:
      'HUB PESSOAL SINGLE-USER ESTILO SKETCH PARA CHAT IA, CALENDÁRIO, FINANÇAS, ACADÊMICO E COMPRAS',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone'],
    background_color: '#121212',
    theme_color: '#121212',
    orientation: 'portrait-primary',
    lang: 'pt-BR',
    icons: [
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    shortcuts: [
      {
        name: 'CHAT IA',
        short_name: 'CHAT',
        description: 'ABRIR ASSISTENTE DE CHAT IA',
        url: '/',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'CALENDÁRIO',
        short_name: 'AGENDA',
        description: 'ABRIR AGENDA E EVENTOS SEMANAIS',
        url: '/calendario',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'FINANÇAS',
        short_name: 'FINANÇAS',
        description: 'ABRIR CONTROLE FINANCEIRO E CONTAS',
        url: '/financas',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'ACADÊMICO',
        short_name: 'ACADÊMICO',
        description: 'ABRIR PROJETOS E MARCOS ACADÊMICOS',
        url: '/academico',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'COMPRAS',
        short_name: 'COMPRAS',
        description: 'ABRIR WISHLIST E ENTREGAS EM TRÂNSITO',
        url: '/compras',
        icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
