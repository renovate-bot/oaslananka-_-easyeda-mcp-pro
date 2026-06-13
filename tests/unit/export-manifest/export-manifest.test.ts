/**
 * Export manifest — unit tests.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import { validateExportManifest } from '../../../src/export-manifest/validation.js';
import { ExportManifestCode } from '../../../src/export-manifest/errors.js';
import { ArtifactType } from '../../../src/export-manifest/types.js';
import type {
  ExportManifestInput,
  ExportManifestEntry,
} from '../../../src/export-manifest/types.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeArtifact(overrides?: Partial<ExportManifestEntry>): ExportManifestEntry {
  return {
    filename: 'ESP32-S3-Board-F.Cu.gbr',
    fileType: ArtifactType.Gerber,
    purpose: 'Top copper layer',
    sourceProject: 'proj-esp32-s3-001',
    generatedByTool: 'easyeda-export-gerbers',
    timestamp: '2026-06-11T21:00:01.000Z',
    fileSize: 4096,
    required: true,
    stale: false,
    ...overrides,
  };
}

function makeInput(overrides?: Partial<ExportManifestInput>): ExportManifestInput {
  return {
    version: '1.0.0',
    sourceProjectId: 'proj-esp32-s3-001',
    sourceProjectName: 'ESP32-S3 Sensor Board',
    generatedAt: '2026-06-11T21:00:00.000Z',
    serverVersion: '0.4.0',
    artifacts: [makeArtifact()],
    expectedArtifacts: [
      {
        filename: 'ESP32-S3-Board-F.Cu.gbr',
        fileType: ArtifactType.Gerber,
        required: true,
      },
    ],
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('validateExportManifest', () => {
  // ── Valid manifest ────────────────────────────────────────────────────────

  it('should pass a valid manifest', () => {
    const result = validateExportManifest(makeInput());

    expect(result.valid).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.summary.totalFiles).toBe(1);
    expect(result.summary.errors).toBe(0);
    expect(result.summary.warnings).toBe(0);
  });

  it('should pass a valid manifest from fixture file', () => {
    // Build a realistic multi-artifact manifest matching the valid fixture
    const input: ExportManifestInput = {
      version: '1.0.0',
      sourceProjectId: 'proj-esp32-s3-001',
      sourceProjectName: 'ESP32-S3 Sensor Board',
      generatedAt: '2026-06-11T21:00:00.000Z',
      serverVersion: '0.4.0',
      artifacts: [
        makeArtifact({
          filename: 'ESP32-S3-Board-F.Cu.gbr',
          fileType: ArtifactType.Gerber,
          purpose: 'Top copper layer',
          fileSize: 4096,
        }),
        makeArtifact({
          filename: 'ESP32-S3-Board-B.Cu.gbr',
          fileType: ArtifactType.Gerber,
          purpose: 'Bottom copper layer',
          fileSize: 4096,
        }),
        makeArtifact({
          filename: 'ESP32-S3-Board.drl',
          fileType: ArtifactType.Drill,
          purpose: 'NC drill file',
          fileSize: 512,
        }),
        makeArtifact({
          filename: 'ESP32-S3-Board.csv',
          fileType: ArtifactType.Bom,
          purpose: 'Bill of materials',
          fileSize: 2048,
        }),
        makeArtifact({
          filename: 'ESP32-S3-Board-PnP.csv',
          fileType: ArtifactType.Pnp,
          purpose: 'Pick-and-place centroid file',
          fileSize: 1024,
        }),
        makeArtifact({
          filename: 'ESP32-S3-Board-Schematic.pdf',
          fileType: ArtifactType.Pdf,
          purpose: 'Schematic PDF',
          fileSize: 15360,
        }),
      ],
      expectedArtifacts: [
        { filename: 'ESP32-S3-Board-F.Cu.gbr', fileType: ArtifactType.Gerber, required: true },
        { filename: 'ESP32-S3-Board-B.Cu.gbr', fileType: ArtifactType.Gerber, required: true },
        { filename: 'ESP32-S3-Board.drl', fileType: ArtifactType.Drill, required: true },
        { filename: 'ESP32-S3-Board.csv', fileType: ArtifactType.Bom, required: true },
        { filename: 'ESP32-S3-Board-PnP.csv', fileType: ArtifactType.Pnp, required: false },
        { filename: 'ESP32-S3-Board-Schematic.pdf', fileType: ArtifactType.Pdf, required: false },
      ],
    };

    const result = validateExportManifest(input);

    expect(result.valid).toBe(true);
    expect(result.summary.errors).toBe(0);
  });

  // ── Invalid manifest version ──────────────────────────────────────────────

  it('should fail on invalid manifest version', () => {
    const result = validateExportManifest(makeInput({ version: 'not-a-version' }));

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === ExportManifestCode.INVALID_MANIFEST_VERSION)).toBe(
      true,
    );
  });

  it('should fail on empty manifest version', () => {
    const result = validateExportManifest(makeInput({ version: '' }));

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === ExportManifestCode.INVALID_MANIFEST_VERSION)).toBe(
      true,
    );
  });

  // ── Missing source project ────────────────────────────────────────────────

  it('should fail when sourceProjectId is empty', () => {
    const result = validateExportManifest(makeInput({ sourceProjectId: '' }));

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === ExportManifestCode.MISSING_SOURCE_PROJECT)).toBe(
      true,
    );
  });

  it('should warn when artifact lacks sourceProject', () => {
    const result = validateExportManifest(
      makeInput({ artifacts: [makeArtifact({ sourceProject: '' })] }),
    );

    // The manifest-level error fires + the per-artifact warning
    expect(
      result.issues.filter((i) => i.code === ExportManifestCode.MISSING_SOURCE_PROJECT).length,
    ).toBeGreaterThanOrEqual(1);
  });

  // ── Missing generated timestamp ───────────────────────────────────────────

  it('should fail when generatedAt is empty', () => {
    const result = validateExportManifest(makeInput({ generatedAt: '' }));

    expect(result.valid).toBe(false);
    expect(
      result.issues.some((i) => i.code === ExportManifestCode.MISSING_GENERATED_TIMESTAMP),
    ).toBe(true);
  });

  it('should warn when artifact lacks timestamp', () => {
    const result = validateExportManifest(
      makeInput({ artifacts: [makeArtifact({ timestamp: '' })] }),
    );

    expect(
      result.issues.some((i) => i.code === ExportManifestCode.MISSING_GENERATED_TIMESTAMP),
    ).toBe(true);
  });

  // ── Missing purpose ───────────────────────────────────────────────────────

  it('should warn when artifact has no purpose description', () => {
    const result = validateExportManifest(
      makeInput({ artifacts: [makeArtifact({ purpose: '' })] }),
    );

    expect(result.issues.some((i) => i.code === ExportManifestCode.MISSING_PURPOSE)).toBe(true);
    expect(result.valid).toBe(true); // warnings don't invalidate
  });

  // ── Empty file ─────────────────────────────────────────────────────────---

  it('should fail on empty file (size 0)', () => {
    const result = validateExportManifest(
      makeInput({ artifacts: [makeArtifact({ fileSize: 0 })] }),
    );

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === ExportManifestCode.EMPTY_FILE)).toBe(true);
  });

  it('should not fail on undefined fileSize', () => {
    const result = validateExportManifest(
      makeInput({ artifacts: [makeArtifact({ fileSize: undefined })] }),
    );
    // No EMPTY_FILE since fileSize is undefined, not 0
    expect(result.issues.some((i) => i.code === ExportManifestCode.EMPTY_FILE)).toBe(false);
  });

  // ── Stale file ────────────────────────────────────────────────────────────

  it('should warn on stale file', () => {
    const result = validateExportManifest(
      makeInput({ artifacts: [makeArtifact({ stale: true })] }),
    );

    expect(result.issues.some((i) => i.code === ExportManifestCode.STALE_FILE)).toBe(true);
    expect(result.valid).toBe(true); // stale is a warning
  });

  // ── Checksum mismatch ─────────────────────────────────────────────────────

  it('should fail on checksum mismatch', () => {
    const result = validateExportManifest(
      makeInput({ artifacts: [makeArtifact({ checksum: 'expected:actual' })] }),
    );

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === ExportManifestCode.CHECKSUM_MISMATCH)).toBe(true);
    expect(result.summary.checksumMismatches).toBe(1);
  });

  it('should ignore single-value checksum (no comparison)', () => {
    const result = validateExportManifest(
      makeInput({ artifacts: [makeArtifact({ checksum: 'abc123' })] }),
    );

    expect(result.issues.some((i) => i.code === ExportManifestCode.CHECKSUM_MISMATCH)).toBe(false);
  });

  it('should pass on matching checksum', () => {
    const result = validateExportManifest(
      makeInput({ artifacts: [makeArtifact({ checksum: 'abc123:abc123' })] }),
    );

    expect(result.issues.some((i) => i.code === ExportManifestCode.CHECKSUM_MISMATCH)).toBe(false);
  });

  // ── Missing required file ─────────────────────────────────────────────────

  it('should fail when a required expected file is missing', () => {
    const result = validateExportManifest(
      makeInput({
        artifacts: [makeArtifact()],
        expectedArtifacts: [
          { filename: 'ESP32-S3-Board-F.Cu.gbr', fileType: ArtifactType.Gerber, required: true },
          { filename: 'ESP32-S3-Board-B.Cu.gbr', fileType: ArtifactType.Gerber, required: true },
        ],
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === ExportManifestCode.MISSING_REQUIRED_FILE)).toBe(
      true,
    );
    expect(result.summary.missingRequired).toBe(1);
  });

  it('should not fail when a missing file is optional', () => {
    const result = validateExportManifest(
      makeInput({
        artifacts: [makeArtifact()],
        expectedArtifacts: [
          { filename: 'ESP32-S3-Board-F.Cu.gbr', fileType: ArtifactType.Gerber, required: true },
          { filename: 'OPTIONAL-File.pdf', fileType: ArtifactType.Pdf, required: false },
        ],
      }),
    );

    // Only one missing required (the second is optional)
    expect(result.summary.missingRequired).toBe(0);
  });

  it('should skip missing-required check when no expectedArtifacts', () => {
    const result = validateExportManifest(
      makeInput({ artifacts: [makeArtifact()], expectedArtifacts: undefined }),
    );

    expect(result.valid).toBe(true);
  });

  // ── Unexpected file ──────────────────────────────────────────────────────

  it('should warn on unexpected artifact not in expected set', () => {
    const result = validateExportManifest(
      makeInput({
        artifacts: [
          makeArtifact(),
          makeArtifact({ filename: 'UNEXPECTED-File.txt', fileType: ArtifactType.Pdf }),
        ],
      }),
    );

    expect(result.issues.some((i) => i.code === ExportManifestCode.UNEXPECTED_FILE)).toBe(true);
    expect(result.valid).toBe(true); // unexpected is a warning
    expect(result.summary.unexpectedFiles).toBe(1);
  });

  // ── Wrong file type ──────────────────────────────────────────────────────

  it('should fail when artifact file type does not match expected', () => {
    const result = validateExportManifest(
      makeInput({
        artifacts: [makeArtifact({ fileType: ArtifactType.Pdf })],
        expectedArtifacts: [
          { filename: 'ESP32-S3-Board-F.Cu.gbr', fileType: ArtifactType.Gerber, required: true },
        ],
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === ExportManifestCode.WRONG_FILE_TYPE)).toBe(true);
    expect(result.summary.wrongFileTypes).toBe(1);
  });

  // ── Validation issues include path/type/purpose ──────────────────────────

  it('should include artifact path in file-level issues', () => {
    const result = validateExportManifest(
      makeInput({ artifacts: [makeArtifact({ fileSize: 0 })] }),
    );

    const emptyIssue = result.issues.find((i) => i.code === ExportManifestCode.EMPTY_FILE);
    expect(emptyIssue).toBeDefined();
    expect(emptyIssue!.artifactPath).toBe('ESP32-S3-Board-F.Cu.gbr');
    expect(emptyIssue!.artifactType).toBe(ArtifactType.Gerber);
  });

  it('should include artifact type in wrong-type issues', () => {
    const result = validateExportManifest(
      makeInput({
        artifacts: [makeArtifact({ fileType: ArtifactType.Pdf })],
        expectedArtifacts: [
          { filename: 'ESP32-S3-Board-F.Cu.gbr', fileType: ArtifactType.Gerber, required: true },
        ],
      }),
    );

    const typeIssue = result.issues.find((i) => i.code === ExportManifestCode.WRONG_FILE_TYPE);
    expect(typeIssue).toBeDefined();
    expect(typeIssue!.artifactType).toBe(ArtifactType.Pdf);
  });

  // ── Summary aggregation ──────────────────────────────────────────────────

  it('should correctly aggregate summary counts', () => {
    // Build a manifest with multiple issues
    const input: ExportManifestInput = {
      version: '', // invalid version
      sourceProjectId: '', // missing source project
      generatedAt: '2026-06-11T21:00:00.000Z',
      artifacts: [
        makeArtifact({
          filename: 'layers.F.Cu.gbr',
          fileType: ArtifactType.Gerber,
          fileSize: 0, // empty file
          purpose: '', // missing purpose
          stale: true, // stale file
          checksum: 'abc:def', // checksum mismatch
          sourceProject: '', // missing source project
          timestamp: '', // missing timestamp
        }),
        makeArtifact({
          filename: 'unexpected.txt',
          fileType: ArtifactType.Pdf,
        }),
      ],
      expectedArtifacts: [
        { filename: 'layers.F.Cu.gbr', fileType: ArtifactType.Gerber, required: true },
        { filename: 'missing-file.gbr', fileType: ArtifactType.Gerber, required: true },
      ],
    };

    const result = validateExportManifest(input);

    expect(result.valid).toBe(false);
    expect(result.summary.totalFiles).toBe(2);
    expect(result.summary.errors).toBeGreaterThan(0);
    expect(result.summary.warnings).toBeGreaterThan(0);
    expect(result.summary.missingRequired).toBe(1);
    expect(result.summary.emptyFiles).toBe(1);
    expect(result.summary.staleFiles).toBe(1);
    expect(result.summary.checksumMismatches).toBe(1);
    expect(result.summary.unexpectedFiles).toBe(1);
    expect(result.summary.wrongFileTypes).toBe(0);
    expect(result.summary.missingPurposes).toBe(1);
    expect(result.summary.missingTimestamps).toBe(1);
    expect(result.summary.missingSourceProjects).toBeGreaterThanOrEqual(1);
  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  it('should handle empty artifacts array', () => {
    const result = validateExportManifest(makeInput({ artifacts: [], expectedArtifacts: [] }));

    // Should still validate manifest-level fields but have no artifact-level errors
    expect(result.summary.totalFiles).toBe(0);
    expect(result.valid).toBe(true);
  });

  it('should handle null/undefined fields gracefully', () => {
    // @ts-expect-error testing runtime resilience with null input
    const result = validateExportManifest(makeInput({ sourceProjectId: null }));

    // null treated as falsy — fires MISSING_SOURCE_PROJECT
    expect(result.issues.some((i) => i.code === ExportManifestCode.MISSING_SOURCE_PROJECT)).toBe(
      true,
    );
  });
});
