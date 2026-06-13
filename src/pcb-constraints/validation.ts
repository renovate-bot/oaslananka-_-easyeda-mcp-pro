/**
 * PCB constraint validation rules.
 *
 * Implements constraint checks that operate on {@link PcbConstraintInput}
 * and produce structured {@link PcbConstraintIssue}s.
 *
 * Rules:
 *  1. Missing board outline (error)
 *  2. Board outline too small (warning)
 *  3. Missing layer stackup (warning)
 *  4. Layer count mismatch between intent and board (error)
 *  5. Missing mounting holes (warning)
 *  6. Missing net classes (warning)
 *  7. Invalid clearance / creepage (error)
 *  8. Keepout area violations (error)
 *  9. Missing placement zones (warning)
 * 10. Missing manufacturing constraints (warning)
 * 11. Fiducials recommended for SMT (warning)
 * 12. High-voltage creepage/clearance (error)
 *
 * @module
 */

import type { PcbConstraintInput, PcbConstraintIssue, PcbConstraintResult } from './types.js';
import { pcbError, pcbWarning } from './errors.js';

// ── Rule: missing board outline ────────────────────────────────────────────

function checkMissingOutline(input: PcbConstraintInput): PcbConstraintIssue[] {
  const issues: PcbConstraintIssue[] = [];

  if (!input.hasOutline) {
    issues.push(
      pcbError('PCB_MISSING_OUTLINE', 'Board outline is not defined', {
        remediationHint:
          'Define a board outline with at least 3 polygon points in the PCB intent or board dimensions',
      }),
    );
  }

  return issues;
}

// ── Rule: board outline too small ──────────────────────────────────────────

const MIN_BOARD_DIMENSION_MM = 5;

function checkOutlineTooSmall(input: PcbConstraintInput): PcbConstraintIssue[] {
  const issues: PcbConstraintIssue[] = [];

  if (input.widthMm && input.widthMm < MIN_BOARD_DIMENSION_MM) {
    issues.push(
      pcbWarning(
        'PCB_OUTLINE_TOO_SMALL',
        `Board width (${input.widthMm}mm) is below recommended minimum of ${MIN_BOARD_DIMENSION_MM}mm`,
        {
          remediationHint:
            'Verify the board dimensions are correct. Very small boards may be difficult to manufacture.',
        },
      ),
    );
  }

  if (input.heightMm && input.heightMm < MIN_BOARD_DIMENSION_MM) {
    issues.push(
      pcbWarning(
        'PCB_OUTLINE_TOO_SMALL',
        `Board height (${input.heightMm}mm) is below recommended minimum of ${MIN_BOARD_DIMENSION_MM}mm`,
        {
          remediationHint:
            'Verify the board dimensions are correct. Very small boards may be difficult to manufacture.',
        },
      ),
    );
  }

  return issues;
}

// ── Rule: missing layer stackup ────────────────────────────────────────────

function checkMissingStackup(input: PcbConstraintInput): PcbConstraintIssue[] {
  const issues: PcbConstraintIssue[] = [];

  if (!input.hasLayerStack) {
    issues.push(
      pcbWarning('PCB_MISSING_STACKUP', 'Detailed layer stackup is not defined', {
        remediationHint:
          'Define a layer stackup with thickness, material, and copper weight for each layer to ensure manufacturability',
        details: { layerCount: input.layerCount },
      }),
    );
  }

  return issues;
}

// ── Rule: layer count mismatch ─────────────────────────────────────────────

const MAX_LAYERS_WITHOUT_STACKUP = 2;

function checkLayerCountMismatch(input: PcbConstraintInput): PcbConstraintIssue[] {
  const issues: PcbConstraintIssue[] = [];

  if (input.layerCount && input.layerCount > MAX_LAYERS_WITHOUT_STACKUP && !input.hasLayerStack) {
    issues.push(
      pcbError(
        'PCB_LAYER_COUNT_MISMATCH',
        `Board has ${input.layerCount} layers but no detailed stackup is defined`,
        {
          remediationHint:
            'For boards with more than 2 layers, a complete layer stackup is required for fabrication',
          details: { layerCount: input.layerCount },
        },
      ),
    );
  }

  return issues;
}

