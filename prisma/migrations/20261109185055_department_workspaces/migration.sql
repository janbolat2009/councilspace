-- Additive migration. No users, memberships or historical work are deleted or reset.
ALTER TABLE "User" ADD COLUMN "registrationDepartmentId" TEXT;
CREATE UNIQUE INDEX "Department_id_schoolId_key" ON "Department"("id", "schoolId");
CREATE INDEX "User_registrationDepartmentId_idx" ON "User"("registrationDepartmentId");
ALTER TABLE "User" ADD CONSTRAINT "User_registrationDepartmentId_schoolId_fkey"
  FOREIGN KEY ("registrationDepartmentId", "schoolId") REFERENCES "Department"("id", "schoolId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep every existing department ID, name, public minister name, rate and work record.
INSERT INTO "Department" (id, "schoolId", slug, name, description)
SELECT 'dept_' || md5(s.id || ':' || d.slug), s.id, d.slug, d.name, d.description
FROM "School" s CROSS JOIN (VALUES
 ('intellectual-development', 'Интеллектуальное развитие', 'Развиваем любознательность, обмениваемся знаниями и создаём пространство для смелых идей.'),
 ('sport', 'Спорт', 'Организуем тренировки, соревнования и поддерживаем активную школьную жизнь.'),
 ('volunteering', 'Волонтёрство', 'Помогаем людям и объединяем школу вокруг добрых дел.'),
 ('mentorship', 'Менторство', 'Делимся опытом, поддерживаем учеников и учимся друг у друга.'),
 ('finance-external-affairs', 'Финансы и External Affairs', 'Планируем ресурсы, развиваем партнёрства и внешние связи совета.'),
 ('mass-media', 'Масс-медиа', 'Рассказываем о школьной жизни через тексты, фото, видео и дизайн.'),
 ('management', 'Менеджмент', 'Координируем проекты, команды и организацию школьных мероприятий.')
) AS d(slug, name, description)
ON CONFLICT ("schoolId", slug) DO NOTHING;

INSERT INTO "Channel" (id, "departmentId", name, announcements)
SELECT 'channel_' || md5(d.id || ':' || c.name), d.id, c.name, c.announcements
FROM "Department" d CROSS JOIN (VALUES ('General', false), ('Announcements', true)) AS c(name, announcements)
ON CONFLICT ("departmentId", name) DO NOTHING;

-- Existing active membership takes precedence; unassigned legacy accounts stay with Intellectual Development.
-- This records their department without granting membership or changing a role/status.
UPDATE "User" u SET "registrationDepartmentId" = COALESCE(
 (SELECT m."departmentId" FROM "Membership" m JOIN "Department" d ON d.id=m."departmentId"
  WHERE m."userId"=u.id AND m.status='ACTIVE' AND d."schoolId"=u."schoolId" ORDER BY m."joinedAt", m.id LIMIT 1),
 (SELECT d.id FROM "Department" d WHERE d."schoolId"=u."schoolId" AND d.slug='intellectual-development')
) WHERE u."registrationDepartmentId" IS NULL;

-- NextAuth identities use the server API, not Supabase Auth JWTs. Close direct Data API access.
-- Prisma's trusted server connection still performs fresh membership checks on every operation.
DO $$
DECLARE table_name text; api_role text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['School','User','Account','Session','VerificationToken','AuthRateLimit',
    'Department','Membership','Application','Task','TaskAssignee','ChecklistItem','TaskComment',
    'Event','EventMember','EventGuest','Report','ReportDecision','LedgerEntry','Channel','Message',
    'ChannelRead','Notification','AuditLog','_prisma_migrations']
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', table_name);
      FOREACH api_role IN ARRAY ARRAY['anon','authenticated'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname=api_role) THEN
          EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', table_name, api_role);
        END IF;
      END LOOP;
    END IF;
  END LOOP;
END $$;
