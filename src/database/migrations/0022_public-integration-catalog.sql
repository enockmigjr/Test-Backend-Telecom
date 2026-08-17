-- Repair the local PhotoVault integration after category UUIDs were replaced.
-- Keep the public catalog and its routing policy aligned with current rows.
UPDATE "support_integrations"
SET "routing_policy" = jsonb_set(
  jsonb_set(
    jsonb_set(
      "routing_policy",
      '{allowedCategoryIds}',
      jsonb_build_array(
        '01a001b0-21ff-7ee8-b7fe-213e4fa79ce1',
        '01a001b0-220d-7ee8-b7fe-32946274fd6f',
        '01a001b0-21f9-7ee8-b7fe-185f95134c9d',
        '01a001b0-2224-7ee8-b7fe-41b92a739deb'
      )
    ),
    '{categoryRoutes}',
    jsonb_build_object(
      '01a001b0-21ff-7ee8-b7fe-213e4fa79ce1', jsonb_build_object('priority', 'MEDIUM', 'severity', 'S2', 'departmentId', '01a001b0-21e5-7ee8-b7fe-05fe5826f16d', 'assignedTeamId', '01a001b0-21e5-7ee8-b7fe-05fe5826f16d'),
      '01a001b0-220d-7ee8-b7fe-32946274fd6f', jsonb_build_object('priority', 'MEDIUM', 'severity', 'S3', 'departmentId', '01a001b0-21eb-7ee8-b7fe-0fa39708b28a', 'assignedTeamId', '01a001b0-21eb-7ee8-b7fe-0fa39708b28a'),
      '01a001b0-21f9-7ee8-b7fe-185f95134c9d', jsonb_build_object('priority', 'MEDIUM', 'severity', 'S2', 'departmentId', '01a001b0-21df-7ee8-b7fd-f95088b2893d', 'assignedTeamId', '01a001b0-21df-7ee8-b7fd-f95088b2893d'),
      '01a001b0-2224-7ee8-b7fe-41b92a739deb', jsonb_build_object('priority', 'MEDIUM', 'severity', 'S3', 'departmentId', '01a001b0-21cb-7ee8-b7fd-f798432fc05c', 'assignedTeamId', '01a001b0-21cb-7ee8-b7fd-f798432fc05c')
    )
  ),
  '{defaultRoute}',
  jsonb_build_object('priority', 'MEDIUM', 'severity', 'S3', 'departmentId', '01a001b0-21cb-7ee8-b7fd-f798432fc05c', 'assignedTeamId', '01a001b0-21cb-7ee8-b7fd-f798432fc05c')
)
WHERE "public_key" = '-jzMJblBEDYhbGbZmXcgBb4a2kHWe9Hk'
  AND "status" = 'ACTIVE';