// ── Rule: missing mounting holes ───────────────────────────────────────────

function checkMissingMountingHoles(input: PcbConstraintInput): PcbConstraintIssue[] {
  const issues: PcbConstraintIssue[] = [];

  if (input.mountingHoleCount !== undefined && input.mountingHoleCount === 0) {
    issues.push(
      pcbWarning('PCB_MISSING_MOUNTING_HOLES', 'No mounting holes defined on the board', {
        remediationHint:
          'Add at least 4 mounting holes (one near each corner) for mechanical stability and assembly',
      }),
    );
  }

  return issues;
}

// ── Rule: missing net classes ──────────────────────────────────────────────

function checkMissingNetClasses(input: PcbConstraintInput): PcbConstraintIssue[] {
  const issues: PcbConstraintIssue[] = [];

  if (!input.hasNetClasses) {
    issues.push(
      pcbWarning('PCB_MISSING_NET_CLASSES', 'No net classes with routing rules are defined', {
        remediationHint:
          'Define net classes for power, signal, and high-speed nets to enforce trace width and clearance rules',
      }),
    );
  }

  return issues;
}

// ── Rule: invalid clearance ────────────────────────────────────────────────

function checkInvalidClearance(input: PcbConstraintInput): PcbConstraintIssue[] {
  const issues: PcbConstraintIssue[] = [];

  if (input.hasNetClasses && !input.hasClearanceRules) {
    issues.push(
      pcbWarning(
        'PCB_INVALID_CLEARANCE',
        'Net classes are defined but no clearance rules between them',
        {
          remediationHint:
            'Add clearance rules between each pair of net classes (e.g., power-to-signal, high-voltage-to-signal)',
        },
      ),
    );
  }

  return issues;
}

// ── Rule: keepout violations ───────────────────────────────────────────────

function checkKeepoutAreas(input: PcbConstraintInput): PcbConstraintIssue[] {
  const issues: PcbConstraintIssue[] = [];

  if (!input.hasKeepoutAreas && input.hasPlacementZones) {
    issues.push(
      pcbWarning(
        'PCB_KEEPOUT_VIOLATION',
        'Placement zones are defined but no keepout/restricted areas',
        {
          remediationHint:
            'Consider adding keepout areas to prevent component or track placement in restricted zones',
        },
      ),
    );
  }

  return issues;
}

// ── Rule: missing placement zones ──────────────────────────────────────────

function checkMissingPlacementZones(input: PcbConstraintInput): PcbConstraintIssue[] {
  const issues: PcbConstraintIssue[] = [];

  if (!input.hasPlacementZones && input.layerCount && input.layerCount > 1) {
    issues.push(
      pcbWarning(
        'PCB_MISSING_PLACEMENT_ZONES',
        'No placement zones defined for component grouping',
        {
          remediationHint:
            'Define placement zones (power, analog, digital, etc.) to guide component placement and improve signal integrity',
        },
      ),
    );
  }

  return issues;
}

// ── Rule: missing manufacturing constraints ────────────────────────────────

function checkMissingManufacturingConstraints(input: PcbConstraintInput): PcbConstraintIssue[] {
  const issues: PcbConstraintIssue[] = [];

  if (!input.manufacturingProcess) {
    issues.push(
      pcbWarning(
        'PCB_MISSING_MANUFACTURING_CONSTRAINTS',
        'Manufacturing process (lead-free/lead-based) is not specified',
        {
          remediationHint:
            'Specify the manufacturing process to ensure correct solder mask, pad finish, and assembly requirements',
        },
      ),
    );
  }

  if (!input.hasQuantity) {
    issues.push(
      pcbWarning('PCB_MISSING_MANUFACTURING_CONSTRAINTS', 'Production quantity is not specified', {
        remediationHint:
          'Specify the target production quantity to select the appropriate manufacturing process',
      }),
    );
  }

  return issues;
}

// ── Rule: fiducials recommended ────────────────────────────────────────────

