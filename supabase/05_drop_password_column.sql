-- =============================================================================
-- GOFT3 — 05: حذف عمود T_USER.PASSWORD (الخطوة الأخيرة)
--
-- ⚠ ترتيب التنفيذ إلزامي:
--   1. ثبّت إصدار التطبيق الجديد على كل الأجهزة (الذي يستعمل
--      verify_login / set_user_password).
--   2. تأكد أن كل مستخدم سجّل الدخول مرة واحدة على الأقل على الجهاز/الأجهزة
--      التي سيستعملها في الوضع المحلي (انظر «كيف يعمل الدخول دون اتصال» أدناه).
--   3. نفّذ هذا الملف.
--
-- تنفيذه قبل الخطوة 1 يعطّل تسجيل الدخول في الإصدار القديم، لأن الإصدار القديم
-- يقرأ T_USER.PASSWORD مباشرة.
--
-- كيف يعمل الدخول دون اتصال بعد الحذف:
--   لم يعد السحابة تحمل أي تجزئة. كل جهاز يحتفظ بتجزئة محلية خاصة به في
--   goft3_local.db (عمود T_USER.PASSWORD المحلي) تُكتب في لحظتين فقط:
--     • نجاح تسجيل دخول عبر الإنترنت (المستخدم أثبت معرفته بكلمة المرور).
--     • تعيين كلمة مرور من ذلك الجهاز نفسه.
--   من لم يسجّل الدخول على جهاز ما، ولم تُعيَّن كلمته عليه، يحتاج اتصالًا واحدًا
--   أولًا (الرسالة في شاشة الدخول تشرح ذلك).
-- =============================================================================

BEGIN;

-- 1) إعادة مزامنة أخيرة: تلتقط أي كلمة مرور عُدّلت من الإصدار القديم بعد
--    تنفيذ 03 (الذي كان يستعمل ON CONFLICT DO NOTHING، أي صورة واحدة فقط).
INSERT INTO public.T_USER_SECRET (ID_USER, PASSWORD, UPDATED_AT)
SELECT ID_USER, PASSWORD, now() FROM public.T_USER
ON CONFLICT (ID_USER) DO UPDATE
   SET PASSWORD   = excluded.PASSWORD,
       UPDATED_AT = now();

-- 2) حاجز أمان: لا حذف إذا بقي أي مستخدم بلا تجزئة.
DO $$
DECLARE
  v_missing integer;
BEGIN
  SELECT count(*) INTO v_missing
    FROM public.T_USER u
    LEFT JOIN public.T_USER_SECRET s ON s.ID_USER = u.ID_USER
   WHERE s.ID_USER IS NULL OR s.PASSWORD IS NULL OR s.PASSWORD = '';

  IF v_missing > 0 THEN
    RAISE EXCEPTION
      'ABORT: % مستخدمًا بلا تجزئة في T_USER_SECRET — الحذف سيُقفل عليهم الدخول.', v_missing;
  END IF;
END $$;

-- 3) الحذف نفسه.
ALTER TABLE public.T_USER DROP COLUMN PASSWORD;

COMMIT;

-- PostgREST يخزّن مخطط الجداول مؤقتًا؛ هذا يجعله يقرأ الشكل الجديد فورًا.
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- تحقق بعد التنفيذ:
--
--   -- يجب أن يفشل: العمود لم يعد موجودًا
--   -- SELECT PASSWORD FROM public.T_USER LIMIT 1;
--
--   -- يجب أن يُرجع صفًا (اسم مستخدم موجود وكلمة مروره صحيحة)
--   SELECT public.verify_login('<username>', '<password>');
--
-- للتراجع (الطريقة اليدوية الوحيدة — التجزئات ما زالت في T_USER_SECRET):
--
--   ALTER TABLE public.T_USER ADD COLUMN PASSWORD text NOT NULL DEFAULT '';
--   UPDATE public.T_USER u SET PASSWORD = s.PASSWORD
--     FROM public.T_USER_SECRET s WHERE s.ID_USER = u.ID_USER;
--   ALTER TABLE public.T_USER ALTER COLUMN PASSWORD DROP DEFAULT;
-- =============================================================================
