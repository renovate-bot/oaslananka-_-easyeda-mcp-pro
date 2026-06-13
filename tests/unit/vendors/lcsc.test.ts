import { describe, it, expect } from 'vitest';
import { EnvSchema } from '../../../src/config/env.js';
import { LcscClient } from '../../../src/vendors/lcsc/client.js';

function createTestConfig() {
  return EnvSchema.parse({
    NODE_ENV: 'test',
    JLCSEARCH_ENABLED: true,
  });
}

describe('LcscClient', () => {
  it('should construct with default config', () => {
    const config = createTestConfig();
    const client = new LcscClient(config);
    expect(client).toBeInstanceOf(LcscClient);
  });

  it('should have expected methods', () => {
    const config = createTestConfig();
    const client = new LcscClient(config);
    expect(typeof client.searchParts).toBe('function');
    expect(typeof client.getPartDetail).toBe('function');
    expect(typeof client.getPartsByCategory).toBe('function');
  });

  it('should handle empty search gracefully', async () => {
    const config = createTestConfig();
    const client = new LcscClient(config);
    const result = await client.searchParts('');
    expect(result.parts).toEqual([]);
    expect(result.total).toBe(0);
  });
});
