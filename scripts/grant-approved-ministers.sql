-- Run this once against the production Neon database used by Council Space.
-- It is safe to run again: existing memberships are updated, not duplicated.
-- Accounts that do not exist yet are reported at the end and can be added on a later run.

-- Clear an aborted transaction left by an earlier attempt in the same SQL session.
ROLLBACK;
BEGIN;

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

-- Five result rows are always returned. Every registered minister must show OK.
WITH approved(email, slug) AS (
  VALUES
    ('dilidrsv@gmail.com', 'management'),
    ('aiyazhumagali5555@gmail.com', 'mentorship'),
    ('bajbosynovnurali@icloud.com', 'finance-external-affairs'),
    ('aizere088@mail.ru', 'volunteering'),
    ('avrgbsenjoyer@gmail.com', 'sport')
)
SELECT approved.email,
       approved.slug AS expected_department,
       u.name,
       d.name AS department,
       m.role,
       m.status,
       CASE
         WHEN u.id IS NULL THEN 'ACCOUNT_NOT_FOUND'
         WHEN d.id IS NULL THEN 'DEPARTMENT_NOT_FOUND'
         WHEN m.role = 'MINISTER' AND m.status = 'ACTIVE'
              AND u."registrationDepartmentId" = d.id THEN 'OK'
         ELSE 'NOT_ASSIGNED'
       END AS result
FROM approved
LEFT JOIN "User" u ON lower(u.email) = lower(approved.email) AND u."isDemo" = false
LEFT JOIN "Department" d ON d."schoolId" = u."schoolId" AND d.slug = approved.slug
LEFT JOIN "Membership" m ON m."userId" = u.id AND m."departmentId" = d.id
ORDER BY approved.slug;
