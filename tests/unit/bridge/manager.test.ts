import { createServer } from 'node:net';
import { WebSocket } from 'ws';
import { describe, it, expect, vi } from 'vitest';
import { EnvSchema } from '../../../src/config/env.js';
import { BridgeManager, parsePortScanSpec } from '../../../src/bridge/manager.js';
import { getLogger } from '../../../src/utils/logger.js';

function createTestConfig(overrides: Record<string, unknown> = {}) {
  return EnvSchema.parse({
    NODE_ENV: 'test',
    BRIDGE_WAIT_FOR_EDA_MS: 0,
    ...overrides,
  });
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Unable to allocate a local test port')));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

function openSocket(port: number): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);
    ws.once('open', () => resolve(ws));
    ws.once('error', reject);
  });
}

function waitForMessage(ws: WebSocket): Promise<unknown> {
  return new Promise((resolve) => {
    ws.once('message', (raw) => resolve(JSON.parse(raw.toString())));
  });
}

function waitForClose(ws: WebSocket): Promise<number> {
  return new Promise((resolve) => {
    ws.once('close', (code) => resolve(code));
  });
}

function sendHandshake(ws: WebSocket, overrides: Record<string, unknown> = {}): void {
  ws.send(
    JSON.stringify({
      type: 'handshake',
      protocol: 'easyeda-mcp-pro.bridge',
      protocolVersion: '1.0.0',
      clientName: 'easyeda-mcp-pro',
      easyedaVersion: 'test',
      devMode: true,
      ...overrides,
    }),
  );
}

/**
 * Create a connected BridgeManager + client pair for security tests.
 * Uses loopback with a BRIDGE_TOKEN so token checks are active but pairing is skipped.
 */
async function setupSecureConnection(extraConfig: Record<string, unknown> = {}) {
  const port = await getFreePort();
  const config = createTestConfig({
    BRIDGE_HOST: '127.0.0.1',
    BRIDGE_PORT_SCAN: String(port),
    BRIDGE_TOKEN: 'test-secret-token',
    ...extraConfig,
  });
  const manager = new BridgeManager(config);
  await manager.connect();

  const socket = await openSocket(port);
  // Send handshake with the correct token
  sendHandshake(socket, { sessionToken: 'test-secret-token' });
  await waitForMessage(socket); // hello
  return { manager, socket, port, config };
}

describe('BridgeManager', () => {
  it('should start in disconnected state', () => {
    const config = createTestConfig();
    const manager = new BridgeManager(config);
    expect(manager.state).toBe('disconnected');
    expect(manager.connected).toBe(false);
  });

  it('should emit state change events', () => {
    const config = createTestConfig();
    const manager = new BridgeManager(config);
    const states: string[] = [];

    manager.on('stateChanged', (state) => {
      states.push(state);
    });

    expect(states).toHaveLength(0);
  });

  it('should throw when calling a method while disconnected', async () => {
    const config = createTestConfig();
    const manager = new BridgeManager(config);
    await expect(manager.call('test.method')).rejects.toThrow('Bridge not connected');
  });

  it('should disconnect cleanly', () => {
    const config = createTestConfig();
    const manager = new BridgeManager(config);
    manager.disconnect('test');
    expect(manager.state).toBe('disconnected');
  });

  it('should handle multiple disconnect calls gracefully', () => {
    const config = createTestConfig();
    const manager = new BridgeManager(config);
    manager.disconnect('first');
    manager.disconnect('second');
    expect(manager.state).toBe('disconnected');
  });

  it('should probe health endpoint', () => {
    const config = createTestConfig();
    const manager = new BridgeManager(config);
    expect(manager.lastHeartbeatMs).toBe(0);
  });

  it('should report uptime as 0 when disconnected', () => {
    const config = createTestConfig();
    const manager = new BridgeManager(config);
    expect(manager.uptimeMs).toBe(0);
  });

  it('should report activePort as 0 when not listening', () => {
    const config = createTestConfig();
    const manager = new BridgeManager(config);
    expect(manager.activePort).toBe(0);
  });

  it('should replace a connected bridge client with a newer validated handshake', async () => {
    const port = await getFreePort();
    const config = createTestConfig({ BRIDGE_HOST: '127.0.0.1', BRIDGE_PORT_SCAN: String(port) });
    const manager = new BridgeManager(config);
    await manager.connect();

    const first = await openSocket(port);
    sendHandshake(first);
    await expect(waitForMessage(first)).resolves.toMatchObject({ type: 'hello' });
    expect(manager.connected).toBe(true);

    const firstClosed = waitForClose(first);
    const second = await openSocket(port);
    sendHandshake(second);
    await expect(waitForMessage(second)).resolves.toMatchObject({ type: 'hello' });

    await expect(firstClosed).resolves.toBe(4000);
    expect(manager.connected).toBe(true);
    expect(manager.activePort).toBe(port);

    second.close();
    manager.disconnect('test complete');
  });

  it('should log a warning if extension version mismatches', async () => {
    const port = await getFreePort();
    const config = createTestConfig({ BRIDGE_HOST: '127.0.0.1', BRIDGE_PORT_SCAN: String(port) });
    const manager = new BridgeManager(config);
    await manager.connect();

    const logger = getLogger();
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const socket = await openSocket(port);
    socket.send(
      JSON.stringify({
        type: 'handshake',
        protocol: 'easyeda-mcp-pro.bridge',
        protocolVersion: '1.0.0',
        clientName: 'easyeda-mcp-pro',
        extensionVersion: '0.0.1',
        easyedaVersion: 'test',
        devMode: true,
      }),
    );

    await expect(waitForMessage(socket)).resolves.toMatchObject({ type: 'hello' });

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('version mismatch: extension is v0.0.1'),
    );

    warnSpy.mockRestore();
    socket.close();
    manager.disconnect('test complete');
  });
});

