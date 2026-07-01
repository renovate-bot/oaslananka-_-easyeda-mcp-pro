import { z } from 'zod';
import { type ToolDefinition, type ToolContext } from './types.js';
import { type EnvConfig } from '../config/env.js';
import { validateNets } from '../net-validation/validation.js';

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

  const semanticPinSchema = z.object({
    pin: z.string(),
    name: z.string().optional(),
    electricalType: z.enum([
      'input',
      'output',
      'bidirectional',
      'passive',
      'power_input',
      'power_output',
      'power_source',
      'open_drain',
      'tri_state',
      'no_connect',
    ]),
    required: z.boolean().optional(),
    expectedNetType: z.enum(['power', 'signal', 'ground']).optional(),
    expectedVoltage: z.number().optional(),
    noConnectAllowed: z.boolean().optional(),
  });

  const semanticNodeSchema = z.object({
    deviceRef: z.string(),
    pin: z.string(),
    electricalType: semanticPinSchema.shape.electricalType.optional(),
    pinName: z.string().optional(),
    expectedVoltage: z.number().optional(),
  });

  const semanticNetSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['power', 'signal', 'ground']),
    voltage: z.number().optional(),
    nodes: z.array(semanticNodeSchema),
  });

  const semanticDeviceSchema = z.object({
    id: z.string(),
    ref: z.string(),
    category: z.string().optional(),
    pins: z.array(semanticPinSchema).optional(),
    requiresDecoupling: z.boolean().optional(),
  });

  const semanticInterfaceSchema = z.object({
    id: z.string(),
    name: z.string(),
    pinout: z.array(
      z.object({
        pin: z.string(),
        signal: z.string(),
        type: z.string().optional(),
      }),
    ),
  });

  const semanticIssueSchema = z.object({
    code: z.string(),
    message: z.string(),
    severity: z.enum(['error', 'warning']),
    path: z.string().optional(),
    net_name: z.string().optional(),
    component_ref: z.string().optional(),
    pin: z.string().optional(),
    remediation_hint: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  });

  registry.register({
    name: 'easyeda_semantic_erc_validate',
    title: 'Run semantic ERC validation',
    description:
      'Run semantic electrical-rule validation over a netlist with pin electrical types to detect output contention, floating inputs, power conflicts, missing power pins, missing decoupling, and voltage-domain mismatches.',
    profile: 'core',
    evidence: ['official-docs'],
    risk: 'medium',
    confirmWrite: false,
    group: 'drc-erc',
    version: '1.0.0',
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
    },
    inputSchema: z.object({
      projectId: z.string().optional(),
      nets: z.array(semanticNetSchema),
      devices: z.array(semanticDeviceSchema).optional(),
      interfaces: z.array(semanticInterfaceSchema).optional(),
    }),
    outputSchema: z.object({
      project_id: z.string(),
      passed: z.boolean(),
      error_count: z.number().int().nonnegative(),
      warning_count: z.number().int().nonnegative(),
      total_issues: z.number().int().nonnegative(),
      errors: z.array(semanticIssueSchema),
      warnings: z.array(semanticIssueSchema),
    }),
    handler: async (_ctx: ToolContext, params: unknown) => {
      const parsed = params as {
        projectId?: string;
        nets: Array<{
          id: string;
          name: string;
          type: 'power' | 'signal' | 'ground';
          voltage?: number;
          nodes: Array<{
            deviceRef: string;
            pin: string;
            electricalType?:
              | 'input'
              | 'output'
              | 'bidirectional'
              | 'passive'
              | 'power_input'
              | 'power_output'
              | 'power_source'
              | 'open_drain'
              | 'tri_state'
              | 'no_connect';
            pinName?: string;
            expectedVoltage?: number;
          }>;
        }>;
        devices?: Array<{
          id: string;
          ref: string;
          category?: string;
          pins?: Array<{
            pin: string;
            name?: string;
            electricalType:
              | 'input'
              | 'output'
              | 'bidirectional'
              | 'passive'
              | 'power_input'
              | 'power_output'
              | 'power_source'
              | 'open_drain'
              | 'tri_state'
              | 'no_connect';
            required?: boolean;
            expectedNetType?: 'power' | 'signal' | 'ground';
            expectedVoltage?: number;
            noConnectAllowed?: boolean;
          }>;
          requiresDecoupling?: boolean;
        }>;
        interfaces?: Array<{
          id: string;
          name: string;
          pinout: Array<{ pin: string; signal: string; type?: string }>;
        }>;
      };

      const result = validateNets({
        nets: parsed.nets,
        devices: parsed.devices,
        interfaces: parsed.interfaces,
      });

      const mapIssue = (issue: (typeof result.errors)[number]) => ({
        code: issue.code,
        message: issue.message,
        severity: issue.severity,
        path: issue.path,
        net_name: issue.netName,
        component_ref: issue.componentRef,
        pin: issue.pin,
        remediation_hint: issue.remediationHint,
        details: issue.details,
      });

      const errors = result.errors.map(mapIssue);
      const warnings = result.warnings.map(mapIssue);

      return {
        project_id: parsed.projectId ?? '',
        passed: result.valid,
        error_count: errors.length,
        warning_count: warnings.length,
        total_issues: errors.length + warnings.length,
        errors,
        warnings,
      };
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
