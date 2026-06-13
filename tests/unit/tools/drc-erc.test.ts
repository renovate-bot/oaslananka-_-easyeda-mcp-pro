import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '../../../src/tools/registry.js';
import { type ToolContext } from '../../../src/tools/types.js';
import { registerDrcErcTools } from '../../../src/tools/L1_drc_erc.js';
import { EnvSchema } from '../../../src/config/env.js';

describe('DRC/ERC Tools', () => {
  let registry: ToolRegistry;
  let context: ToolContext;
  let bridgeCall: ReturnType<
    typeof vi.fn<(method: string, params?: unknown, opts?: unknown) => Promise<unknown>>
  >;

  beforeEach(() => {
    registry = new ToolRegistry();
    const config = EnvSchema.parse({ NODE_ENV: 'test' });
    registerDrcErcTools(registry, config);

    bridgeCall = vi.fn();

    context = {
      profile: 'core',
      bridge: {
        connected: true,
        call: bridgeCall,
      },
      config: {
        bridgeTimeoutMs: 1000,
        artifactDir: '.easyeda-mcp-pro/artifacts',
        bridgeHost: '127.0.0.1',
        bridgePort: 49620,
      },
      vendors: {
        lcsc: null,
        jlcpcb: null,
        mouser: null,
        digikey: null,
      },
    };
  });

  it('easyeda_drc_run returns violations from bridge', async () => {
    const tool = registry.get('easyeda_drc_run');
    expect(tool).toBeDefined();

    bridgeCall.mockResolvedValue({
      violations: [
        {
          rule: 'clearance',
          description: 'Track too close to pad',
          location: { x: 10, y: 20, layer: 'Top Layer' },
          severity: 'error',
          net: 'GND',
          component: 'R1',
        },
        {
          rule: 'width',
          description: 'Track width below minimum',
          location: { x: 30, y: 40 },
          severity: 'warning',
        },
      ],
      totalViolations: 2,
      errorCount: 1,
      warningCount: 1,
    });

    const result = await tool?.handler(context, {
      projectId: 'proj-123',
      rules: ['clearance', 'width'],
    });

    expect(bridgeCall).toHaveBeenCalledWith('design.drc', {
      projectId: 'proj-123',
      rules: ['clearance', 'width'],
    });

    expect(result).toBeDefined();
    expect(result?.project_id).toBe('proj-123');
    expect(result?.violations).toHaveLength(2);
    expect(result?.total_violations).toBe(2);
    expect(result?.error_count).toBe(1);
    expect(result?.warning_count).toBe(1);
    expect(result?.passed).toBe(false);

    expect(result?.violations[0]).toMatchObject({
      rule: 'clearance',
      description: 'Track too close to pad',
      location: { x: 10, y: 20, layer: 'Top Layer' },
      severity: 'error',
      net: 'GND',
      component: 'R1',
    });

    expect(result?.violations[1]).toMatchObject({
      rule: 'width',
      description: 'Track width below minimum',
      severity: 'warning',
    });
  });

  it('easyeda_drc_run handles empty violations', async () => {
    const tool = registry.get('easyeda_drc_run');
    expect(tool).toBeDefined();

    bridgeCall.mockResolvedValue({
      violations: [],
      totalViolations: 0,
      errorCount: 0,
      warningCount: 0,
    });

    const result = await tool?.handler(context, { projectId: 'proj-123' });

    expect(result?.violations).toHaveLength(0);
    expect(result?.total_violations).toBe(0);
    expect(result?.error_count).toBe(0);
    expect(result?.warning_count).toBe(0);
    expect(result?.passed).toBe(true);
  });

  it('easyeda_erc_run returns violations from bridge', async () => {
    const tool = registry.get('easyeda_erc_run');
    expect(tool).toBeDefined();

    bridgeCall.mockResolvedValue({
      violations: [
        {
          net: 'VCC',
          component: 'U1',
          description: 'Unconnected pin',
          severity: 'error',
          location: { x: 5, y: 5 },
        },
        {
          net: 'GND',
          description: 'Net with single node',
          severity: 'info',
        },
      ],
      totalViolations: 2,
      errorCount: 1,
      warningCount: 0,
    });

    const result = await tool?.handler(context, {
      projectId: 'proj-123',
      checks: ['unconnected', 'short'],
    });

    expect(bridgeCall).toHaveBeenCalledWith('design.erc', {
      projectId: 'proj-123',
      checks: ['unconnected', 'short'],
    });

    expect(result).toBeDefined();
    expect(result?.project_id).toBe('proj-123');
    expect(result?.violations).toHaveLength(2);
    expect(result?.total_violations).toBe(2);
    expect(result?.error_count).toBe(1);
    expect(result?.warning_count).toBe(0);
    expect(result?.passed).toBe(false);

    expect(result?.violations[0]).toMatchObject({
      net: 'VCC',
      component: 'U1',
      description: 'Unconnected pin',
      severity: 'error',
      location: { x: 5, y: 5 },
    });
  });

  it('easyeda_erc_run handles empty violations', async () => {
    const tool = registry.get('easyeda_erc_run');
    expect(tool).toBeDefined();

    bridgeCall.mockResolvedValue({
      violations: [],
      totalViolations: 0,
      errorCount: 0,
      warningCount: 0,
    });

    const result = await tool?.handler(context, { projectId: 'proj-123' });

    expect(result?.violations).toHaveLength(0);
    expect(result?.total_violations).toBe(0);
    expect(result?.error_count).toBe(0);
    expect(result?.warning_count).toBe(0);
    expect(result?.passed).toBe(true);
  });

  it('easyeda_rule_check_summary returns combined DRC+ERC summary', async () => {
    const tool = registry.get('easyeda_rule_check_summary');
    expect(tool).toBeDefined();

    bridgeCall.mockImplementation(async (method: string) => {
      if (method === 'design.drc') {
        return {
          totalViolations: 3,
          errorCount: 1,
          warningCount: 2,
        };
      }
      if (method === 'design.erc') {
        return {
          totalViolations: 1,
          errorCount: 0,
          warningCount: 1,
        };
      }
      return null;
    });

    const result = await tool?.handler(context, { projectId: 'proj-123' });

    expect(bridgeCall).toHaveBeenCalledWith('design.drc', { projectId: 'proj-123' });
    expect(bridgeCall).toHaveBeenCalledWith('design.erc', { projectId: 'proj-123' });

    expect(result).toBeDefined();
    expect(result?.project_id).toBe('proj-123');
    expect(result?.drc).toMatchObject({
      total: 3,
      errors: 1,
      warnings: 2,
      passed: false,
    });
    expect(result?.erc).toMatchObject({
      total: 1,
      errors: 0,
      warnings: 1,
      passed: true,
    });
    expect(result?.overall_passed).toBe(false);
  });

  it('easyeda_rule_check_summary returns overall_passed true when no errors', async () => {
    const tool = registry.get('easyeda_rule_check_summary');
    expect(tool).toBeDefined();

    bridgeCall.mockImplementation(async (method: string) => {
      if (method === 'design.drc') {
        return {
          totalViolations: 0,
          errorCount: 0,
          warningCount: 0,
        };
      }
      if (method === 'design.erc') {
        return {
          totalViolations: 0,
          errorCount: 0,
          warningCount: 0,
        };
      }
      return null;
    });

    const result = await tool?.handler(context, { projectId: 'proj-123' });

    expect(result?.drc.passed).toBe(true);
    expect(result?.erc.passed).toBe(true);
    expect(result?.overall_passed).toBe(true);
  });

  it('easyeda_drc_run handles bridge failure gracefully', async () => {
    const tool = registry.get('easyeda_drc_run');
    expect(tool).toBeDefined();

    bridgeCall.mockRejectedValue(new Error('Bridge timeout'));

    const result = await tool?.handler(context, { projectId: 'proj-123' });

    expect(result?.not_available).toBe(true);
    expect(result?.project_id).toBe('proj-123');
    expect(result?.violations).toEqual([]);
    expect(result?.total_violations).toBe(0);
    expect(result?.error_count).toBe(0);
    expect(result?.warning_count).toBe(0);
    expect(result?.passed).toBe(false);
    expect(result?.error).toBe('Bridge timeout');
  });

  it('easyeda_erc_run handles bridge failure gracefully', async () => {
    const tool = registry.get('easyeda_erc_run');
    expect(tool).toBeDefined();

    bridgeCall.mockRejectedValue(new Error('Bridge timeout'));

    const result = await tool?.handler(context, { projectId: 'proj-123' });

    expect(result?.not_available).toBe(true);
    expect(result?.project_id).toBe('proj-123');
    expect(result?.violations).toEqual([]);
    expect(result?.total_violations).toBe(0);
    expect(result?.error_count).toBe(0);
    expect(result?.warning_count).toBe(0);
    expect(result?.passed).toBe(false);
    expect(result?.error).toBe('Bridge timeout');
  });

  it('easyeda_rule_check_summary handles bridge failure gracefully', async () => {
    const tool = registry.get('easyeda_rule_check_summary');
    expect(tool).toBeDefined();

    bridgeCall.mockRejectedValue(new Error('Bridge timeout'));

    const result = await tool?.handler(context, { projectId: 'proj-123' });

    expect(result?.not_available).toBe(true);
    expect(result?.project_id).toBe('proj-123');
    expect(result?.drc).toMatchObject({ total: 0, errors: 0, warnings: 0, passed: false });
    expect(result?.erc).toMatchObject({ total: 0, errors: 0, warnings: 0, passed: false });
    expect(result?.overall_passed).toBe(false);
    expect(result?.error).toBe('Bridge timeout');
  });
});