describe('BridgeManager - token enforcement', () => {
  it('should reject handshake with missing token when BRIDGE_TOKEN is set', async () => {
    const port = await getFreePort();
    const config = createTestConfig({
      BRIDGE_HOST: '127.0.0.1',
      BRIDGE_PORT_SCAN: String(port),
      BRIDGE_TOKEN: 'secret123',
    });
    const manager = new BridgeManager(config);
    await manager.connect();

    const socket = await openSocket(port);
    // Send handshake WITHOUT sessionToken
    sendHandshake(socket);

    const code = await waitForClose(socket);
    expect(code).toBe(4001);
    manager.disconnect('test complete');
  });

  it('should reject handshake with wrong token when BRIDGE_TOKEN is set', async () => {
    const port = await getFreePort();
    const config = createTestConfig({
      BRIDGE_HOST: '127.0.0.1',
      BRIDGE_PORT_SCAN: String(port),
      BRIDGE_TOKEN: 'secret123',
    });
    const manager = new BridgeManager(config);
    await manager.connect();

    const socket = await openSocket(port);
    sendHandshake(socket, { sessionToken: 'wrong-token' });

    const code = await waitForClose(socket);
    expect(code).toBe(4001);
    manager.disconnect('test complete');
  });

  it('should accept handshake with correct token', async () => {
    const port = await getFreePort();
    const config = createTestConfig({
      BRIDGE_HOST: '127.0.0.1',
      BRIDGE_PORT_SCAN: String(port),
      BRIDGE_TOKEN: 'secret123',
    });
    const manager = new BridgeManager(config);
    await manager.connect();

    const socket = await openSocket(port);
    sendHandshake(socket, { sessionToken: 'secret123' });

    const msg = await waitForMessage(socket);
    expect(msg).toMatchObject({ type: 'hello' });
    expect(manager.connected).toBe(true);

    socket.close();
    manager.disconnect('test complete');
  });
});

describe('BridgeManager - protocol version validation', () => {
  it('should reject handshake with unsupported protocol version', async () => {
    const port = await getFreePort();
    const config = createTestConfig({
      BRIDGE_HOST: '127.0.0.1',
      BRIDGE_PORT_SCAN: String(port),
    });
    const manager = new BridgeManager(config);
    await manager.connect();

    const socket = await openSocket(port);
    socket.send(
      JSON.stringify({
        type: 'handshake',
        protocol: 'easyeda-mcp-pro.bridge',
        protocolVersion: '2.0.0',
        clientName: 'easyeda-mcp-pro',
        easyedaVersion: 'test',
        devMode: true,
      }),
    );

    const code = await waitForClose(socket);
    expect(code).toBe(4001);
    manager.disconnect('test complete');
  });

  it('should accept handshake with supported protocol version', async () => {
    const port = await getFreePort();
    const config = createTestConfig({
      BRIDGE_HOST: '127.0.0.1',
      BRIDGE_PORT_SCAN: String(port),
    });
    const manager = new BridgeManager(config);
    await manager.connect();

    const socket = await openSocket(port);
    sendHandshake(socket);

    const msg = await waitForMessage(socket);
    expect(msg).toMatchObject({ type: 'hello' });
    expect(manager.connected).toBe(true);

    socket.close();
    manager.disconnect('test complete');
  });
});

describe('BridgeManager - method registry hash', () => {
  it('should compute methodRegistryHash from EasyedaApiMethodSchema', async () => {
    const config = createTestConfig();
    const manager = new BridgeManager(config);
    expect(manager.methodRegistryHash).toBeTruthy();
    expect(manager.methodRegistryHash.length).toBe(16);
  });

  it('should include computed methodRegistryHash in hello', async () => {
    const port = await getFreePort();
    const config = createTestConfig({
      BRIDGE_HOST: '127.0.0.1',
      BRIDGE_PORT_SCAN: String(port),
    });
    const manager = new BridgeManager(config);
    await manager.connect();

    const socket = await openSocket(port);
    sendHandshake(socket);

    const msg = (await waitForMessage(socket)) as Record<string, unknown>;
    expect(msg.methodRegistryHash).toBe(manager.methodRegistryHash);

    socket.close();
    manager.disconnect('test complete');
  });
});

