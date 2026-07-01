import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToolRegistry } from '../../../src/tools/registry.js';
import { type ToolContext } from '../../../src/tools/types.js';
import { registerExportTools } from '../../../src/tools/L1_export.js';
import { EnvSchema } from '../../../src/config/env.js';

describe('Export Tools', () => {
  let registry: ToolRegistry;
  let context: ToolContext;
  let bridgeCall: any;

  beforeEach(() => {
    registry = new ToolRegistry();
    const config = EnvSchema.parse({ NODE_ENV: 'test' });
    registerExportTools(registry, config);

    bridgeCall = vi.fn();

    context = {
      profile: 'pro',
      bridge: {
        connected: true,
        call: bridgeCall,
      },
      config: {
        bridgeTimeoutMs: 1000,
        artifactDir: '.easyeda-mcp-pro/artifacts',
      },
      vendors: {
        lcsc: null,
        jlcpcb: null,
        mouser: null,
        digikey: null,
      },
    };
  });

  it('easyeda_export_gerbers warns with production review findings but still exports in warn mode', async () => {
    const tool = registry.get('easyeda_export_gerbers');
    expect(tool).toBeDefined();

    bridgeCall.mockResolvedValue({ artifactPath: 'artifacts/gerbers.zip', fileCount: 12 });

    const result = await tool?.handler(context, {
      projectId: 'proj-123',
      productionReview: {
        mode: 'warn',
        boardData: {
          hasOutline: true,
          hasLayerStack: true,
          hasNetClasses: true,
          hasClearanceRules: true,
          hasKeepoutAreas: true,
          hasPlacementZones: true,
          hasFiducials: true,
          mountingHoleCount: 4,
          manufacturingProcess: 'standard',
          hasQuantity: true,
          hasDrillFile: false,
        },
      },
    });

    expect(bridgeCall).toHaveBeenCalledWith('board.exportGerbers', {
      projectId: 'proj-123',
      drillFormat: undefined,
      excludeLayer: undefined,
      ledPanel: undefined,
    });
    expect(result?.exported).toBe(true);
    expect(result?.production_review?.passed).toBe(false);
    expect(result?.production_review?.errors[0].code).toBe('PCB_DRILL_FILE_MISSING');
  });

  it('easyeda_export_gerbers blocks before bridge export when production review is in block mode', async () => {
    const tool = registry.get('easyeda_export_gerbers');
    expect(tool).toBeDefined();

    const result = await tool?.handler(context, {
      projectId: 'proj-123',
      productionReview: {
        mode: 'block',
        boardData: {
          hasOutline: true,
          hasLayerStack: true,
          hasNetClasses: true,
          hasClearanceRules: true,
          hasKeepoutAreas: true,
          hasPlacementZones: true,
          hasFiducials: true,
          mountingHoleCount: 4,
          manufacturingProcess: 'standard',
          hasQuantity: true,
          hasDrillFile: false,
        },
      },
    });

    expect(bridgeCall).not.toHaveBeenCalled();
    expect(result?.exported).toBe(false);
    expect(result?.blocked_by_production_review).toBe(true);
    expect(result?.production_review?.blocked).toBe(true);
  });

  it('easyeda_export_pick_place should call correct bridge method and return result', async () => {
    const tool = registry.get('easyeda_export_pick_place');
    expect(tool).toBeDefined();

    bridgeCall.mockResolvedValue({
      filePath: 'artifacts/pick_place.csv',
      componentCount: 23,
    });

    const result = await tool?.handler(context, {
      projectId: 'proj-123',
      format: 'csv',
    });

    expect(bridgeCall).toHaveBeenCalledWith('export.pickPlace', {
      projectId: 'proj-123',
      format: 'csv',
    });

    expect(result).toMatchObject({
      project_id: 'proj-123',
      format: 'csv',
      file_path: 'artifacts/pick_place.csv',
      component_count: 23,
      exported: true,
    });
  });

  it('easyeda_export_pdf should call correct bridge method and return result', async () => {
    const tool = registry.get('easyeda_export_pdf');
    expect(tool).toBeDefined();

    bridgeCall.mockResolvedValue({
      filePath: 'artifacts/schematic.pdf',
      pages: 3,
    });

    const result = await tool?.handler(context, {
      projectId: 'proj-123',
      scope: 'schematic',
      orientation: 'landscape',
    });

    expect(bridgeCall).toHaveBeenCalledWith('export.pdf', {
      projectId: 'proj-123',
      scope: 'schematic',
      orientation: 'landscape',
      what: 'schematic',
    });

    expect(result).toMatchObject({
      project_id: 'proj-123',
      scope: 'schematic',
      orientation: 'landscape',
      file_path: 'artifacts/schematic.pdf',
      pages: 3,
      exported: true,
    });
  });

  it('easyeda_export_netlist should call correct bridge method and return result', async () => {
    const tool = registry.get('easyeda_export_netlist');
    expect(tool).toBeDefined();

    bridgeCall.mockResolvedValue({
      filePath: 'artifacts/netlist.net',
      netCount: 12,
    });

    const result = await tool?.handler(context, {
      projectId: 'proj-123',
      format: 'pads',
    });

    expect(bridgeCall).toHaveBeenCalledWith('export.netlist', {
      projectId: 'proj-123',
      format: 'pads',
    });

    expect(result).toMatchObject({
      project_id: 'proj-123',
      format: 'pads',
      file_path: 'artifacts/netlist.net',
      net_count: 12,
      exported: true,
    });
  });
});
