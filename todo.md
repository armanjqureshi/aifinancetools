
## Retrieval Coverage and Refresh UX — September 2026
- [x] Add verified latest-release adapters for ICICI Prudential and Nippon India; retain safe fallback paths for Axis (no server-exposed current PDF link) and Kotak (official host returns 403) rather than guessing URLs
- [x] Show each AMC source's last verification timestamp in the workspace
- [x] Add a separate one-click refresh-all-stale action
- [x] Add regression tests for adapter candidates and stale-source classification
- [x] Run full validation, inspect the preview, and save a checkpoint
