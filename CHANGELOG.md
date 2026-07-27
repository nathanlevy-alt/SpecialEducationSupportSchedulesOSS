# v0.54.18et

- Allows Student Manager 2:1 rows to be changed back to another degree of support.
- Allows 2:1 second-staff dropdowns to be cleared and saved blank.
- Persists 2:1 period/staff sidecar data as exact rendered row state when requested.
- Restores final publish-status owner and reduces schedule-view caching so Staff/Student/Break views show current state.
- Keeps published/unpublished schedule banners active.
- Updates /healthz version metadata.

# v0.54.18es

Focused Student Manager 2:1 source-path fix.

- Restored the working 2:1 second-staff render/rehydration path from the prior branch.
- Added direct Advanced Scheduling persistence for 2:1 second-staff selections when the 2nd staff field changes.
- Captures and preserves the 2:1 second-staff map before Save Student re-renders the Student Manager table.
- Server-side advanced-scheduling saves now merge/preserve existing 2:1 period/staff maps unless 2:1 is explicitly disabled or a replace request is sent.
- Preserved split-period flag behavior, published schedule banners, Now fixes, Break Schedule display cleanup, and Unassigned Assignments logic from prior builds.
- Updated /healthz version metadata to 0.54.18es.
