/**
 * Net validation — unit tests.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import { validateNets } from '../../../src/net-validation/validation.js';
import { NetValidationCode } from '../../../src/net-validation/errors.js';
import {
  VALID_INPUT,
  FLOATING_INPUT,
  DUPLICATE_NAME_INPUT,
  SHORT_INPUT,
  NO_POWER_INPUT,
  NO_GROUND_INPUT,
  MISSING_PORT_INPUT,
  UNCONNECTED_DEVICE_INPUT,
  CROSS_SHEET_INPUT,
  MISMATCHED_CROSS_SHEET_INPUT,
  BAD_POWER_NAME_INPUT,
  BAD_GROUND_NAME_INPUT,
  HV_GENERIC_NAME_INPUT,
  HV_MIXED_DOMAIN_INPUT,
} from '../../../src/net-validation/fixtures.js';

// ── Validation result shape ────────────────────────────────────────────────

describe('validateNets', () => {
  it('returns valid=true for a well-formed design', () => {
    const result = validateNets(VALID_INPUT);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns valid result with valid, errors, and warnings fields', () => {
    const result = validateNets(VALID_INPUT);
    expect(result).toHaveProperty('valid');
    expect(result).toHaveProperty('errors');
    expect(result).toHaveProperty('warnings');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});

// ── Structural errors ──────────────────────────────────────────────────────

describe('structural errors', () => {
  it('detects floating nets (zero nodes)', () => {
    const result = validateNets(FLOATING_INPUT);
    expect(result.valid).toBe(false);
    const floatingIssues = result.errors.filter((e) => e.code === NetValidationCode.NetFloating);
    expect(floatingIssues).toHaveLength(1);
    expect(floatingIssues[0].netName).toBe('FLOAT');
    expect(floatingIssues[0].remediationHint).toBeTruthy();
  });

  it('detects duplicate net names', () => {
    const result = validateNets(DUPLICATE_NAME_INPUT);
    expect(result.valid).toBe(false);
    const dupIssues = result.errors.filter((e) => e.code === NetValidationCode.NetDuplicateName);
    expect(dupIssues).toHaveLength(1);
    expect(dupIssues[0].netName).toBe('3V3');
  });

  it('detects accidental shorts (one pin on multiple nets)', () => {
    const result = validateNets(SHORT_INPUT);
    expect(result.valid).toBe(false);
    const shortIssues = result.errors.filter(
      (e) => e.code === NetValidationCode.NetAccidentalShort,
    );
    expect(shortIssues).toHaveLength(1);
    expect(shortIssues[0].componentRef).toBe('U1');
    expect(shortIssues[0].pin).toBe('1');
  });
});

// ── Missing topology ───────────────────────────────────────────────────────

describe('missing topology', () => {
  it('detects missing power net (no net with type=power)', () => {
    const result = validateNets(NO_POWER_INPUT);
    expect(result.valid).toBe(false);
    const powerIssues = result.errors.filter((e) => e.code === NetValidationCode.NetMissingPower);
    expect(powerIssues.length).toBeGreaterThanOrEqual(1);
    // Should have the "no power net found" error (not just the warning)
    const noPowerError = powerIssues.find((e) => e.message.includes('No power net found'));
    expect(noPowerError).toBeDefined();
  });

  it('detects missing ground net (no net with type=ground)', () => {
    const result = validateNets(NO_GROUND_INPUT);
    expect(result.valid).toBe(false);
    const groundIssues = result.errors.filter(
      (e) => e.code === NetValidationCode.NetMissingGround,
    );
    expect(groundIssues.length).toBeGreaterThanOrEqual(1);
    const noGroundError = groundIssues.find((e) => e.message.includes('No ground net found'));
    expect(noGroundError).toBeDefined();
  });

  it('detects missing hierarchical port (interface references unknown net)', () => {
    const result = validateNets(MISSING_PORT_INPUT);
    expect(result.valid).toBe(false);
    const portIssues = result.errors.filter(
      (e) => e.code === NetValidationCode.NetMissingHierarchicalPort,
    );
    expect(portIssues.length).toBeGreaterThanOrEqual(1);
    expect(portIssues[0].netName).toBe('EXT_CLK');
  });
});

// ── Unconnected pins ───────────────────────────────────────────────────────

describe('unconnected pins', () => {
  it('warns when a device has zero pin connections', () => {
    const result = validateNets(UNCONNECTED_DEVICE_INPUT);
    const unconnectedWarnings = result.warnings.filter(
      (e) => e.code === NetValidationCode.NetUnconnectedRequiredPin,
    );
    expect(unconnectedWarnings.length).toBeGreaterThanOrEqual(1);
    expect(unconnectedWarnings[0].componentRef).toBe('U1');
  });
});

// ── Cross-sheet consistency ────────────────────────────────────────────────

describe('cross-sheet consistency', () => {
  it('passes when matching interfaces are consistent', () => {
    const result = validateNets(CROSS_SHEET_INPUT);
    const crossIssues = [
      ...result.errors.filter((e) => e.code === NetValidationCode.NetInconsistentCrossSheet),
      ...result.warnings.filter((e) => e.code === NetValidationCode.NetInconsistentCrossSheet),
    ];
    expect(crossIssues).toHaveLength(0);
  });

  it('detects mismatched cross-sheet interface pins', () => {
    const result = validateNets(MISMATCHED_CROSS_SHEET_INPUT);
    const mismatchedIssues = result.errors.filter(
      (e) => e.code === NetValidationCode.NetInconsistentCrossSheet,
    );
    expect(mismatchedIssues.length).toBeGreaterThanOrEqual(1);
    expect(mismatchedIssues[0].details).toBeDefined();
    expect(mismatchedIssues[0].details!.interfaceName).toBe('BUS_A');
  });
});

// ── Naming conventions ─────────────────────────────────────────────────────

describe('naming conventions', () => {
  it('warns when a power net name does not follow conventions', () => {
    const result = validateNets(BAD_POWER_NAME_INPUT);
    const namingIssues = result.warnings.filter(
      (e) => e.code === NetValidationCode.NetNamingConvention,
    );
    // "MY_RAIL" as power should trigger a naming warning
    const powerNamingIssues = namingIssues.filter((e) => e.netName === 'MY_RAIL');
    expect(powerNamingIssues).toHaveLength(1);
  });

  it('warns when a ground net name does not follow conventions', () => {
    const result = validateNets(BAD_GROUND_NAME_INPUT);
    const namingIssues = result.warnings.filter(
      (e) => e.code === NetValidationCode.NetNamingConvention,
    );
    const groundNamingIssues = namingIssues.filter((e) => e.netName === 'RET');
    expect(groundNamingIssues).toHaveLength(1);
  });
});

// ── Protected domain ───────────────────────────────────────────────────────

describe('protected domain', () => {
  it('detects generic high-voltage net names', () => {
    const result = validateNets(HV_GENERIC_NAME_INPUT);
    const hvIssues = result.errors.filter((e) => e.code === NetValidationCode.NetProtectedDomain);
    expect(hvIssues.length).toBeGreaterThanOrEqual(1);
    expect(hvIssues[0].netName).toBe('L');
  });

  it('detects mixed HV+digital domain (safety hazard)', () => {
    const result = validateNets(HV_MIXED_DOMAIN_INPUT);
    const hvIssues = result.errors.filter((e) => e.code === NetValidationCode.NetProtectedDomain);
    expect(hvIssues.length).toBeGreaterThanOrEqual(1);
    expect(hvIssues[0].netName).toBe('HV_CLK');
  });
});

// ── Error shape ────────────────────────────────────────────────────────────

describe('error shape', () => {
  it('includes remediationHint in all errors', () => {
    const result = validateNets(FLOATING_INPUT);
    for (const err of result.errors) {
      expect(err.remediationHint).toBeTruthy();
    }
  });

  it('includes netName in net-related issues', () => {
    const result = validateNets(DUPLICATE_NAME_INPUT);
    const dupIssues = result.errors.filter((e) => e.code === NetValidationCode.NetDuplicateName);
    expect(dupIssues[0].netName).toBeDefined();
  });

  it('includes componentRef and pin in pin-related issues', () => {
    const result = validateNets(SHORT_INPUT);
    const shortIssues = result.errors.filter(
      (e) => e.code === NetValidationCode.NetAccidentalShort,
    );
    expect(shortIssues[0].componentRef).toBeDefined();
    expect(shortIssues[0].pin).toBeDefined();
  });

  it('includes path field for positional issues', () => {
    const result = validateNets(FLOATING_INPUT);
    const floatingIssues = result.errors.filter((e) => e.code === NetValidationCode.NetFloating);
    expect(floatingIssues[0].path).toMatch(/^nets\[\d+\]$/);
  });
});

// ── Edge cases ─────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles empty net list without error', () => {
    const result = validateNets({ nets: [] });
    expect(result.valid).toBe(false); // Will fail because no power/ground
    expect(result.errors).toBeDefined();
  });

  it('handles undefined devices and interfaces', () => {
    const result = validateNets({ nets: [] });
    expect(result).toBeDefined();
    expect(result.errors.length).toBeGreaterThanOrEqual(0);
  });

  it('handles single-net design gracefully', () => {
    const result = validateNets({
      nets: [{ id: 'n1', name: 'GND', type: 'ground', nodes: [{ deviceRef: 'X1', pin: '1' }] }],
    });
    expect(result.valid).toBe(false); // No power net
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
