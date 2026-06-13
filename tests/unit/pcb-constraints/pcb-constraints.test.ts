/**
 * PCB constraints — unit tests.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import {
  validatePcbConstraints,
  buildConstraintReport,
  fromPcbIntent,
} from '../../../src/pcb-constraints/index.js';
import { PcbConstraintCodeMap } from '../../../src/pcb-constraints/errors.js';
import type { PcbConstraintInput } from '../../../src/pcb-constraints/types.js';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeInput(overrides: Partial<PcbConstraintInput> = {}): PcbConstraintInput {
  return {
    widthMm: 60,
    heightMm: 40,
    layerCount: 2,
    hasOutline: true,
    mountingHoleCount: 4,
    hasLayerStack: true,
    hasNetClasses: true,
    hasClearanceRules: true,
    hasKeepoutAreas: true,
    hasPlacementZones: true,
    hasFiducials: true,
    hasTestPads: true,
    hasHighVoltage: false,
    manufacturingProcess: 'standard',
    hasQuantity: true,
    ...overrides,
  };
}

// ── Validation result shape ────────────────────────────────────────────────

describe('validatePcbConstraints', () => {
  it('returns valid=true for a complete board design', () => {
    const result = validatePcbConstraints(makeInput());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid=false when board outline is missing', () => {
    const result = validatePcbConstraints(makeInput({ hasOutline: false }));
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0].code).toBe(PcbConstraintCodeMap.MISSING_BOARD_OUTLINE.code);
  });

  it('returns valid=false when layer count exceeds 2 without stackup', () => {
    const result = validatePcbConstraints(makeInput({ layerCount: 4, hasLayerStack: false }));
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0].code).toBe(PcbConstraintCodeMap.LAYER_COUNT_MISMATCH.code);
  });

  it('returns valid=true with only missing stackup warning for 2-layer board', () => {
    const result = validatePcbConstraints(makeInput({ hasLayerStack: false, layerCount: 2 }));
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(
      result.warnings.find((w) => w.code === PcbConstraintCodeMap.NO_LAYER_STACK.code),
    ).toBeDefined();
  });

  it('returns valid=false with high voltage but no clearance rules', () => {
    const result = validatePcbConstraints(
      makeInput({ hasHighVoltage: true, hasClearanceRules: false }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0].code).toBe(PcbConstraintCodeMap.HIGH_VOLTAGE_CLEARANCE.code);
  });

  it('returns valid=true with high voltage and clearance rules', () => {
    const result = validatePcbConstraints(
      makeInput({ hasHighVoltage: true, hasClearanceRules: true }),
    );
    expect(result.valid).toBe(true);
  });
});

// ── Structural errors ──────────────────────────────────────────────────────

describe('structural errors', () => {
  it('rejects missing board outline', () => {
    const result = validatePcbConstraints(makeInput({ hasOutline: false }));
    const err = result.errors.find(
      (e) => e.code === PcbConstraintCodeMap.MISSING_BOARD_OUTLINE.code,
    );
    expect(err).toBeDefined();
    expect(err!.severity).toBe('error');
    expect(err!.remediationHint).toBeTruthy();
  });

  it('rejects mismatched layer count', () => {
    const result = validatePcbConstraints(makeInput({ layerCount: 4, hasLayerStack: false }));
    const err = result.errors.find(
      (e) => e.code === PcbConstraintCodeMap.LAYER_COUNT_MISMATCH.code,
    );
    expect(err).toBeDefined();
    expect(err!.severity).toBe('error');
  });

  it('rejects high-voltage without clearance rules', () => {
    const result = validatePcbConstraints(
      makeInput({ hasHighVoltage: true, hasClearanceRules: false }),
    );
    const err = result.errors.find(
      (e) => e.code === PcbConstraintCodeMap.HIGH_VOLTAGE_CLEARANCE.code,
    );
    expect(err).toBeDefined();
    expect(err!.severity).toBe('error');
  });
});

// ── Warnings ───────────────────────────────────────────────────────────────

describe('warnings', () => {
  it('warns when no net classes defined', () => {
    const result = validatePcbConstraints(makeInput({ hasNetClasses: false }));
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    const warn = result.warnings.find((w) => w.code === PcbConstraintCodeMap.NO_NET_CLASSES.code);
    expect(warn).toBeDefined();
    expect(warn!.severity).toBe('warning');
  });

  it('warns when no clearance rules defined', () => {
    const result = validatePcbConstraints(makeInput({ hasClearanceRules: false }));
    const warn = result.warnings.find(
      (w) => w.code === PcbConstraintCodeMap.NO_CLEARANCE_RULES.code,
    );
    expect(warn).toBeDefined();
  });

  it('warns when no keepout areas defined', () => {
    const result = validatePcbConstraints(makeInput({ hasKeepoutAreas: false }));
    const warn = result.warnings.find((w) => w.code === PcbConstraintCodeMap.NO_KEEPOUT_AREAS.code);
    expect(warn).toBeDefined();
  });

  it('warns when no placement zones defined', () => {
    const result = validatePcbConstraints(makeInput({ hasPlacementZones: false }));
    const warn = result.warnings.find(
      (w) => w.code === PcbConstraintCodeMap.NO_PLACEMENT_ZONES.code,
    );
    expect(warn).toBeDefined();
  });

  it('warns when no fiducials', () => {
    const result = validatePcbConstraints(makeInput({ hasFiducials: false }));
    const warn = result.warnings.find((w) => w.code === PcbConstraintCodeMap.NO_FIDUCIALS.code);
    expect(warn).toBeDefined();
  });

  it('warns when no mounting holes', () => {
    const result = validatePcbConstraints(makeInput({ mountingHoleCount: 0 }));
    const warn = result.warnings.find(
      (w) => w.code === PcbConstraintCodeMap.NO_MOUNTING_HOLES.code,
    );
    expect(warn).toBeDefined();
  });

  it('warns when no layer stack defined', () => {
    const result = validatePcbConstraints(makeInput({ hasLayerStack: false, layerCount: 2 }));
    const warn = result.warnings.find((w) => w.code === PcbConstraintCodeMap.NO_LAYER_STACK.code);
    expect(warn).toBeDefined();
  });

  it('warns when manufacturing process is unspecified', () => {
    const result = validatePcbConstraints(makeInput({ manufacturingProcess: undefined }));
    const warn = result.warnings.find(
      (w) => w.code === PcbConstraintCodeMap.MANUFACTURING_OPTIONS_WARNING.code,
    );
    expect(warn).toBeDefined();
  });
});

// ── Summary ────────────────────────────────────────────────────────────────

describe('validation summary', () => {
  it('counts total checks', () => {
    const result = validatePcbConstraints(
      makeInput({ hasOutline: false, hasLayerStack: false, layerCount: 0 }),
    );
    expect(result.summary.totalChecks).toBeGreaterThan(0);
    expect(result.summary.passed + result.summary.failed + result.summary.notApplicable).toBe(
      result.summary.totalChecks,
    );
  });

  it('shows passed > 0 for a complete design', () => {
    const result = validatePcbConstraints(makeInput());
    expect(result.summary.passed).toBeGreaterThan(0);
    expect(result.summary.failed).toBe(0);
  });

  it('shows failed > 0 for a broken design', () => {
    const result = validatePcbConstraints(makeInput({ hasOutline: false }));
    expect(result.summary.failed).toBeGreaterThan(0);
  });
});

// ── buildConstraintReport ──────────────────────────────────────────────────

describe('buildConstraintReport', () => {
  it('returns needs-review verdict for a complete design due to manual review items', () => {
    const input = makeInput();
    const result = validatePcbConstraints(input);
    const report = buildConstraintReport(input, result);
    expect(report.verdict).toBe('needs-review');
    expect(report.manualReviewRequired.length).toBeGreaterThan(0);
  });

  it('returns rejected verdict when errors exist', () => {
    const input = makeInput({ hasOutline: false });
    const result = validatePcbConstraints(input);
    const report = buildConstraintReport(input, result);
    expect(report.verdict).toBe('rejected');
  });

  it('returns needs-review verdict when only warnings exist', () => {
    const input = makeInput({ hasNetClasses: false, hasClearanceRules: false });
    const result = validatePcbConstraints(input);
    const report = buildConstraintReport(input, result);
    expect(report.verdict).toBe('needs-review');
  });

  it('includes manualReviewRequired items for warnings', () => {
    const input = makeInput({ hasPlacementZones: false, hasFiducials: false });
    const result = validatePcbConstraints(input);
    const report = buildConstraintReport(input, result);
    expect(report.manualReviewRequired.length).toBeGreaterThan(0);
    for (const item of report.manualReviewRequired) {
      expect(item.area).toBeTruthy();
      expect(item.reason).toBeTruthy();
    }
  });
});

// ── fromPcbIntent ──────────────────────────────────────────────────────────

describe('fromPcbIntent', () => {
  it('converts a minimal PcbIntent to PcbConstraintInput', () => {
    const intent = {
      boardOutline: undefined,
      layerStack: undefined,
      netClasses: undefined,
      clearanceRules: undefined,
      keepoutAreas: undefined,
      placementZones: undefined,
      mountingHoles: undefined,
      fiducials: undefined,
      testPads: undefined,
      manufacturingProcess: undefined,
      quantity: undefined,
      highVoltage: undefined,
    };
    const input = fromPcbIntent(intent);
    expect(input.hasOutline).toBe(false);
    expect(input.hasLayerStack).toBe(false);
    expect(input.mountingHoleCount).toBe(0);
    expect(input.hasHighVoltage).toBe(false);
  });

  it('converts a populated PcbIntent correctly', () => {
    const intent = {
      boardOutline: [{ x: 0, y: 0 }] as unknown as undefined,
      layerStack: [
        {
          name: 'F.Cu',
          type: 'copper' as const,
          thicknessUm: 35,
          material: 'copper' as const,
        },
      ],
      netClasses: [{ name: 'POWER', traceWidthUm: 500, clearanceUm: 200 }],
      clearanceRules: [{ netClassA: 'POWER', netClassB: 'SIGNAL', clearanceUm: 500 }],
      keepoutAreas: [{ x: 0, y: 0, widthMm: 10, heightMm: 10 }],
      placementZones: [
        { x: 0, y: 0, widthMm: 20, heightMm: 20, side: 'top', zoneType: 'component_keepout' },
      ],
      mountingHoles: [{ x: 5, y: 5, diameterMm: 3.2, type: 'm3_screw' }],
      fiducials: [{ x: 1, y: 1 }],
      testPads: [{ x: 10, y: 10, netName: 'GND' }],
      manufacturingProcess: 'standard',
      quantity: 100,
      highVoltage: false,
    };
    const input = fromPcbIntent(intent as Parameters<typeof fromPcbIntent>[0]);
    expect(input.hasOutline).toBe(true);
    expect(input.hasLayerStack).toBe(true);
    expect(input.hasNetClasses).toBe(true);
    expect(input.hasClearanceRules).toBe(true);
    expect(input.hasKeepoutAreas).toBe(true);
    expect(input.hasPlacementZones).toBe(true);
    expect(input.mountingHoleCount).toBe(1);
    expect(input.hasFiducials).toBe(true);
    expect(input.hasTestPads).toBe(true);
    expect(input.manufacturingProcess).toBe('standard');
    expect(input.hasQuantity).toBe(true);
    expect(input.hasHighVoltage).toBe(false);
  });

  it('converts highVoltage flag', () => {
    const input = fromPcbIntent({ highVoltage: true } as Parameters<typeof fromPcbIntent>[0]);
    expect(input.hasHighVoltage).toBe(true);
  });
});

// ── Error code map ─────────────────────────────────────────────────────────

describe('PcbConstraintCodeMap', () => {
  it('has all required error entries', () => {
    const codes = [
      'MISSING_BOARD_OUTLINE',
      'LAYER_COUNT_MISMATCH',
      'HIGH_VOLTAGE_CLEARANCE',
      'NO_NET_CLASSES',
      'NO_CLEARANCE_RULES',
      'NO_KEEPOUT_AREAS',
      'NO_PLACEMENT_ZONES',
      'NO_FIDUCIALS',
      'NO_TEST_PADS',
      'NO_MOUNTING_HOLES',
      'NO_LAYER_STACK',
      'MANUFACTURING_OPTIONS_WARNING',
    ];
    for (const c of codes) {
      expect(PcbConstraintCodeMap[c as keyof typeof PcbConstraintCodeMap]).toBeDefined();
    }
  });

  it('each entry has code, message, severity, and remediationHint', () => {
    for (const key of Object.keys(PcbConstraintCodeMap)) {
      const entry = PcbConstraintCodeMap[key as keyof typeof PcbConstraintCodeMap];
      expect(typeof entry.code).toBe('string');
      expect(typeof entry.message).toBe('string');
      expect(typeof entry.severity).toBe('string');
      expect(typeof entry.remediationHint).toBe('string');
    }
  });
});

// ── fromPcbIntent edge cases ──────────────────────────────────────────────

describe('fromPcbIntent edge cases', () => {
  it('handles nullish mounting holes', () => {
    const input = fromPcbIntent({} as Parameters<typeof fromPcbIntent>[0]);
    expect(input.mountingHoleCount).toBe(0);
  });

  it('handles empty arrays', () => {
    const intent = {
      boardOutline: [],
      mountingHoles: [],
      layerStack: [],
      netClasses: [],
      clearanceRules: [],
      keepoutAreas: [],
      placementZones: [],
      fiducials: [],
      testPads: [],
    };
    const input = fromPcbIntent(intent as Parameters<typeof fromPcbIntent>[0]);
    expect(input.hasOutline).toBe(false);
    expect(input.mountingHoleCount).toBe(0);
    expect(input.hasLayerStack).toBe(false);
  });
});
