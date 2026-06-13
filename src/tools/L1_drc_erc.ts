import { z } from 'zod';
import { type ToolDefinition, type ToolContext } from './types.js';
import { type EnvConfig } from '../config/env.js';

function registerDrcErcTools(
  registry: { register: (def: ToolDefinition) => void },
  _config: EnvConfig,
) {
  registry.register({
    name: 'easyeda_drc_run',
    title: 'Run design rule check',
    description:
      'Run design rule check (DRC) on the project to identify rule violations, clearance issues, and manufacturing constraints.',
    profile: 'core',
    evidence: ['official-docs'],
    risk: 'medium',
    confirmWrite: false,
    group: 'drc-erc',
    version: '1.0.0',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: z.object({
      projectId: z.string(),
      rules: z.array(z.string()).optional(),
    }),
    outputSchema: z.object({
      project_id: z.string(),
      violations: z.array(
        z.object({
          rule: z.string(),
          description: z.string(),
          location: z
            .object({
              x: z.number(),
              y: z.number(),
              layer: z.string().optional(),
            })
            .optional(),
          severity: z.enum(['error', 'warning', 'info']),
          net: z.string().optional(),
          component: z.string().optional(),
        }),
      ),
      total_violations: z.number().int().nonnegative(),
      error_count: z.number().int().nonnegative(),
      warning_count: z.number().int().nonnegative(),
      passed: z.boolean(),
      not_available: z.boolean().optional(),
    }),
    handler: async (ctx: ToolContext, params: unknown) => {
      const { projectId, rules } = params as { projectId: string; rules?: string[] };
      try {
        const result = await ctx.bridge.call('design.drc', { projectId, rules });
        const data = result as {
          violations?: Array<{
            rule?: string;
            description?: string;
            location?: { x?: number; y?: number; layer?: string };
            severity?: string;
            net?: string;
            component?: string;
          }>;
          totalViolations?: number;
          errorCount?: number;
          warningCount?: number;
        };
        const violations = (data.violations ?? []).map((v) => ({
          rule: v.rule ?? '',
          description: v.description ?? '',
          location: v.location
            ? {
                x: v.location.x ?? 0,
                y: v.location.y ?? 0,
                layer: v.location.layer,
              }
            : undefined,
          severity: (v.severity === 'error' || v.severity === 'warning' || v.severity === 'info'
            ? v.severity
            : 'info') as 'error' | 'warning' | 'info',
          net: v.net,
          component: v.component,
        }));
        return {
          project_id: projectId,
          violations,
          total_violations: data.totalViolations ?? violations.length,
          error_count: data.errorCount ?? violations.filter((v) => v.severity === 'error').length,
          warning_count:
            data.warningCount ?? violations.filter((v) => v.severity === 'warning').length,
          passed: (data.errorCount ?? 0) === 0,
        };
      } catch (err) {
        return {
          project_id: projectId,
          violations: [],
          total_violations: 0,
          error_count: 0,
          warning_count: 0,
          passed: false,
          not_available: true,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });

  registry.register({
    name: 'easyeda_erc_run',
    title: 'Run electrical rule check',
    description:
      'Run electrical rule check (ERC) on the schematic to detect unconnected nets, short circuits, and electrical conflicts.',
    profile: 'core',
    evidence: ['official-docs'],
    risk: 'medium',
    confirmWrite: false,
    group: 'drc-erc',
    version: '1.0.0',
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: z.object({
      projectId: z.string(),
      checks: z.array(z.string()).optional(),
    }),
    outputSchema: z.object({
      project_id: z.string(),
      violations: z.array(
        z.object({
          net: z.string().optional(),
          component: z.string().optional(),
          description: z.string(),
          severity: z.enum(['error', 'warning', 'info']),
          location: z
            .object({
              x: z.number(),
              y: z.number(),
            })
            .optional(),
        }),
      ),
      total_violations: z.number().int().nonnegative(),
      error_count: z.number().int().nonnegative(),
      warning_count: z.number().int().nonnegative(),
      passed: z.boolean(),
      not_available: z.boolean().optional(),
    }),
    handler: async (ctx: ToolContext, params: unknown) => {
      const { projectId, checks } = params as { projectId: string; checks?: string[] };
      try {
        const result = await ctx.bridge.call('design.erc', { projectId, checks });
        const data = result as {
          violations?: Array<{
            net?: string;
            component?: string;
            description?: string;
            severity?: string;
            location?: { x?: number; y?: number };
          }>;
          totalViolations?: number;
          errorCount?: number;
          warningCount?: number;
        };
        const violations = (data.violations ?? []).map((v) => ({
          net: v.net,
          component: v.component,
          description: v.description ?? '',
          severity: (v.severity === 'error' || v.severity === 'warning' || v.severity === 'info'
            ? v.severity
            : 'info') as 'error' | 'warning' | 'info',
          location: v.location
            ? {
                x: v.location.x ?? 0,
                y: v.location.y ?? 0,
              }
            : undefined,
        }));
        return {
          project_id: projectId,
          violations,
          total_violations: data.totalViolations ?? violations.length,
          error_count: data.errorCount ?? violations.filter((v) => v.severity === 'error').length,
          warning_count:
            data.warningCount ?? violations.filter((v) => v.severity === 'warning').length,
          passed: (data.errorCount ?? 0) === 0,
        };
      } catch (err) {
        return {
          project_id: projectId,
          violations: [],
          total_violations: 0,
          error_count: 0,
          warning_count: 0,
          passed: false,
          not_available: true,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });

  registry.register({
    name: 'easyeda_rule_check_summary',
    title: 'Get rule check summary',
    description: 'Get a summary of all design and electrical rule check results for the project.',
    profile: 'core',
    evidence: ['official-docs'],
    risk: 'low',
    confirmWrite: false,
    group: 'drc-erc',
    version: '1.0.0',
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
    },
    inputSchema: z.object({
      projectId: z.string(),
    }),
    outputSchema: z.object({
      project_id: z.string(),
      drc: z.object({
        total: z.number().int().nonnegative(),
        errors: z.number().int().nonnegative(),
        warnings: z.number().int().nonnegative(),
        passed: z.boolean(),
      }),
      erc: z.object({
        total: z.number().int().nonnegative(),
        errors: z.number().int().nonnegative(),
        warnings: z.number().int().nonnegative(),
        passed: z.boolean(),
      }),
      overall_passed: z.boolean(),
      not_available: z.boolean().optional(),
    }),
    handler: async (ctx: ToolContext, params: unknown) => {
      const { projectId } = params as { projectId: string };
      try {
        const [drcResult, ercResult] = await Promise.all([
          ctx.bridge.call('design.drc', { projectId }),
          ctx.bridge.call('design.erc', { projectId }),
        ]);
        const drc = drcResult as {
          totalViolations?: number;
          errorCount?: number;
          warningCount?: number;
        };
        const erc = ercResult as {
          totalViolations?: number;
          errorCount?: number;
          warningCount?: number;
        };
        const drcErrors = drc.errorCount ?? 0;
        const drcWarnings = drc.warningCount ?? 0;
        const ercErrors = erc.errorCount ?? 0;
        const ercWarnings = erc.warningCount ?? 0;
        return {
          project_id: projectId,
          drc: {
            total: drc.totalViolations ?? drcErrors + drcWarnings,
            errors: drcErrors,
            warnings: drcWarnings,
            passed: drcErrors === 0,
          },
          erc: {
            total: erc.totalViolations ?? ercErrors + ercWarnings,
            errors: ercErrors,
            warnings: ercWarnings,
            passed: ercErrors === 0,
          },
          overall_passed: drcErrors === 0 && ercErrors === 0,
        };
      } catch (err) {
        return {
          project_id: projectId,
          drc: { total: 0, errors: 0, warnings: 0, passed: false },
          erc: { total: 0, errors: 0, warnings: 0, passed: false },
          overall_passed: false,
          not_available: true,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  });
}

export { registerDrcErcTools };
