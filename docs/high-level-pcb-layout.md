# High-Level PCB Layout Tools

High-level PCB layout tools turn agent intent into previewable, constraint-checked layout operations before any PCB mutation is applied.

These tools sit above the primitive PCB operations such as component placement and track creation. They are intended for safer agent workflows where a plan must be reviewed before write operations run.

## Tools

```text
easyeda_pcb_place_component_group
easyeda_pcb_route_path_plan
```

Both tools are high-risk write-capable tools, but they support a preview-first workflow:

- `mode: 'preview'` creates a plan and does not call the EasyEDA bridge.
- `mode: 'apply'` applies the generated operations only when `confirmWrite: true` is present.
- Constraint errors block apply before any bridge call.
- Every output includes a transaction id, operations, issues, and a human-readable summary.

## Component group placement

`easyeda_pcb_place_component_group` places multiple components on a grid starting from an anchor point.

It validates:

- board dimensions;
- component dimensions and references;
- board boundary fit;
- keepout overlap;
- spacing/collision risk.

Preview example:

```json
{
  "mode": "preview",
  "board": { "widthMm": 60, "heightMm": 40 },
  "anchor": { "x": 10, "y": 10 },
  "columns": 2,
  "spacingMm": 4,
  "components": [
    { "ref": "U1", "primitiveId": "p-u1", "widthMm": 6, "heightMm": 6 },
    { "ref": "C1", "primitiveId": "p-c1", "widthMm": 2, "heightMm": 1.2 }
  ]
}
```

Apply example:

```json
{
  "mode": "apply",
  "confirmWrite": true,
  "board": { "widthMm": 60, "heightMm": 40 },
  "anchor": { "x": 10, "y": 10 },
  "components": [{ "ref": "U1", "primitiveId": "p-u1", "widthMm": 6, "heightMm": 6 }]
}
```

If a component would be outside the board or inside a keepout, the tool returns `blocked: true` and does not call the bridge.

## Route path planning

`easyeda_pcb_route_path_plan` creates a constrained route path for one net from a waypoint list.

It validates:

- at least two waypoints;
- positive trace width;
- minimum trace width constraint;
- optional maximum path length;
- optional board boundary;
- optional keepout crossing.

Preview example:

```json
{
  "mode": "preview",
  "netName": "GND",
  "layer": 1,
  "widthMm": 0.4,
  "board": { "widthMm": 60, "heightMm": 40 },
  "waypoints": [
    { "x": 5, "y": 5 },
    { "x": 15, "y": 5 },
    { "x": 15, "y": 15 }
  ]
}
```

Apply example:

```json
{
  "mode": "apply",
  "confirmWrite": true,
  "netName": "GND",
  "layer": 1,
  "widthMm": 0.4,
  "waypoints": [
    { "x": 0, "y": 0 },
    { "x": 10, "y": 0 }
  ]
}
```

If a route leaves the board, crosses a keepout, or violates minimum width, apply is blocked before `pcb.addTrack` is called.

## Output shape

Both tools return:

```typescript
{
  success: boolean;
  project_id: string;
  transaction_id: string;
  mode: 'preview' | 'apply';
  applied: boolean;
  blocked: boolean;
  operations: Array<{ method: string; params: Record<string, unknown> }>;
  issues: Array<{
    code: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    remediationHint: string;
    details?: Record<string, unknown>;
  }>;
  summary: string;
}
```

## Safety model

These tools follow the same safety policy as primitive PCB writes:

1. Generate a previewable plan first.
2. Review operations and issues.
3. Apply only with `mode: 'apply'` and `confirmWrite: true`.
4. Run read-only DRC/ERC, production review, and export checks after applying.

The tools are intentionally conservative. When geometry is ambiguous, they prefer blocking the plan over applying potentially unsafe layout changes.