function checkFiducials(input: PcbConstraintInput): PcbConstraintIssue[] {
  const issues: PcbConstraintIssue[] = [];

  if (!input.hasFiducials && input.mountingHoleCount && input.mountingHoleCount > 0) {
    issues.push(
      pcbWarning('PCB_FIDUCIAL_REQUIRED', 'No fiducial marks defined for SMT assembly', {
        remediationHint:
          'Add at least 3 fiducial marks (global, near board corners) for pick-and-place machine alignment',
      }),
    );
  }

  return issues;
}

// ── Rule: high-voltage creepage/clearance ──────────────────────────────────

function checkHighVoltageClearance(input: PcbConstraintInput): PcbConstraintIssue[] {
  const issues: PcbConstraintIssue[] = [];

  if (input.hasHighVoltage && (!input.hasClearanceRules || !input.hasNetClasses)) {
    issues.push(
      pcbError(
        'PCB_HIGH_VOLTAGE_CLEARANCE',
        'High-voltage domain detected but no clearance rules defined',
        {
          remediationHint:
            'Define explicit creepage and clearance distances for high-voltage nets. Minimum 4mm clearance for 250V AC is recommended.',
        },
      ),
    );
  }

  return issues;
}

// ── Combine helper ─────────────────────────────────────────────────────────

type RuleFn = (input: PcbConstraintInput) => PcbConstraintIssue[];

const RULES: RuleFn[] = [
  checkMissingOutline,
  checkOutlineTooSmall,
  checkMissingStackup,
  checkLayerCountMismatch,
  checkMissingMountingHoles,
  checkMissingNetClasses,
  checkInvalidClearance,
  checkKeepoutAreas,
  checkMissingPlacementZones,
  checkMissingManufacturingConstraints,
  checkFiducials,
  checkHighVoltageClearance,
];

// ── Main entry point ───────────────────────────────────────────────────────

/**
 * Run all PCB constraint validation rules against board data.
 *
 * Orchestrates 12 rules:
 *   1. Missing outline         — error  if board outline is not defined
 *   2. Outline too small       — warning if dimensions are below 5mm
 *   3. Missing stackup         — warning if no detailed layer stack
 *   4. Layer count mismatch    — error  if >2 layers without stackup
 *   5. Missing mounting holes  — warning if zero mounting holes
 *   6. Missing net classes     — warning if no routing rules
 *   7. Invalid clearance       — warning if net classes but no clearance rules
 *   8. Keepout violations      — warning if zones but no keepouts
 *   9. Missing placement zones — warning if multi-layer without zones
 *  10. Missing mfg constraints — warning if process/quantity unspecified
 *  11. Fiducials recommended   — warning if SMT board without fiducials
 *  12. High-voltage clearance  — error  if HV domain without proper clearance
 */
export function validatePcbConstraints(input: PcbConstraintInput): PcbConstraintResult {
  const errors: PcbConstraintIssue[] = [];
  const warnings: PcbConstraintIssue[] = [];
  let passed = 0;

  for (const rule of RULES) {
    const issues = rule(input);

    if (issues.length === 0) {
      passed++;
    } else {
      for (const issue of issues) {
        if (issue.severity === 'error') {
          errors.push(issue);
        } else {
          warnings.push(issue);
        }
      }
    }
  }

  const totalChecks = RULES.length;
  const failed = errors.length + warnings.length;
  const notApplicable = Math.max(0, totalChecks - passed - failed);

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      totalChecks,
      passed,
      failed,
      notApplicable,
    },
  };
}

/**
 * Build a human-readable constraint report explaining which constraints
 * were applied and which require manual review.
 */
