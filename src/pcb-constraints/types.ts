/**
 * PCB constraints — types for constraint validation output.
 *
 * @module
 */

import type { ConstraintSeverity } from '../circuit/types.js';

// ── Constraint issue codes ─────────────────────────────────────────────────

/** Machine-readable code identifying a PCB constraint check. */
export type PcbConstraintCode =
  | 'PCB_MISSING_OUTLINE'
  | 'PCB_OUTLINE_TOO_SMALL'
  | 'PCB_MISSING_STACKUP'
  | 'PCB_LAYER_COUNT_MISMATCH'
  | 'PCB_MISSING_MOUNTING_HOLES'
  | 'PCB_MISSING_NET_CLASSES'
  | 'PCB_INVALID_CLEARANCE'
  | 'PCB_KEEPOUT_VIOLATION'
  | 'PCB_MISSING_PLACEMENT_ZONES'
  | 'PCB_MISSING_MANUFACTURING_CONSTRAINTS'
  | 'PCB_FIDUCIAL_REQUIRED'
  | 'PCB_HIGH_VOLTAGE_CLEARANCE'
  | 'PCB_CONSTRAINT_INTERNAL';

// ── Constraint issue ───────────────────────────────────────────────────────

/**
 * A single PCB constraint issue (error or warning).
 *
 * Mirrors the pattern from net-validation/errors.ts.
 */
export interface PcbConstraintIssue {
  /** Machine-readable code. */
  code: PcbConstraintCode;
  /** Human-readable description. */
  message: string;
  /** Dot-notation path to the offending field. */
  path?: string;
  /** Whether this blocks validation or is advisory. */
  severity: 'error' | 'warning';
  /** The constraint type from CircuitIR (electrical, mechanical, pcb-layout, etc.). */
  constraintType?: string;
  /** The severity level from CircuitIR (required, recommended, informational). */
  constraintSeverity?: ConstraintSeverity;
  /** Actionable hint for the user. */
  remediationHint: string;
  /** Additional context. */
  details?: Record<string, unknown>;
}

// ── Validation result ──────────────────────────────────────────────────────

export interface PcbConstraintResult {
  /** True when there are zero errors (warnings are allowed). */
  valid: boolean;
  /** Issues that block validation. */
  errors: PcbConstraintIssue[];
  /** Advisory issues. */
  warnings: PcbConstraintIssue[];
  /** Summary of how many constraints were checked. */
  summary: {
    totalChecks: number;
    passed: number;
    failed: number;
    notApplicable: number;
  };
}

// ── Input for PCB constraint checks ────────────────────────────────────────

/**
 * Input contract for PCB constraint validation.
 *
 * Designed to be created from a CircuitIR or directly from board inspection
 * data (easyeda_board_layers, easyeda_board_dimensions, etc.).
 */
export interface PcbConstraintInput {
  /** Board dimensions in mm. */
  widthMm?: number;
  heightMm?: number;
  /** Number of copper layers. */
  layerCount?: number;
  /** Whether the board outline is defined. */
  hasOutline?: boolean;
  /** Whether mounting holes are present. */
  mountingHoleCount?: number;
  /** Whether a detailed layer stackup is defined. */
  hasLayerStack?: boolean;
  /** Whether net classes with routing rules are defined. */
  hasNetClasses?: boolean;
  /** Whether clearance rules are defined. */
  hasClearanceRules?: boolean;
  /** Whether keepout areas are defined. */
  hasKeepoutAreas?: boolean;
  /** Whether placement zones are defined. */
  hasPlacementZones?: boolean;
  /** Whether fiducials are defined. */
  hasFiducials?: boolean;
  /** Whether test pads are defined. */
  hasTestPads?: boolean;
  /** Whether the design contains high-voltage domains. */
  hasHighVoltage?: boolean;
  /** Manufacturing process (lead-free, lead-based, mixed). */
  manufacturingProcess?: string;
  /** Whether a quantity is specified. */
  hasQuantity?: boolean;
}

// ── Constraint report ──────────────────────────────────────────────────────

/**
 * A human-readable explanation of which constraints were applied and
 * which remain manual/unchecked.
 */
export interface ConstraintReport {
  /** Constraint areas that were checked. */
  checked: Array<{
    area: string;
    status: 'passed' | 'failed' | 'not-applicable';
    details: string;
  }>;
  /** Constraints that cannot be verified automatically (require human review). */
  manualReviewRequired: Array<{
    area: string;
    reason: string;
  }>;
  /** Overall verdict. */
  verdict: 'approved' | 'needs-review' | 'rejected';
}
