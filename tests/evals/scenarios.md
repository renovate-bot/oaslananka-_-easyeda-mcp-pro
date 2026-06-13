# Eval Scenarios

## Scenario 1: Server health check

- Call `easyeda_health_check`
- Expect: response with status "ok", version string, uptime

## Scenario 2: Tool profiles

- Call `easyeda_get_tool_profiles`
- Expect: list of 5 profiles, current is "core", core is default

## Scenario 3: Feature flags

- Call `easyeda_get_feature_flags`
- Expect: all flags returned as booleans, ordering disabled by default

## Scenario 4: Server config (redacted)

- Call `easyeda_get_server_config`
- Expect: config values but no secrets

## Scenario 5: Capabilities

- Call `easyeda_get_capabilities`
- Expect: server name, version, profiles, feature flags, transports
