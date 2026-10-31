-- =============================================================================
-- GOFT3 — 06: تشخيص سبب رفض تسجيل الدخول (قراءة فقط)
--
-- شغّل كل استعلام منفصلًا في محرر SQL في Supabase واقرأ نتيجته.
-- هذا الملف لا يعدّل أي شيء — الإصلاح في 07_repair_login.sql.
-- =============================================================================

-- 1) هل عمود T_USER.PASSWORD ما زال موجودًا؟
--    النتيجة الفارغة ⇒ نُفّذ 05 والحذف تم.
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   = 'T_USER'
 ORDER BY ordinal_position;

-- 2) حالة بيانات الدخول لكل مستخدم:
--    MISSING    ⇒ لا صف في T_USER_SECRET ⇒ verify_login تُرجع NULL دائمًا
--    EMPTY      ⇒ بديل مؤقت ('') خزّنه التطبيق قبل تعيين كلمة مرور حقيقية
--    BCRYPT     ⇒ صالحة
--    NOT_BCRYPT ⇒ قيمة غير صالحة (نص عادي أو تالفة)
SELECT u.ID_USER,
       u.USERNAME,
       u.ROLE,
       (s.ID_USER IS NOT NULL) AS has_secret,
       CASE
         WHEN s.ID_USER IS NULL                   THEN 'MISSING'
         WHEN coalesce(s.PASSWORD, '') = ''       THEN 'EMPTY'
         WHEN s.PASSWORD ~ '^[$]2[aby][$][0-9]{2}[$]' THEN 'BCRYPT'
         ELSE 'NOT_BCRYPT'
       END AS hash_state,
       s.UPDATED_AT
  FROM public.T_USER u
  LEFT JOIN public.T_USER_SECRET s ON s.ID_USER = u.ID_USER
 ORDER BY u.ID_USER;

-- 3) هل الدالتان موجودتان؟ prosecdef=true مطلوب (SECURITY DEFINER).
--    صفر صفوف ⇒ التطبيق يفشل بـ «دالة غير موجودة» قبل أن يتحقق من كلمة المرور.
SELECT p.proname, p.prosecdef AS security_definer
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN ('verify_login', 'set_user_password');

-- 4) pgcrypto: يجب أن يوجد مخطط واحد على الأقل (extensions أو public)،
--    لأن بحث verify_login يمر عليهما (SET search_path).
SELECT e.extname, n.nspname AS schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
 WHERE e.extname = 'pgcrypto';

-- 5) اختبار مباشر: يجب أن يُرجع NULL (كلمة مرور خاطئة) وليس خطأ.
--    خطأ هنا ⇒ المشكلة في الدالة/التجزئة، لا في التطبيق.
SELECT public.verify_login('admin', 'definitely-wrong-password');

-- 6) اختبار بمستخدم موجود فعلًا + كلمة مروره الحقيقية:
--    يُرجع صفًا (ID_USER/USERNAME/ROLE) ⇒ الدخول يعمل على مستوى القاعدة،
--    والمشكلة عندئذ في التطبيق (إصدار قديم أو offline أو مفتاح خاطئ).
-- SELECT public.verify_login('<username>', '<password>');

-- 7) الحكم النهائي — استعلام واحد لكل المستخدمين:
--    secret_state    : حالة بيانات الدخول (OK يجب أن تكون للجميع)
--    accepts_admin123: هل التجزئة المخزّنة هي كلمة المرور الافتراضية admin123؟
--    accepts_admin   : هل يقبل المدخل «admin» (للتأكد من تشابه الأسماء)
--
--    accepts_admin123 = true ⇒ البيانات سليمة؛ المسجّل يدخل بكلمة المرور
--    الافتراضية admin123 (وليست admin)، وعليه تغييرها فورًا بعد الدخول.
SELECT u.ID_USER,
       u.USERNAME,
       u.ROLE,
       CASE
         WHEN s.ID_USER IS NULL                   THEN 'NO_SECRET'
         WHEN coalesce(s.PASSWORD, '') = ''       THEN 'EMPTY_SECRET'
         WHEN s.PASSWORD ~ '^[$]2[aby][$][0-9]{2}[$]' THEN 'OK'
         ELSE 'CORRUPT'
       END AS secret_state,
       public.verify_login(u.USERNAME, 'admin123') IS NOT NULL AS accepts_admin123,
       public.verify_login(u.USERNAME, 'admin')    IS NOT NULL AS accepts_admin
  FROM public.T_USER u
  LEFT JOIN public.T_USER_SECRET s ON s.ID_USER = u.ID_USER
 ORDER BY u.ID_USER;
