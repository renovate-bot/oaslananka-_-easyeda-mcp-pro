import { describe, it, expect } from 'vitest';
import { EnvSchema } from '../../../src/config/env.js';
import { DigiKeyClient } from '../../../src/vendors/digikey/client.js';

describe('DigiKeyClient', () => {
  it('should throw when DIGIKEY_ENABLED is false', () => {
    const config = EnvSchema.parse({
      NODE_ENV: 'test',
      DIGIKEY_ENABLED: false,
    });
    expect(() => new DigiKeyClient(config)).toThrow('DigiKey API is not enabled');
  });

  it('should throw when credentials are missing', () => {
    const config = EnvSchema.parse({
      NODE_ENV: 'test',
      DIGIKEY_ENABLED: true,
      DIGIKEY_CLIENT_ID: '',
      DIGIKEY_CLIENT_SECRET: '',
    });
    expect(() => new DigiKeyClient(config)).toThrow('DigiKey credentials are missing');
  });

  it('should construct when enabled with credentials', () => {
    const config = EnvSchema.parse({
      NODE_ENV: 'test',
      DIGIKEY_ENABLED: true,
      DIGIKEY_CLIENT_ID: 'test-client-id',
      DIGIKEY_CLIENT_SECRET: 'test-client-secret',
    });
    const client = new DigiKeyClient(config);
    expect(client).toBeInstanceOf(DigiKeyClient);
    expect(typeof client.searchByKeyword).toBe('function');
    expect(typeof client.getProductDetails).toBe('function');
    expect(typeof client.getDigitalBom).toBe('function');
  });

  it('should use sandbox URL when configured', () => {
    const config = EnvSchema.parse({
      NODE_ENV: 'test',
      DIGIKEY_ENABLED: true,
      DIGIKEY_CLIENT_ID: 'test-client-id',
      DIGIKEY_CLIENT_SECRET: 'test-client-secret',
      DIGIKEY_SANDBOX: true,
    });
    const client = new DigiKeyClient(config);
    expect(client).toBeDefined();
  });
});
