-- =============================================================================
-- GOFT3 — 04: اختبار دخان لدالتي verify_login / set_user_password
--
-- آمن تمامًا: يُنشئ مستخدمًا وهميًا ثم يُلغي كل شيء بـ ROLLBACK.
-- لا يمس أي مستخدم حقيقي، ولا يترك أي أثر في الجداول.
--
-- الغرض: إثبات أن مسار bcrypt يعمل فعليًا — بما فيه تحويل البادئة $2b$ → $2a$
-- الذي كتبه تطبيق bcrypt-ts، قبل أن نغيّر LoginPage.
--
-- النتيجة المطلوبة: أربعة أسطر، كل سطر فيه result = expected.
-- =============================================================================

BEGIN;

CREATE TEMP TABLE goft3_test_results (
  test text,
  result text,
  expected text
) ON COMMIT DROP;

-- مستخدم وهمي بكلمة مرور مؤقتة (تُستبدل فورًا أدناه).
INSERT INTO public.T_USER (USERNAME, PASSWORD, ROLE)
VALUES ('__goft3_test__', 'PLACEHOLDER', 'viewer');

-- A) نحاكي ما يكتبه التطبيق اليوم: تجزئة $2b$ أنتجها bcrypt-ts لكلمة Test1234.
UPDATE public.T_USER
   SET PASSWORD = '$2b$10$OFwdR4oiZEz3Lu10KM6vJOOrFzgJmRjBkjCWvheugJMPGZ9UmCCMO'
 WHERE USERNAME = '__goft3_test__';

INSERT INTO public.T_USER_SECRET (ID_USER, PASSWORD)
SELECT ID_USER, PASSWORD FROM public.T_USER WHERE USERNAME = '__goft3_test__'
ON CONFLICT (ID_USER) DO UPDATE
   SET PASSWORD = excluded.PASSWORD, UPDATED_AT = now();

INSERT INTO goft3_test_results
SELECT 'A1 نص صحيح + تجزئة 2b',
       coalesce(public.verify_login('__goft3_test__', 'Test1234') ->> 'USERNAME', 'NULL'),
       '__goft3_test__'
UNION ALL
SELECT 'A2 نص خطأ + تجزئة 2b',
       coalesce(public.verify_login('__goft3_test__', 'Test9999')::text, 'NULL'),
       'NULL'
UNION ALL
SELECT 'A3 خوارزمية التجزئة المرحّلة',
       left((SELECT PASSWORD FROM public.T_USER_SECRET
              WHERE ID_USER = (SELECT ID_USER FROM public.T_USER
                                WHERE USERNAME = '__goft3_test__')), 7),
       '$2b$10$';

-- B) الآن عبر دالة التعيين: التجزئة تُحسب في القاعدة (يجب أن تصبح $2a$).
SELECT public.set_user_password(
  (SELECT ID_USER FROM public.T_USER WHERE USERNAME = '__goft3_test__'),
  'Second123'
);

INSERT INTO goft3_test_results
SELECT 'B1 نص صحيح بعد set_user_password',
       coalesce(public.verify_login('__goft3_test__', 'Second123') ->> 'USERNAME', 'NULL'),
       '__goft3_test__'
UNION ALL
SELECT 'B2 خوارزمية التجزئة من set_user_password',
       left((SELECT PASSWORD FROM public.T_USER_SECRET
              WHERE ID_USER = (SELECT ID_USER FROM public.T_USER
                                WHERE USERNAME = '__goft3_test__')), 7),
       '$2a$10$'
UNION ALL
SELECT 'B3 كلمة المرور القديمة بعد التغيير',
       coalesce(public.verify_login('__goft3_test__', 'Test1234')::text, 'NULL'),
       'NULL'
UNION ALL
SELECT 'B4 البحث بحروف كبيرة/فراغات',
       coalesce(public.verify_login('  __GOFT3_TEST__  ', 'Second123') ->> 'USERNAME', 'NULL'),
       '__goft3_test__';

SELECT test, result, expected, (result = expected) AS ok
  FROM goft3_test_results
 ORDER BY test;

ROLLBACK;
