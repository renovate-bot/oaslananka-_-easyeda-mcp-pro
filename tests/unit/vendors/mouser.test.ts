import { describe, it, expect } from 'vitest';
import { EnvSchema } from '../../../src/config/env.js';
import { MouserClient } from '../../../src/vendors/mouser/client.js';

describe('MouserClient', () => {
  it('should throw when MOUSER_ENABLED is false', () => {
    const config = EnvSchema.parse({
      NODE_ENV: 'test',
      MOUSER_ENABLED: false,
    });
    expect(() => new MouserClient(config)).toThrow('Mouser API is not enabled');
  });

  it('should throw when API key is missing', () => {
    const config = EnvSchema.parse({
      NODE_ENV: 'test',
      MOUSER_ENABLED: true,
      MOUSER_API_KEY: '',
    });
    expect(() => new MouserClient(config)).toThrow('Mouser API key is missing');
  });

  it('should construct when enabled with key', () => {
    const config = EnvSchema.parse({
      NODE_ENV: 'test',
      MOUSER_ENABLED: true,
      MOUSER_API_KEY: 'test-api-key',
    });
    const client = new MouserClient(config);
    expect(client).toBeInstanceOf(MouserClient);
    expect(typeof client.searchByKeyword).toBe('function');
    expect(typeof client.searchByPartNumber).toBe('function');
    expect(typeof client.getPriceAndAvailability).toBe('function');
  });
});
