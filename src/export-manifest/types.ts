/**
 * Export manifest — types for export artifact manifests and validation.
 *
 * Defines the schema for export manifests — structural metadata files
 * that describe what was exported (artifacts), when, and by which tool,
 * and enable subsequent validation of completeness and integrity.
 *
 * @module
 */

// ── Artifact type ───────────────────────────────────────────────────────────

/**
 * Supported export artifact types.
 *
 * Maps to the file format enum used by EasyEDA Pro export tools and
 * the golden fixture's `exportManifest.expectedFormats`.
 */
export enum ArtifactType {
  /** Gerber RS-274X (fabrication layers). */
  Gerber = 'gerber',
  /** NC drill file (Excellon). */
  Drill = 'drill',
  /** Bill of materials (CSV). */
  Bom = 'bom',
  /** Pick-and-place / centroid file (CSV). */
  Pnp = 'pnp',
  /** PDF export (schematic, board, or both). */
  Pdf = 'pdf',
  /** Netlist (PADS / Allegro / Altium format). */
  Netlist = 'netlist',
  /** Electrical rules check report. */
  ErcReport = 'erc-report',
  /** Design rules check report. */
  DrcReport = 'drc-report',
}

// ── Manifest entry ─────────────────────────────────────────────────────────

/**
 * A single artifact entry in an export manifest.
 *
 * Each entry describes one file produced by an export operation, including
 * its origin, integrity metadata, and required/optional classification.
 */
export interface ExportManifestEntry {
  /** File name (e.g. "ESP32-S3-Board-F.Cu.gbr"). */
  filename: string;
  /** Relative path from the export root directory. */
  relativePath?: string;
  /** The type of exported file. */
  fileType: ArtifactType;
  /** Human-readable purpose (e.g. "Top copper layer"). */
  purpose: string;
  /** Source project identifier. */
  sourceProject?: string;
  /** Tool that generated this artifact (e.g. "easyeda-export-gerbers"). */
  generatedByTool?: string;
  /** ISO-8601 timestamp when this artifact was generated. */
  timestamp?: string;
  /** Hex-encoded SHA-256 or MD5 checksum. */
  checksum?: string;
  /** File size in bytes. */
  fileSize?: number;
  /** Whether this artifact is required for the export to be valid. */
  required: boolean;
  /** Whether this artifact is stale (outdated relative to source design). */
  stale: boolean;
}

// ── Expected artifact (for comparison-based validation) ────────────────────

/**
 * Expected artifact descriptor used to validate actual export output.
 *
 * Mirrors the golden fixture's `exportManifest.files[]` structure.
 */
export interface ExpectedArtifact {
  /** Expected file name pattern. */
  filename: string;
  /** Expected file type. */
  fileType: ArtifactType;
  /** Minimum acceptable file size in bytes. */
  minSizeBytes?: number;
  /** Whether this artifact is required (missing = validation error). */
  required?: boolean;
}

// ── Validation input ───────────────────────────────────────────────────────

/**
 * Complete input to export manifest validation.
 *
 * Carries both the actual exported artifacts and an optional set of
 * expectations to compare against.
 */
export interface ExportManifestInput {
  /** Manifest schema version (semver, e.g. "1.0.0"). */
  version: string;
  /** Source project identifier (EasyEDA project UUID). */
  sourceProjectId: string;
  /** Human-readable source project name. */
  sourceProjectName?: string;
  /** ISO-8601 timestamp of manifest generation. */
  generatedAt: string;
  /** Server / tool version that produced this manifest. */
  serverVersion?: string;
  /** EasyEDA / bridge metadata if available. */
  bridgeMetadata?: Record<string, unknown>;
  /** Artifacts produced by the export. */
  artifacts: ExportManifestEntry[];
  /** Expected artifacts for comparison-based validation. */
  expectedArtifacts?: ExpectedArtifact[];
}

// ── Validation issue ────────────────────────────────────────────────────────

/**
 * A single export manifest validation issue (error or warning).
 *
 * Mirrors the pattern from `net-validation/errors.ts` for consistency
 * across validation modules.
 */
export interface ExportManifestIssue {
  /** Machine-readable error code. */
  code: string;
  /** Human-readable description of what is wrong. */
  message: string;
  /** Whether this issue blocks validation or is advisory. */
  severity: 'error' | 'warning';
  /** Dot-notation path to the offending field (e.g. "artifacts[2]"). */
  path?: string;
  /** Related artifact path for file-level issues. */
  artifactPath?: string;
  /** Related artifact type for type-specific issues. */
  artifactType?: string;
  /** Related purpose field for purpose-related issues. */
  purpose?: string;
  /** Actionable hint for the user. */
  remediationHint: string;
  /** Additional machine-readable context. */
  details?: Record<string, unknown>;
}

// ── Validation report ───────────────────────────────────────────────────────

/**
 * Validation summary breakdown.
 */
export interface ExportManifestSummary {
  /** Total artifact count in the manifest. */
  totalFiles: number;
  /** Number of error-severity issues. */
  errors: number;
  /** Number of warning-severity issues. */
  warnings: number;
  /** Count of missing required files. */
  missingRequired: number;
  /** Count of empty files. */
  emptyFiles: number;
  /** Count of stale files. */
  staleFiles: number;
  /** Count of checksum mismatches. */
  checksumMismatches: number;
  /** Count of unexpected files (present but not expected). */
  unexpectedFiles: number;
  /** Count of wrong file type assignments. */
  wrongFileTypes: number;
  /** Count of artifacts missing a purpose description. */
  missingPurposes: number;
  /** Count of artifacts missing a generation timestamp. */
  missingTimestamps: number;
  /** Count of artifacts missing a source project reference. */
  missingSourceProjects: number;
}

/**
 * Complete export manifest validation report.
 */
export interface ExportManifestReport {
  /** True when there are zero errors (warnings are allowed). */
  valid: boolean;
  /** The manifest that was validated (as provided). */
  manifest: ExportManifestInput;
  /** All issues found during validation. */
  issues: ExportManifestIssue[];
  /** Aggregated summary counts. */
  summary: ExportManifestSummary;
}
