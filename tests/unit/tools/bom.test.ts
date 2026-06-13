import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '../../../src/tools/registry.js';
import { type ToolContext } from '../../../src/tools/types.js';
import { registerBomCoreTools } from '../../../src/tools/L1_bom_core.js';
import { registerBomSourcingTools } from '../../../src/tools/L1_bom_sourcing.js';
import { EnvSchema } from '../../../src/config/env.js';

describe('BOM Tools Sourcing & Validate', () => {
  let registry: ToolRegistry;
  let context: ToolContext;
  let bridgeCall: any;
  let getPartDetailMock: any;

  beforeEach(() => {
    registry = new ToolRegistry();
    const config = EnvSchema.parse({ NODE_ENV: 'test', JLCSEARCH_ENABLED: 'true' });
    registerBomCoreTools(registry, config);
    registerBomSourcingTools(registry, config);

    bridgeCall = vi.fn();
    getPartDetailMock = vi.fn();

    context = {
      profile: 'core',
      bridge: {
        connected: true,
        call: bridgeCall,
      },
      config: {
        bridgeTimeoutMs: 1000,
        artifactDir: '.easyeda-mcp-pro/artifacts',
      },
      vendors: {
        lcsc: {
          getPartDetail: getPartDetailMock,
        } as any,
        jlcpcb: null,
        mouser: null,
        digikey: null,
      },
    };
  });

  it('easyeda_bom_sourcing should query LCSC client and return correct sourcing data', async () => {
    const tool = registry.get('easyeda_bom_sourcing');
    expect(tool).toBeDefined();

    bridgeCall.mockResolvedValue([
      { reference: 'R1', value: '10k', lcsc: 'C12345', quantity: 1 },
      { reference: 'C1', value: '100nF', lcsc: 'C67890', quantity: 2 },
    ]);

    getPartDetailMock.mockImplementation(async (lcscCode: string) => {
      if (lcscCode === 'C12345') {
        return {
          lcsc: 'C12345',
          stockCount: 1500,
          price: '0.015',
          leadTime: 2,
        };
      }
      return null;
    });

    const result = await tool?.handler(context, {
      projectId: 'proj-123',
      suppliers: ['lcsc'],
    });

    expect(bridgeCall).toHaveBeenCalledWith('bom.generate', {
      projectId: 'proj-123',
      format: 'json',
      groupBy: 'lcsc',
    });

    expect(result).toBeDefined();
    expect(result.project_id).toBe('proj-123');
    expect(result.total_parts).toBe(2);
    expect(result.parts[0]).toMatchObject({
      reference: 'R1',
      value: '10k',
      lcsc: 'C12345',
      sourcing: [
        {
          supplier: 'lcsc',
          in_stock: true,
          quantity_available: 1500,
          unit_price: 0.015,
          currency: 'USD',
          lead_time_days: 2,
        },
      ],
    });
    expect(result.parts[1]?.sourcing).toHaveLength(0);
  });

  it('easyeda_bom_validate should categorize missing, invalid, and obsolete parts', async () => {
    const tool = registry.get('easyeda_bom_validate');
    expect(tool).toBeDefined();

    bridgeCall.mockResolvedValue([
      { reference: 'R1', value: '10k' }, // Missing LCSC
      { reference: 'C1', value: '100nF', lcsc: 'C99999' }, // Invalid
      { reference: 'U1', value: 'MCU', lcsc: 'C55555' }, // Obsolete
      { reference: 'Q1', value: 'MOSFET', lcsc: 'C11111' }, // Valid
    ]);

    getPartDetailMock.mockImplementation(async (lcscCode: string) => {
      if (lcscCode === 'C55555') {
        return { lcsc: 'C55555', discontinued: true };
      }
      if (lcscCode === 'C11111') {
        return { lcsc: 'C11111', discontinued: false, stock: 100 };
      }
      return null; // C99999 is invalid
    });

    const result = await tool?.handler(context, {
      projectId: 'proj-123',
    });

    expect(result).toBeDefined();
    expect(result.project_id).toBe('proj-123');
    expect(result.total_parts).toBe(4);
    expect(result.missing_lcsc).toContain('R1');
    expect(result.invalid_lcsc).toContain('C1');
    expect(result.obsolete).toContain('U1');
    expect(result.valid_count).toBe(1);
    expect(result.validated).toBe(true);
  });
});
