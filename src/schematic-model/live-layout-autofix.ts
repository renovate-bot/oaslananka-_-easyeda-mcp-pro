import { type ToolContext } from '../tools/types.js';
import { gatherLivePrimitiveBounds } from './live-primitive-bounds.js';
import { buildEngineSheetGeometry } from './live-functional-layout.js';
import {
  previewLayoutAutofix,
  type LayoutAutofixAllowlist,
  type LayoutAutofixPreview,
  type LayoutAutofixPrimitive,
} from '../layout/autofix.js';
import type { PlacementConstraintRegion } from '../layout/placement.js';

export interface GatherLiveLayoutAutofixPreviewOptions {
  allowlist?: Partial<LayoutAutofixAllowlist>;
  hardKeepouts?: readonly PlacementConstraintRegion[];
  callerReservedRegions?: readonly PlacementConstraintRegion[];
  minimumClearance?: number;
  maxMoves?: number;
}

export interface LiveLayoutAutofixPreviewResult {
  preview: LayoutAutofixPreview;
  primitiveCount: number;
  unavailablePrimitiveIds: string[];
}

const DEFAULT_ALLOWLIST: LayoutAutofixAllowlist = {
  primitiveTypes: ['component'],
  properties: ['position'],
};

/**
 * Reads live sheet geometry and every component's real rendered bounds, then
 * runs the pure `previewLayoutAutofix` engine against them -- read-only, no
 * writes. `schematic.listComponents` is the only bridge source available for
 * primitive identity, so every live primitive here is typed 'component';
 * text/label/annotation/section-box primitives (and therefore TEXT_OVERLAP /
 * SECTION_BOX_TOO_SMALL violations) are out of reach until the bridge exposes
 * them independently -- same limitation already documented on
 * easyeda_schematic_primitive_bounds.
 */
export async function gatherLiveLayoutAutofixPreview(
  ctx: ToolContext,
  projectId: string,
  options: GatherLiveLayoutAutofixPreviewOptions = {},
): Promise<LiveLayoutAutofixPreviewResult> {
  const sheetInfoResult = await ctx.bridge.call<{ projectId: string }, unknown>(
    'schematic.getSheetInfo',
    { projectId },
  );
  const sheet = buildEngineSheetGeometry(sheetInfoResult);

  const boundsBatch = await gatherLivePrimitiveBounds(ctx, projectId);
  const primitives: LayoutAutofixPrimitive[] = [];
  const unavailablePrimitiveIds: string[] = [];
  for (const item of boundsBatch.items) {
    if (!item.combinedBounds) {
      unavailablePrimitiveIds.push(item.id);
      continue;
    }
    primitives.push({
      id: item.id,
      primitiveType: 'component',
      origin: item.origin,
      combinedBounds: item.combinedBounds,
      locked: false,
    });
  }

  const allowlist: LayoutAutofixAllowlist = {
    primitiveTypes: options.allowlist?.primitiveTypes ?? DEFAULT_ALLOWLIST.primitiveTypes,
    properties: options.allowlist?.properties ?? DEFAULT_ALLOWLIST.properties,
  };

  const preview = previewLayoutAutofix({
    sheet,
    primitives,
    allowlist,
    hardKeepouts: options.hardKeepouts,
    callerReservedRegions: options.callerReservedRegions,
    minimumClearance: options.minimumClearance,
    maxMoves: options.maxMoves,
  });

  return { preview, primitiveCount: primitives.length, unavailablePrimitiveIds };
}
