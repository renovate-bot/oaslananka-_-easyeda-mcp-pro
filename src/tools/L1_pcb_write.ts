import { z } from 'zod';
import { type ToolDefinition, type ToolContext } from './types.js';
import { type EnvConfig } from '../config/env.js';

function registerPcbWriteTools(
  registry: { register: (def: ToolDefinition) => void },
  _config: EnvConfig,
) {
  registry.register({
    name: 'easyeda_pcb_place_component',
    title: 'Place component on PCB',
    description: 'Place a component footprint on the active PCB layout.',
    profile: 'full',
    evidence: ['official-docs'],
    risk: 'high',
    confirmWrite: true,
    group: 'pcb-write',
    version: '1.0.0',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
    },
    inputSchema: z.object({
      footprint: z.string(),
      x: z.number(),
      y: z.number(),
      rotation: z.number().default(0),
      layer: z.number().default(1),
      confirmWrite: z.literal(true),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      primitiveId: z.string().optional(),
      error: z.string().optional(),
    }),
    handler: async (ctx: ToolContext, params: unknown) => {
      const p = params as {
        footprint: string;
        x: number;
        y: number;
        rotation: number;
        layer: number;
      };
      try {
        const result = await ctx.bridge.call<
          Record<string, unknown>,
          { primitiveId?: string; result?: string }
        >('pcb.placeComponent', {
          footprint: p.footprint,
          x: p.x,
          y: p.y,
          rotation: p.rotation,
          layer: p.layer,
        });
        const data = result as { primitiveId?: string; result?: string } | string;
        return {
          success: true,
          primitiveId:
            typeof data === 'string' ? data : (data?.primitiveId ?? data?.result ?? undefined),
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });

  registry.register({
    name: 'easyeda_pcb_add_track',
    title: 'Add PCB track',
    description: 'Draw a copper track/trace segment on the PCB board.',
    profile: 'full',
    evidence: ['official-docs'],
    risk: 'high',
    confirmWrite: true,
    group: 'pcb-write',
    version: '1.0.0',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
    },
    inputSchema: z.object({
      points: z.array(z.object({ x: z.number(), y: z.number() })),
      layer: z.number(),
      width: z.number(),
      netName: z.string().optional(),
      confirmWrite: z.literal(true),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      primitiveId: z.string().optional(),
      error: z.string().optional(),
    }),
    handler: async (ctx: ToolContext, params: unknown) => {
      const p = params as {
        points: Array<{ x: number; y: number }>;
        layer: number;
        width: number;
        netName?: string;
      };
      try {
        const flatPoints = p.points.flatMap((pt) => [pt.x, pt.y]);
        const result = await ctx.bridge.call<
          Record<string, unknown>,
          { primitiveId?: string; result?: string }
        >('pcb.addTrack', {
          points: flatPoints,
          layer: p.layer,
          width: p.width,
          netName: p.netName,
        });
        const data = result as { primitiveId?: string; result?: string } | string;
        return {
          success: true,
          primitiveId:
            typeof data === 'string' ? data : (data?.primitiveId ?? data?.result ?? undefined),
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });

  registry.register({
    name: 'easyeda_pcb_add_via',
    title: 'Add PCB via',
    description: 'Place a via to connect different copper layers on the PCB board.',
    profile: 'full',
    evidence: ['official-docs'],
    risk: 'high',
    confirmWrite: true,
    group: 'pcb-write',
    version: '1.0.0',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
    },
    inputSchema: z.object({
      x: z.number(),
      y: z.number(),
      outerDiameter: z.number(),
      holeSize: z.number(),
      netName: z.string().optional(),
      confirmWrite: z.literal(true),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      primitiveId: z.string().optional(),
      error: z.string().optional(),
    }),
    handler: async (ctx: ToolContext, params: unknown) => {
      const p = params as {
        x: number;
        y: number;
        outerDiameter: number;
        holeSize: number;
        netName?: string;
      };
      try {
        const result = await ctx.bridge.call<
          Record<string, unknown>,
          { primitiveId?: string; result?: string }
        >('pcb.addVia', {
          x: p.x,
          y: p.y,
          outerDiameter: p.outerDiameter,
          holeSize: p.holeSize,
          netName: p.netName,
        });
        const data = result as { primitiveId?: string; result?: string } | string;
        return {
          success: true,
          primitiveId:
            typeof data === 'string' ? data : (data?.primitiveId ?? data?.result ?? undefined),
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });

  registry.register({
    name: 'easyeda_pcb_add_zone',
    title: 'Add PCB copper zone/pour',
    description: 'Create a copper pour zone on a specific layer with clearance settings.',
    profile: 'full',
    evidence: ['official-docs'],
    risk: 'high',
    confirmWrite: true,
    group: 'pcb-write',
    version: '1.0.0',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
    },
    inputSchema: z.object({
      points: z.array(z.object({ x: z.number(), y: z.number() })),
      layer: z.number(),
      netName: z.string().optional(),
      clearance: z.number().optional(),
      confirmWrite: z.literal(true),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      primitiveId: z.string().optional(),
      error: z.string().optional(),
    }),
    handler: async (ctx: ToolContext, params: unknown) => {
      const p = params as {
        points: Array<{ x: number; y: number }>;
        layer: number;
        netName?: string;
        clearance?: number;
      };
      try {
        const flatPoints = p.points.flatMap((pt) => [pt.x, pt.y]);
        const result = await ctx.bridge.call<
          Record<string, unknown>,
          { primitiveId?: string; result?: string }
        >('pcb.addZone', {
          points: flatPoints,
          layer: p.layer,
          netName: p.netName,
          clearance: p.clearance,
        });
        const data = result as { primitiveId?: string; result?: string } | string;
        return {
          success: true,
          primitiveId:
            typeof data === 'string' ? data : (data?.primitiveId ?? data?.result ?? undefined),
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });

  registry.register({
    name: 'easyeda_pcb_delete_component',
    title: 'Delete PCB components',
    description: 'Delete components from the PCB layout by their primitive IDs.',
    profile: 'full',
    evidence: ['official-docs'],
    risk: 'high',
    confirmWrite: true,
    group: 'pcb-write',
    version: '1.0.0',
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
    },
    inputSchema: z.object({
      primitiveIds: z.array(z.string()),
      confirmWrite: z.literal(true),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      deletedCount: z.number().optional(),
      error: z.string().optional(),
    }),
    handler: async (ctx: ToolContext, params: unknown) => {
      const p = params as { primitiveIds: string[] };
      try {
        await ctx.bridge.call<Record<string, unknown>, { primitiveId?: string; result?: string }>(
          'pcb.deleteComponent',
          {
            primitiveIds: p.primitiveIds,
          },
        );
        return {
          success: true,
          deletedCount: p.primitiveIds.length,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });

  registry.register({
    name: 'easyeda_pcb_modify_component',
    title: 'Modify PCB component properties',
    description: 'Modify component properties in the PCB layout.',
    profile: 'full',
    evidence: ['official-docs'],
    risk: 'high',
    confirmWrite: true,
    group: 'pcb-write',
    version: '1.0.0',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
    },
    inputSchema: z.object({
      primitiveId: z.string(),
      property: z.record(z.string(), z.unknown()),
      confirmWrite: z.literal(true),
    }),
    outputSchema: z.object({
      success: z.boolean(),
      error: z.string().optional(),
    }),
    handler: async (ctx: ToolContext, params: unknown) => {
      const p = params as { primitiveId: string; property: Record<string, unknown> };
      try {
        await ctx.bridge.call<Record<string, unknown>, { primitiveId?: string; result?: string }>(
          'pcb.modifyComponent',
          {
            primitiveId: p.primitiveId,
            property: p.property,
          },
        );
        return {
          success: true,
        };
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });
}

export { registerPcbWriteTools };
