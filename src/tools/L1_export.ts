import { z } from 'zod';
import { type ToolDefinition, type ToolContext } from './types.js';
import { type EnvConfig } from '../config/env.js';

function registerExportTools(
  registry: { register: (def: ToolDefinition) => void },
  _config: EnvConfig,
) {
  registry.register({
    name: 'easyeda_export_gerbers',
    title: 'Export Gerber files',
    description: 'Export PCB design to Gerber files for PCB fabrication.',
    profile: 'core',
    evidence: ['official-docs'],
    risk: 'medium',
    confirmWrite: false,
    group: 'export',
    version: '1.0.0',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: z.object({
      projectId: z.string(),
      drillFormat: z.enum(['excellon', 'millimeter', 'inch']).optional(),
      excludeLayer: z.array(z.string()).optional(),
      ledPanel: z.boolean().optional(),
    }),
    outputSchema: z.object({
      project_id: z.string(),
      artifact_path: z.string().optional(),
      file_count: z.number().int().nonnegative().optional(),
      exported: z.boolean(),
      not_available: z.boolean().optional(),
    }),
    handler: async (ctx: ToolContext, params: unknown) => {
      const { projectId, drillFormat, excludeLayer, ledPanel } = params as {
        projectId: string;
        drillFormat?: string;
        excludeLayer?: string[];
        ledPanel?: boolean;
      };
      try {
        const result = await ctx.bridge.call('board.exportGerbers', {
          projectId,
          drillFormat,
          excludeLayer,
          ledPanel,
        });
        const data = result as { artifactPath?: string; fileCount?: number };
        return {
          project_id: projectId,
          artifact_path: data.artifactPath,
          file_count: data.fileCount,
          exported: true,
        };
      } catch (err) {
        return {
          project_id: projectId,
          exported: false,
          not_available: true,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });

  registry.register({
    name: 'easyeda_export_pick_place',
    title: 'Export pick-and-place file',
    description:
      'Export pick-and-place (centroid) file for PCB assembly. Contains component reference, position, rotation, and layer.',
    profile: 'pro',
    evidence: ['official-docs'],
    risk: 'low',
    confirmWrite: false,
    group: 'export',
    version: '1.0.0',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: z.object({
      projectId: z.string(),
      format: z.enum(['csv', 'txt']).default('csv'),
    }),
    outputSchema: z.object({
      project_id: z.string(),
      format: z.string(),
      file_path: z.string().optional(),
      component_count: z.number().int().nonnegative().optional(),
      exported: z.boolean(),
      not_available: z.boolean().optional(),
    }),
    handler: async (ctx: ToolContext, params: unknown) => {
      const { projectId, format } = params as { projectId: string; format: string };
      try {
        const result = await ctx.bridge.call('export.pickPlace', {
          projectId,
          format,
        });
        const data = result as { filePath?: string; componentCount?: number };
        return {
          project_id: projectId,
          format,
          file_path: data.filePath,
          component_count: data.componentCount,
          exported: true,
        };
      } catch (err) {
        return {
          project_id: projectId,
          format,
          exported: false,
          not_available: true,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });

  registry.register({
    name: 'easyeda_export_pdf',
    title: 'Export to PDF',
    description: 'Export the schematic and/or board layout to PDF.',
    profile: 'pro',
    evidence: ['official-docs'],
    risk: 'low',
    confirmWrite: false,
    group: 'export',
    version: '1.0.0',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: z.object({
      projectId: z.string(),
      scope: z.enum(['schematic', 'board', 'both']).default('both'),
      orientation: z.enum(['portrait', 'landscape']).default('landscape'),
    }),
    outputSchema: z.object({
      project_id: z.string(),
      scope: z.string(),
      orientation: z.string(),
      file_path: z.string().optional(),
      pages: z.number().int().nonnegative().optional(),
      exported: z.boolean(),
      not_available: z.boolean().optional(),
    }),
    handler: async (ctx: ToolContext, params: unknown) => {
      const { projectId, scope, orientation } = params as {
        projectId: string;
        scope: string;
        orientation: string;
      };
      try {
        const result = await ctx.bridge.call('export.pdf', {
          projectId,
          scope,
          orientation,
          what: scope,
        });
        const data = result as { filePath?: string; pages?: number };
        return {
          project_id: projectId,
          scope,
          orientation,
          file_path: data.filePath,
          pages: data.pages,
          exported: true,
        };
      } catch (err) {
        return {
          project_id: projectId,
          scope,
          orientation,
          exported: false,
          not_available: true,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });

  registry.register({
    name: 'easyeda_export_netlist',
    title: 'Export netlist',
    description:
      'Export the schematic netlist in a specified EDA tool format (PADS, Allegro, or Altium).',
    profile: 'pro',
    evidence: ['official-docs'],
    risk: 'low',
    confirmWrite: false,
    group: 'export',
    version: '1.0.0',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: z.object({
      projectId: z.string(),
      format: z.enum(['pads', 'allegro', 'altium']).default('pads'),
    }),
    outputSchema: z.object({
      project_id: z.string(),
      format: z.string(),
      file_path: z.string().optional(),
      net_count: z.number().int().nonnegative().optional(),
      exported: z.boolean(),
      not_available: z.boolean().optional(),
    }),
    handler: async (ctx: ToolContext, params: unknown) => {
      const { projectId, format } = params as { projectId: string; format: string };
      try {
        const result = await ctx.bridge.call('export.netlist', {
          projectId,
          format,
        });
        const data = result as { filePath?: string; netCount?: number };
        return {
          project_id: projectId,
          format,
          file_path: data.filePath,
          net_count: data.netCount,
          exported: true,
        };
      } catch (err) {
        return {
          project_id: projectId,
          format,
          exported: false,
          not_available: true,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });
}

export { registerExportTools };
