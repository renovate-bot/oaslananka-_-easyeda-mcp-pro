# Schematic Net Creation Tools

## Problem

The original `easyeda_schematic_add_wire` tool creates **graphical wires** on the schematic canvas. In EasyEDA Pro, a graphical wire is a visual segment between two coordinates — it does **not** necessarily populate `SCH_Net` / `SCH_Netlist` entries. Without real netlist connectivity, net-based operations such as netlisting, ERC/DRC, board import, and BOM net-assignment do not work correctly.

## Solution

Six new MCP tools bridge the gap between visual wires and real electrical connectivity:

| Tool                                    | Purpose                                             | confirmWrite |
| --------------------------------------- | --------------------------------------------------- | ------------ |
| `easyeda_schematic_create_net_flag`     | Place a named net flag (label) on the canvas        | `true`       |
| `easyeda_schematic_create_net_port`     | Place a hierarchical net port (off-sheet connector) | `true`       |
| `easyeda_schematic_connect_pin_to_net`  | Connect a single component pin to a named net       | `true`       |
| `easyeda_schematic_connect_pins_by_net` | Bulk-connect multiple pins to a named net           | `true`       |
| `easyeda_schematic_validate_netlist`    | Read-only netlist diagnostic/validation             | `false`      |
| `easyeda_project_save`                  | Explicitly persist the project to disk              | `true`       |

## Conceptual Model

```
┌──────────────────────────────────────────────────┐
│                   Schematic                       │
│  ┌──────────────┐   ┌─────────────────────────┐   │
│  │ Graphical     │   │  Electrical (SCH_Net)   │   │
│  │ Wires         │   │  ┌────────────────────┐ │   │
│  │ (visual only) │   │  │ Net: VCC           │ │   │
│  │               │   │  │  ├─ R1.pin(1)      │ │   │
│  │ ───────────── │   │  │  ├─ C1.pin(2)      │ │   │
│  │               │   │  │  └─ NetFlag(VCC)   │ │   │
│  └──────────────┘   │  │  ┌────────────────────┐ │   │
│                      │  │  │ Net: GND           │ │   │
│                      │  │  │  ├─ C1.pin(1)      │ │   │
│                      │  │  │  └─ NetFlag(GND)   │ │   │
│                      │  │  └────────────────────┘ │   │
│                      └─────────────────────────┘   │
└──────────────────────────────────────────────────┘
```

- **Graphical wires** (`easyeda_schematic_add_wire`): Visual segments with optional `netName` hint. May or may not create SCH_Net entries — depends on connected net flags.
- **Net flags** (`easyeda_schematic_create_net_flag`): Named labels placed on wires. When a wire segment has a net flag, the bridge registers it in `SCH_Net.getAllNetsName`.
- **Net ports** (`easyeda_schematic_create_net_port`): Hierarchical connectors that propagate a net name across sheets (off-sheet connectors).
- **Pin-to-net connections** (`easyeda_schematic_connect_pin_to_net` / `connect_pins_by_net`): Explicitly assign component pins to nets, creating entries in `SCH_Netlist.getNetlist`.
- **Netlist validation** (`easyeda_schematic_validate_netlist`): Read-only diagnostic that reports what is in the actual netlist, what is floating, and what is graphical-only.
- **Project save** (`easyeda_project_save`): Explicit persistence — net changes are lost if not saved.

## Tool Details

### create_net_flag

Places a named net flag (label) on the schematic canvas.

**Input:**

```json
{
  "projectId": "proj-abc",
  "netName": "TEST_NET",
  "x": 100,
  "y": 200,
  "rotation": 0,
  "confirmWrite": true
}
```

**Output:**

```json
{
  "success": true,
  "netFlag": {
    "primitiveId": "netflag-001",
    "netName": "TEST_NET"
  }
}
```

### create_net_port

Places a hierarchical net port (off-sheet connector).

**Input:**

```json
{
  "projectId": "proj-abc",
  "netName": "DATA_BUS",
  "x": 300,
  "y": 400,
  "portType": "bidirectional",
  "rotation": 0,
  "confirmWrite": true
}
```

`portType` options: `input`, `output`, `bidirectional`, `triState`, `passive`

### connect_pin_to_net

Connects a single component pin to a named net.

**Input:**

```json
{
  "projectId": "proj-abc",
  "primitiveId": "comp-001",
  "pinNumber": "1",
  "netName": "VCC",
  "confirmWrite": true
}
```

### connect_pins_by_net

Connects multiple pins to a named net in one operation (up to 500 pins).

**Input:**

```json
{
  "projectId": "proj-abc",
  "netName": "DATA_BUS",
  "pins": [
    { "primitiveId": "u1", "pinNumber": "1" },
    { "primitiveId": "u2", "pinNumber": "3" },
    { "primitiveId": "u3", "pinNumber": "5" }
  ],
  "confirmWrite": true
}
```

### validate_netlist

Read-only netlist diagnostic and validation.

**Input:**

```json
{
  "projectId": "proj-abc",
  "includeWireCheck": false
}
```

**Output includes:**

- `netlist`: Array of nets with connected refs, pins, and whether each has a net flag
- `total_nets`: Count of real SCH_Net entries
- `floating_pins`: Component pins not connected to any net
- `wires_without_netlist` (when `includeWireCheck=true`): Graphical wires that lack netlist connectivity
- `valid`: `true` when there are no warnings
- `warnings`: Diagnostic messages

### project_save

Explicitly saves the current project to persist all changes.

**Input:**

```json
{
  "projectId": "proj-abc",
  "confirmWrite": true
}
```

## Safety

All mutation tools (`create_net_flag`, `create_net_port`, `connect_pin_to_net`, `connect_pins_by_net`, `project_save`) require `confirmWrite: true`. The MCP runtime rejects calls that omit this field.

`validate_netlist` is read-only (`confirmWrite: false`, `readOnlyHint: true`, `idempotentHint: true`).

## Bridge Methods

Each tool maps to a bridge method registered in the `EasyedaApiMethodSchema`:

| MCP Tool                                | Bridge Method                |
| --------------------------------------- | ---------------------------- |
| `easyeda_schematic_create_net_flag`     | `schematic.createNetFlag`    |
| `easyeda_schematic_create_net_port`     | `schematic.createNetPort`    |
| `easyeda_schematic_connect_pin_to_net`  | `schematic.connectPinToNet`  |
| `easyeda_schematic_connect_pins_by_net` | `schematic.connectPinsByNet` |
| `easyeda_schematic_validate_netlist`    | `schematic.validateNetlist`  |
| `easyeda_project_save`                  | `project.save`               |

These methods appear in:

- `easyeda_get_capabilities` (tool list)
- `easyeda_bridge_status` (bridge method registry when bridge is connected)
- `easyeda_bridge_probe_methods` (dev profile)

## Testing

### Unit/Contract Tests

Tests live in `tests/unit/tools/schematic.test.ts` and cover:

- Successful bridge call → expected output mapping
- Bridge error → graceful error output
- `confirmWrite` flag presence (`confirmWrite: true` for mutation, `false` for validate)

### Live/Manual Validation

Live validation against EasyEDA Pro is **blocked** — see `docs/manual-netlist-validation.md` for exact manual steps.
