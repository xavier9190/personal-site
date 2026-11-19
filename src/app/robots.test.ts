import { describe, expect, it } from 'vitest';
import robots from './robots';

describe('robots.ts', () => {
  it('blocks all crawlers from indexing any route with Disallow: /', () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules : [config.rules];

    const catchAllRule = rules.find((rule) =>
      Array.isArray(rule.userAgent)
        ? rule.userAgent.includes('*')
        : rule.userAgent === '*',
    );

    expect(catchAllRule).toBeDefined();
    expect(catchAllRule?.disallow).toBe('/');
  });
});
