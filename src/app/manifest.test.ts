import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import manifest from './manifest';

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock('next/font/local', () => ({
  default: () => ({ variable: '--font-excalifont' }),
}));
vi.mock('./globals.css', () => ({}));
vi.mock('@/components/layout/AppSidebar', () => ({ AppSidebar: () => null }));
vi.mock('@/components/layout/MobileBottomNav', () => ({ MobileBottomNav: () => null }));
vi.mock('@/components/layout/PwaRegistrar', () => ({ PwaRegistrar: () => null }));
vi.mock('lucide-react', () => ({
  RefreshCw: () => React.createElement('svg', { 'data-icon': 'refresh' }),
  WifiOff: () => React.createElement('svg', { 'data-icon': 'wifi-off' }),
}));

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPngDimensions(filePath: string): { width: number; height: number } {
  const buf = readFileSync(filePath);
  expect(buf.subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
  // IHDR chunk starts at byte 8: 4-byte length, 4-byte 'IHDR', 4-byte width, 4-byte height
  expect(buf.subarray(12, 16).toString('ascii')).toBe('IHDR');
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
  };
}

describe('PWA Web App Manifest contract (Seam 3)', () => {
  it('returns standalone display, id, display_override, and dark monochrome Sketch colors', () => {
    const result = manifest();

    expect(result.id).toBe('/');
    expect(result.start_url).toBe('/');
    expect(result.display).toBe('standalone');
    expect(result.display_override).toContain('standalone');
    expect(result.background_color).toBe('#121212');
    expect(result.theme_color).toBe('#121212');
  });

  it('declares complete SVG, 192, 512, and maskable icons that physically exist as valid assets', () => {
    const result = manifest();
    const icons = result.icons ?? [];

    expect(icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: '/icons/icon.svg',
          type: 'image/svg+xml',
        }),
        expect.objectContaining({
          src: '/icons/icon-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'any',
        }),
        expect.objectContaining({
          src: '/icons/icon-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'any',
        }),
        expect.objectContaining({
          src: '/icons/icon-maskable-192.png',
          sizes: '192x192',
          type: 'image/png',
          purpose: 'maskable',
        }),
        expect.objectContaining({
          src: '/icons/icon-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        }),
      ]),
    );

    // Verify all icon files exist and PNGs have valid headers and exact dimensions
    for (const icon of icons) {
      const diskPath = path.join(PUBLIC_DIR, icon.src.replace(/^\//, ''));
      expect(existsSync(diskPath), `Missing icon file: ${icon.src}`).toBe(true);

      if (icon.type === 'image/png' && typeof icon.sizes === 'string') {
        const [expectedW, expectedH] = icon.sizes.split('x').map(Number);
        const dims = readPngDimensions(diskPath);
        expect(dims).toEqual({ width: expectedW, height: expectedH });
      }
    }

    // Verify Apple Touch Icon exists as valid 180x180 PNG
    const appleIconPath = path.join(PUBLIC_DIR, 'icons', 'apple-touch-icon.png');
    expect(existsSync(appleIconPath), 'Missing /icons/apple-touch-icon.png').toBe(true);
    expect(readPngDimensions(appleIconPath)).toEqual({ width: 180, height: 180 });
  });

  it('exposes the 5 quick shortcuts pointing to the hub modules', () => {
    const result = manifest();
    const shortcuts = result.shortcuts ?? [];

    expect(shortcuts).toHaveLength(5);

    const urls = shortcuts.map((s) => s.url);
    expect(urls).toEqual(['/', '/calendario', '/financas', '/academico', '/compras']);

    for (const shortcut of shortcuts) {
      expect(shortcut.name.trim().length).toBeGreaterThan(0);
      expect(shortcut.short_name?.trim().length).toBeGreaterThan(0);
      expect(shortcut.icons?.length).toBeGreaterThan(0);
    }
  });

  it('configures Apple Web App metadata and icons in root layout', async () => {
    const { metadata } = await import('./layout');

    expect(metadata.manifest).toBe('/manifest.webmanifest');
    expect(metadata.appleWebApp).toEqual(
      expect.objectContaining({
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'HUB PESSOAL',
      }),
    );
    expect(metadata.icons).toEqual(
      expect.objectContaining({
        apple: '/icons/apple-touch-icon.png',
      }),
    );
  });

  it('renders the /offline fallback page in monochrome Sketch style with a plain reconnect link', async () => {
    const offlinePagePath = path.resolve(process.cwd(), 'src', 'app', 'offline', 'page.tsx');
    expect(existsSync(offlinePagePath), 'src/app/offline/page.tsx must exist').toBe(true);

    const source = readFileSync(offlinePagePath, 'utf8');
    expect(source).not.toMatch(/['"]use client['"]/);

    const { default: OfflinePage } = await import('./offline/page');
    const html = renderToStaticMarkup(React.createElement(OfflinePage));

    expect(html).toContain('OFFLINE');
    expect(html).toContain('RECONECTAR');
    expect(html).toMatch(/<a[^>]*href="\/"[^>]*>[\s\S]*RECONECTAR[\s\S]*<\/a>/);
    expect(html).toContain('#121212');
    expect(html).toContain('#f1f3f5');
    expect(html).toContain('#868e96');
    expect(html).toContain('Excalifont');
  });
});
