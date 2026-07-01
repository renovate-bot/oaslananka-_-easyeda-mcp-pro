import { z } from 'zod';
import { type ToolDefinition, type ToolContext } from './types.js';
import { type EnvConfig } from '../config/env.js';
import { validatePcbConstraints } from '../pcb-constraints/index.js';
import type { PcbConstraintInput } from '../pcb-constraints/types.js';

const productionReviewBoardDataSchema = z.object({}).passthrough();

const productionReviewIssueSchema = z.object({
  code: z.string(),
  message: z.string(),
  severity: z.string(),
  remediationHint: z.string(),
});

function runProductionReview(
  boardData: Partial<PcbConstraintInput> | undefined,
  mode: 'off' | 'warn' | 'block' | undefined,
) {
  if (!mode || mode === 'off') return undefined;
  const result = validatePcbConstraints((boardData ?? {}) as PcbConstraintInput);
  const errors = result.errors.map((issue) => ({
    code: issue.code,
    message: issue.message,
    severity: issue.severity,
    remediationHint: issue.remediationHint,
  }));
  const warnings = result.warnings.map((issue) => ({
    code: issue.code,
    message: issue.message,
    severity: issue.severity,
    remediationHint: issue.remediationHint,
  }));
  return {
    mode,
    passed: result.valid,
    blocked: mode === 'block' && errors.length > 0,
    error_count: errors.length,
    warning_count: warnings.length,
    errors,
    warnings,
  };
}

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
      productionReview: z
        .object({
          mode: z.enum(['off', 'warn', 'block']).default('warn'),
          boardData: productionReviewBoardDataSchema.optional(),
        })
        .optional(),
    }),
    outputSchema: z.object({
      project_id: z.string(),
      artifact_path: z.string().optional(),
      file_count: z.number().int().nonnegative().optional(),
      exported: z.boolean(),
      blocked_by_production_review: z.boolean().optional(),
      production_review: z
        .object({
          mode: z.string(),
          passed: z.boolean(),
          blocked: z.boolean(),
          error_count: z.number().int().nonnegative(),
          warning_count: z.number().int().nonnegative(),
          errors: z.array(productionReviewIssueSchema),
          warnings: z.array(productionReviewIssueSchema),
        })
        .optional(),
      not_available: z.boolean().optional(),
    }),
    handler: async (ctx: ToolContext, params: unknown) => {
      const { projectId, drillFormat, excludeLayer, ledPanel, productionReview } = params as {
        projectId: string;
        drillFormat?: string;
        excludeLayer?: string[];
        ledPanel?: boolean;
        productionReview?: {
          mode?: 'off' | 'warn' | 'block';
          boardData?: Partial<PcbConstraintInput>;
        };
      };
      try {
        const productionReviewResult = runProductionReview(
          productionReview?.boardData,
          productionReview?.mode,
        );

        if (productionReviewResult?.blocked) {
          return {
            project_id: projectId,
            exported: false,
            blocked_by_production_review: true,
            production_review: productionReviewResult,
          };
        }

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
          production_review: productionReviewResult,
        };
      } catch (err) {
        return {
          project_id: projectId,
          exported: false,
          production_review: runProductionReview(
            productionReview?.boardData,
            productionReview?.mode,
          ),
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
