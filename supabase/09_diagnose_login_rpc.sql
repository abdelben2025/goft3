-- =============================================================================
-- GOFT3 — 09: دالة تشخيص تسجيل الدخول (مؤقتة)
--
-- المشكلة: verify_login تُرجع NULL في ثلاث حالات متطابقة من خارج القاعدة:
--   1. لا يوجد مستخدم بهذا الاسم في T_USER
--   2. يوجد مستخدم لكن T_USER_SECRET بلا تجزئة (أو تجزئته فارغة)
--   3. التجزئة موجودة والكلمة غير مطابقة
-- لا يمكن التمييز بينها من التطبيق، فيظهر للمستخدم رسالة واحدة لا تُفيد.
--
-- هذه الدالة تعيد الحالة الفعلية (بلا أي تجزئة) كي تعرض شاشة الدخول السبب.
-- لا تكشف أي سر: تُرجع حالة نصية وعددًا فقط، ولا تعيد hash ولا طوله الكامل.
--
-- نفّذ هذا الملف مرة واحدة. للتخلص منه بعد انتهاء الترحيل، نفّذ آخر سطرين.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.diag_login(p_username text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $fn$
DECLARE
  v_user public.T_USER;
  v_hash text;
BEGIN
  SELECT * INTO v_user
    FROM public.T_USER
   WHERE lower(btrim(USERNAME)) = lower(btrim(p_username))
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'USER_FOUND',        false,
      'TOTAL_USERS',       (SELECT count(*) FROM public.T_USER),
      'SECRET_ROWS',       (SELECT count(*) FROM public.T_USER_SECRET),
      'HAS_PASSWORD_COLUMN', EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name   = 'T_USER'
             AND column_name  = 'PASSWORD')
    );
  END IF;

  SELECT PASSWORD INTO v_hash
    FROM public.T_USER_SECRET
   WHERE ID_USER = v_user.ID_USER;

  RETURN jsonb_build_object(
    'USER_FOUND',        true,
    'ID_USER',           v_user.ID_USER,
    'SECRET',            CASE
                           WHEN v_hash IS NULL              THEN 'MISSING'
                           WHEN v_hash = ''                 THEN 'EMPTY'
                           WHEN v_hash ~ '^[$]2[aby][$][0-9]{2}[$]' THEN 'OK'
                           ELSE 'CORRUPT'
                         END,
    'TOTAL_USERS',       (SELECT count(*) FROM public.T_USER),
    'SECRET_ROWS',       (SELECT count(*) FROM public.T_USER_SECRET),
    'HAS_PASSWORD_COLUMN', EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name   = 'T_USER'
           AND column_name  = 'PASSWORD')
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.diag_login(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.diag_login(text) TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- بعد نجاح الترحيل (دخول حقيقي واحد على الأقل): أزل الدالة، فهي أداة تشخيص
-- وليست جزءًا من التطبيق.
--
--   REVOKE ALL ON FUNCTION public.diag_login(text) FROM anon, authenticated;
--   DROP FUNCTION IF EXISTS public.diag_login(text);
-- =============================================================================