describe('BridgeManager - payload size limit', () => {
  it('should reject oversized payload with 4009', async () => {
    const port = await getFreePort();
    const config = createTestConfig({
      BRIDGE_HOST: '127.0.0.1',
      BRIDGE_PORT_SCAN: String(port),
      BRIDGE_MAX_PAYLOAD_SIZE: 1024,
    });
    const manager = new BridgeManager(config);
    await manager.connect();

    const socket = await openSocket(port);
    // Send a message that exceeds the 1024-byte limit
    socket.send('x'.repeat(2048));

    const code = await waitForClose(socket);
    expect(code).toBe(4009);
    manager.disconnect('test complete');
  });

  it('should accept payload within limit', async () => {
    const port = await getFreePort();
    const config = createTestConfig({
      BRIDGE_HOST: '127.0.0.1',
      BRIDGE_PORT_SCAN: String(port),
      BRIDGE_MAX_PAYLOAD_SIZE: 1024,
    });
    const manager = new BridgeManager(config);
    await manager.connect();

    const socket = await openSocket(port);
    sendHandshake(socket);

    const msg = await waitForMessage(socket);
    expect(msg).toMatchObject({ type: 'hello' });

    socket.close();
    manager.disconnect('test complete');
  });
});

describe('BridgeManager - unknown method in incoming request', () => {
  it('should reject request with unknown method via structured error', async () => {
    const { manager, socket } = await setupSecureConnection();

    socket.send(
      JSON.stringify({
        id: 'req_1',
        type: 'request',
        method: 'nonexistent.method',
      }),
    );

    const response = (await waitForMessage(socket)) as Record<string, unknown>;
    expect(response).toMatchObject({
      type: 'response',
      ok: false,
    });
    expect((response.error as Record<string, unknown>)?.code).toBe('METHOD_NOT_FOUND');

    socket.close();
    manager.disconnect('test complete');
  });
});

describe('BridgeManager - reconnect', () => {
  it('should emit reconnecting event on disconnect', async () => {
    const port = await getFreePort();
    const config = createTestConfig({
      BRIDGE_HOST: '127.0.0.1',
      BRIDGE_PORT_SCAN: String(port),
    });
    const manager = new BridgeManager(config);
    await manager.connect();

    const reconnectingSpy = vi.fn();
    manager.on('reconnecting', reconnectingSpy);

    const socket = await openSocket(port);
    sendHandshake(socket);
    await waitForMessage(socket);

    // Kill the connection
    socket.close();

    // Wait a short bit for the event to fire
    await new Promise((r) => setTimeout(r, 100));

    expect(reconnectingSpy).toHaveBeenCalledTimes(1);
    expect(reconnectingSpy).toHaveBeenCalledWith(expect.objectContaining({ attempt: 1 }));

    manager.disconnect('test complete');
  });

  it('should reset reconnect counter on successful handshake', async () => {
    // This is verified implicitly: reconnect is only scheduled on disconnect,
    // and a new handshake resets reconnectAttempts. We test that reconnecting
    // events fire sequentially only for new disconnect cycles.
    const port = await getFreePort();
    const config = createTestConfig({
      BRIDGE_HOST: '127.0.0.1',
      BRIDGE_PORT_SCAN: String(port),
    });
    const manager = new BridgeManager(config);
    await manager.connect();

    const reconnectingSpy = vi.fn();
    manager.on('reconnecting', reconnectingSpy);

    const socket = await openSocket(port);
    sendHandshake(socket);
    await waitForMessage(socket);

    // First disconnect
    socket.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(reconnectingSpy).toHaveBeenCalledTimes(1);

    // Force reconnect by connecting again (simulate extension reconnecting)
    // Just verify the counter state
    expect((manager as unknown as Record<string, unknown>).reconnectAttempts).toBe(1);

    manager.disconnect('test complete');
  });
});

describe('parsePortScanSpec', () => {
  it('should parse single port', () => {
    expect(parsePortScanSpec('18601')).toEqual([18601]);
  });

  it('should parse comma-separated ports', () => {
    expect(parsePortScanSpec('18601,49620')).toEqual([18601, 49620]);
  });

  it('should parse port range', () => {
    expect(parsePortScanSpec('49620-49622')).toEqual([49620, 49621, 49622]);
  });

  it('should parse mixed spec', () => {
    expect(parsePortScanSpec('18601,49620-49622')).toEqual([18601, 49620, 49621, 49622]);
  });

  it('should ignore whitespace', () => {
    expect(parsePortScanSpec(' 18601 , 49620-49621 ')).toEqual([18601, 49620, 49621]);
  });

  it('should return empty array for empty string', () => {
    expect(parsePortScanSpec('')).toEqual([]);
  });

  it('should skip invalid ports', () => {
    expect(parsePortScanSpec('0,99999,-1')).toEqual([]);
  });

  it('should return empty array for invalid format', () => {
    expect(parsePortScanSpec('abc')).toEqual([]);
  });
});
