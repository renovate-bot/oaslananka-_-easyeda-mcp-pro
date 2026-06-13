# Net Validation

Semantic validation for EasyEDA Pro net/wire names and topology.

## Overview

The net validation module inspects a schematic's net list and validates it
against 10 electrical and naming-convention rules. It operates on a decoupled
input type (`NetValidationEntry[]`) that can be fed from CircuitIR, the EasyEDA
bridge, or test fixtures.

## Validation Model

Every `validateNets()` call returns a `NetValidationResult`:

```
{
  valid: boolean;           // true → zero errors (warnings allowed)
  errors: NetValidationIssue[];   // blocking issues
  warnings: NetValidationIssue[]; // advisory issues
}
```

Each `NetValidationIssue` contains:

| Field             | Type                   | Description                        |
| ----------------- | ---------------------- | ---------------------------------- |
| `code`            | `NetValidationCode`    | Machine-readable error code        |
| `message`         | `string`               | Human-readable description         |
| `severity`        | `'error' \| 'warning'` | Blocks validation or is advisory   |
| `path`            | `string?`              | Dot-notation path (e.g. `nets[2]`) |
| `netName`         | `string?`              | Offending net name                 |
| `componentRef`    | `string?`              | Offending component ref designator |
| `pin`             | `string?`              | Offending pin number/name          |
| `remediationHint` | `string`               | Actionable fix suggestion          |
| `details`         | `Record?`              | Additional structured context      |

## Rules

### 1. Floating Net (`NET_FLOATING`)

**Severity:** error  
**Detects:** Nets with zero node connections.

```text
Net "FLOAT" (n2) has no node connections — it is floating
→ Connect this net to at least one device pin or remove it
```

### 2. Duplicate Net Name (`NET_DUPLICATE_NAME`)

**Severity:** error  
**Detects:** Two or more nets sharing the same name (case-insensitive).

```text
Net name "3V3" is used by 2 nets: n1, n2
→ Rename conflicting nets or merge them if they are intended
  to be the same electrical node
```

### 3. Accidental Short (`NET_ACCIDENTAL_SHORT`)

**Severity:** error  
**Detects:** The same device pin connected to multiple different nets.

```text
Device pin "U1:1" is connected to 2 different nets: NET_A, NET_B
→ Ensure only one net connects to each device pin
```

### 4. Missing Power Net (`NET_MISSING_POWER`)

**Severity:** error + warning  
**Detects:** No net with `type=power` exists. Also warns when required
power net names (`VIN`, `3V3`) are missing.

### 5. Missing Ground Net (`NET_MISSING_GROUND`)

**Severity:** error + warning  
**Detects:** No net with `type=ground` exists. Also warns when `GND` is missing.

### 6. Missing Hierarchical Port (`NET_MISSING_HIERARCHICAL_PORT`)

**Severity:** error  
**Detects:** An interface/port references a signal name that does not match
any net in the design.

### 7. Unconnected Required Pin (`NET_UNCONNECTED_REQUIRED_PIN`)

**Severity:** warning  
**Detects:** A device that has zero net connections anywhere.

### 8. Inconsistent Cross-Sheet Interface (`NET_INCONSISTENT_CROSS_SHEET`)

**Severity:** error  
**Detects:** Two interfaces with the same name but different pin counts or
mismatched signal names.

### 9. Naming Convention Violation (`NET_NAMING_CONVENTION`)

**Severity:** warning  
**Detects:** Power nets whose names do not match power rail conventions
(e.g. `MY_RAIL` instead of `3V3` / `VCC`), or ground nets whose names
do not match ground conventions (e.g. `RET` instead of `GND`).

Uses `NET_DOMAIN_PATTERNS` regex sets to classify net names into domain
categories (power, ground, analog, digital, clock, control, high-voltage).

### 10. Protected Domain (`NET_PROTECTED_DOMAIN`)

**Severity:** error  
**Detects:** High-voltage nets with generic unprotected names (`L`, `N`)
or nets classified in both high-voltage **and** digital/clock domains
(safety hazard).

## Error Codes

