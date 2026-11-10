-- Run this once against the production Neon database used by Council Space.
-- It is safe to run again: existing memberships are updated, not duplicated.
-- The transaction stops without partial changes if an account or department is missing.

BEGIN;

DO $$
DECLARE
  missing TEXT;
BEGIN
  WITH approved(email, slug) AS (
    VALUES
      ('dilidrsv@gmail.com', 'management'),
      ('aiyazhumagali5555@gmail.com', 'mentorship'),
      ('bajbosynovnurali@icloud.com', 'finance-external-affairs'),
      ('aizere088@mail.ru', 'volunteering'),
      ('avrgbsenjoyer@gmail.com', 'sport')
  )
  SELECT string_agg(approved.email, ', ' ORDER BY approved.email)
  INTO missing
  FROM approved
  LEFT JOIN "User" u ON lower(u.email) = lower(approved.email) AND u."isDemo" = false
  LEFT JOIN "Department" d ON d."schoolId" = u."schoolId" AND d.slug = approved.slug
  WHERE u.id IS NULL OR d.id IS NULL;

  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Missing registered account or department for: %', missing;
  END IF;
END $$;

WITH approved(email, slug) AS (
  VALUES
    ('dilidrsv@gmail.com', 'management'),
    ('aiyazhumagali5555@gmail.com', 'mentorship'),
    ('bajbosynovnurali@icloud.com', 'finance-external-affairs'),
    ('aizere088@mail.ru', 'volunteering'),
    ('avrgbsenjoyer@gmail.com', 'sport')
), resolved AS (
  SELECT u.id AS user_id, d.id AS department_id
  FROM approved
  JOIN "User" u ON lower(u.email) = lower(approved.email) AND u."isDemo" = false
  JOIN "Department" d ON d."schoolId" = u."schoolId" AND d.slug = approved.slug
)
INSERT INTO "Membership" (id, "userId", "departmentId", role, status)
SELECT 'manual_min_' || substr(md5(user_id || ':' || department_id), 1, 24),
       user_id, department_id, 'MINISTER', 'ACTIVE'
FROM resolved
ON CONFLICT ("userId", "departmentId") DO UPDATE
SET role = 'MINISTER', status = 'ACTIVE';

WITH approved(email, slug) AS (
  VALUES
    ('dilidrsv@gmail.com', 'management'),
    ('aiyazhumagali5555@gmail.com', 'mentorship'),
    ('bajbosynovnurali@icloud.com', 'finance-external-affairs'),
    ('aizere088@mail.ru', 'volunteering'),
    ('avrgbsenjoyer@gmail.com', 'sport')
)
UPDATE "User" u
SET "registrationDepartmentId" = d.id
FROM approved
JOIN "Department" d ON d.slug = approved.slug
WHERE lower(u.email) = lower(approved.email)
  AND d."schoolId" = u."schoolId"
  AND u."isDemo" = false;

WITH approved(email, slug) AS (
  VALUES
    ('dilidrsv@gmail.com', 'management'),
    ('aiyazhumagali5555@gmail.com', 'mentorship'),
    ('bajbosynovnurali@icloud.com', 'finance-external-affairs'),
    ('aizere088@mail.ru', 'volunteering'),
    ('avrgbsenjoyer@gmail.com', 'sport')
), resolved AS (
  SELECT u.id AS user_id, d.id AS department_id
  FROM approved
  JOIN "User" u ON lower(u.email) = lower(approved.email) AND u."isDemo" = false
  JOIN "Department" d ON d."schoolId" = u."schoolId" AND d.slug = approved.slug
)
INSERT INTO "AuditLog" (id, "actorId", "departmentId", action, "objectId", reason)
SELECT 'manual_audit_' || substr(md5(user_id || ':' || department_id), 1, 24),
       user_id, department_id, 'APPROVED_MINISTER_PROVISIONED', user_id,
       'Manual Neon assignment approved by council administrator'
FROM resolved
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- Every row below must show MINISTER and ACTIVE.
SELECT u.email, u.name, d.name AS department, m.role, m.status
FROM "User" u
JOIN "Membership" m ON m."userId" = u.id
JOIN "Department" d ON d.id = m."departmentId"
WHERE lower(u.email) IN (
  'dilidrsv@gmail.com',
  'aiyazhumagali5555@gmail.com',
  'bajbosynovnurali@icloud.com',
  'aizere088@mail.ru',
  'avrgbsenjoyer@gmail.com'
)
AND m.role = 'MINISTER'
ORDER BY d.name;