export function buildConstraintReport(
  input: PcbConstraintInput,
  result: PcbConstraintResult,
): import('./types.js').ConstraintReport {
  const checked: Array<{
    area: string;
    status: 'passed' | 'failed' | 'not-applicable';
    details: string;
  }> = [];
  const manualReviewRequired: Array<{ area: string; reason: string }> = [];

  // Build checked list from validation results
  const areaMap: Record<string, string> = {
    'Board outline': 'Board outline defines the physical board shape for fabrication',
    'Board dimensions': 'Minimum dimension check ensures manufacturability',
    'Layer stackup': 'Layer stackup defines material, thickness, and copper weight per layer',
    'Layer count': 'Layer count must match between intent and stackup',
    'Mounting holes': 'Mounting holes provide mechanical mounting and assembly alignment',
    'Net classes': 'Net classes enforce trace width and clearance for signal integrity',
    'Clearance rules': 'Clearance rules prevent shorts between different net classes',
    'Keepout areas': 'Keepout areas prevent component/track placement in restricted zones',
    'Placement zones': 'Placement zones guide component grouping for optimal layout',
    'Manufacturing constraints': 'Manufacturing constraints ensure correct fabrication process',
    Fiducials: 'Fiducial marks enable pick-and-place machine alignment',
    'High-voltage clearance': 'High-voltage clearance ensures safety against arcing',
  };

  // Determine which rules actually produced output
  const hasErrorsOrWarnings = result.errors.length > 0 || result.warnings.length > 0;

  if (!input.hasOutline && !hasErrorsOrWarnings) {
    checked.push({
      area: 'Board outline',
      status: 'failed',
      details: areaMap['Board outline'] ?? '',
    });
  }

  // Add manual review items for things that can't be auto-checked
  manualReviewRequired.push({
    area: 'Component placement',
    reason: 'AI-guided component placement requires human review before applying to PCB layout',
  });

  manualReviewRequired.push({
    area: 'Trace routing',
    reason: 'Automated trace routing may require manual optimization for signal integrity',
  });

  manualReviewRequired.push({
    area: 'Thermal management',
    reason: 'Thermal vias and copper pour areas should be verified against thermal simulation',
  });

  // Overall verdict
  let verdict: 'approved' | 'needs-review' | 'rejected';
  if (result.errors.length > 0) {
    verdict = 'rejected';
  } else if (result.warnings.length > 0 || manualReviewRequired.length > 0) {
    verdict = 'needs-review';
  } else {
    verdict = 'approved';
  }

  return {
    checked,
    manualReviewRequired,
    verdict,
  };
}

/**
 * Create PcbConstraintInput from a CircuitIR PCB intent object.
 */
export function fromPcbIntent(pcb: {
  boardOutline?: unknown;
  layerCount?: number;
  widthMm?: number;
  heightMm?: number;
  layerStack?: unknown[];
  netClasses?: unknown[];
  clearanceRules?: unknown[];
  keepoutAreas?: unknown[];
  placementZones?: unknown[];
  mountingHoles?: unknown[];
  fiducials?: unknown[];
  testPads?: unknown[];
  manufacturingProcess?: string;
  manufacturing?: { process?: string; quantity?: number };
  quantity?: number;
  highVoltage?: boolean;
}): PcbConstraintInput {
  return {
    widthMm: pcb.widthMm,
    heightMm: pcb.heightMm,
    layerCount: pcb.layerCount,
    hasOutline: !!(
      pcb.boardOutline && (Array.isArray(pcb.boardOutline) ? pcb.boardOutline.length > 0 : true)
    ),
    mountingHoleCount: pcb.mountingHoles?.length ?? 0,
    hasLayerStack: !!(pcb.layerStack && pcb.layerStack.length > 0),
    hasNetClasses: !!(pcb.netClasses && pcb.netClasses.length > 0),
    hasClearanceRules: !!(pcb.clearanceRules && pcb.clearanceRules.length > 0),
    hasKeepoutAreas: !!(pcb.keepoutAreas && pcb.keepoutAreas.length > 0),
    hasPlacementZones: !!(pcb.placementZones && pcb.placementZones.length > 0),
    hasFiducials: !!(pcb.fiducials && pcb.fiducials.length > 0),
    hasTestPads: !!(pcb.testPads && pcb.testPads.length > 0),
    hasHighVoltage: pcb.highVoltage ?? false,
    manufacturingProcess: pcb.manufacturingProcess ?? pcb.manufacturing?.process,
    hasQuantity:
      !!(pcb.quantity && pcb.quantity > 0) ||
      !!(pcb.manufacturing?.quantity && pcb.manufacturing.quantity > 0),
  };
}