| Code                            | Severity | Rule # |
| ------------------------------- | -------- | ------ |
| `NET_FLOATING`                  | error    | 1      |
| `NET_DUPLICATE_NAME`            | error    | 2      |
| `NET_ACCIDENTAL_SHORT`          | error    | 3      |
| `NET_MISSING_POWER`             | error    | 4      |
| `NET_MISSING_GROUND`            | error    | 5      |
| `NET_MISSING_HIERARCHICAL_PORT` | error    | 6      |
| `NET_UNCONNECTED_REQUIRED_PIN`  | warning  | 7      |
| `NET_INCONSISTENT_CROSS_SHEET`  | error    | 8      |
| `NET_NAMING_CONVENTION`         | warning  | 9      |
| `NET_PROTECTED_DOMAIN`          | error    | 10     |

## Usage

### Basic validation

```typescript
import { validateNets } from './net-validation/index.js';

const result = validateNets({
  nets: [
    { id: 'n1', name: '3V3', type: 'power', nodes: [{ deviceRef: 'U1', pin: '1' }] },
    { id: 'n2', name: 'GND', type: 'ground', nodes: [{ deviceRef: 'U1', pin: '2' }] },
    {
      id: 'n3',
      name: 'I2C_SCL',
      type: 'signal',
      nodes: [
        { deviceRef: 'U1', pin: '3' },
        { deviceRef: 'U2', pin: '1' },
      ],
    },
  ],
  devices: [
    { id: 'U1', ref: 'U1', category: 'microcontroller' },
    { id: 'U2', ref: 'U2', category: 'sensor' },
  ],
});

if (!result.valid) {
  for (const err of result.errors) {
    console.error(`[${err.code}] ${err.message}`);
    console.error(`  → Fix: ${err.remediationHint}`);
  }
}
```

### Validate or throw

```typescript
import { validateNetsOrThrow } from './net-validation/index.js';

try {
  const result = validateNetsOrThrow(input);
  // result.valid is guaranteed to be true here
} catch (issue) {
  console.error(`Validation failed: ${issue.message}`);
}
```

## Integration with CircuitIR

The net validation input is decoupled from the full CircuitIR `Net` schema.
To validate CircuitIR nets, map them to `NetValidationEntry[]`:

```typescript
import type { Net } from '../circuit/circuit-ir.js';

function mapToValidationEntries(nets: Net[]): NetValidationEntry[] {
  return nets.map((net) => ({
    id: net.id,
    name: net.name,
    type: net.type.toLowerCase() as 'power' | 'signal' | 'ground',
    nodes: net.nodes.map((node) => ({
      deviceRef: node.deviceRef,
      pin: node.pin,
    })),
  }));
}
```

## Naming Conventions

The naming convention engine classifies net names into domains using
`NET_DOMAIN_PATTERNS`:

| Domain       | Example names             | Pattern highlights               |
| ------------ | ------------------------- | -------------------------------- |
| Power        | `3V3`, `VCC`, `VIN`, `5V` | Digit+V, V prefix, PWR           |
| Ground       | `GND`, `AGND`, `PGND`     | GND, VSS, GROUND                 |
| Analog       | `SENSE`, `FB`, `VREF`     | SENSE, FB, COMP, OSC             |
| Digital      | `I2C_SCL`, `UART_TXD`     | Protocol prefixes, shouting case |
| Clock        | `CLK_32K`, `MCO`, `XTAL`  | CLK, MCO, OSC, PWM               |
| Control      | `nRST`, `EN`, `SHDN`      | nRST prefix, EN, OE, WAKE        |
| High-Voltage | `HV_BULK`, `AC_L`, `L`    | HV*, AC*, L, N, MAINS            |

Reserved names (`GND`, `VCC`, `VDD`, etc.) are exempt from convention checks.

## API Reference

### `validateNets(input: NetValidationInput): NetValidationResult`

Run all 10 validation rules. Returns errors and warnings.

### `validateNetsOrThrow(input: NetValidationInput): NetValidationResult`

Same as `validateNets` but throws the first error on failure.

### Factory helpers

- `netValidationIssue(code, message, opts?)` — create an issue
- `netError(code, message, opts?)` — create an error-severity issue
- `netWarning(code, message, opts?)` — create a warning-severity issue

## File Structure

```
src/net-validation/
├── errors.ts       — Error codes, issue interface, factory helpers
├── schema.ts       — Input types, naming convention patterns, domain maps
├── validation.ts   — 10 validation rules, entry points
├── fixtures.ts     — Sample net data for tests
└── index.ts        — Barrel exports

tests/unit/net-validation/
└── net-validation.test.ts  — Unit tests covering all rules and edge cases
```
