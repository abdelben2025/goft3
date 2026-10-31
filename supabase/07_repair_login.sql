-- =============================================================================
-- GOFT3 — 07: إصلاح تسجيل الدخول
--
-- يُنفّذ بعد 06_diagnose_login.sql. يعالج أكثر سببين واقعيين لرفض الدخول:
--
--   1. تخلّف T_USER_SECRET عن T_USER.PASSWORD — الترحيل في 03 كان
--      ON CONFLICT DO NOTHING (صورة واحدة من لحظة التنفيذ)، فأي كلمة مرور
--      عُدّلت بعد ذلك من الإصدار القديم لم تصل إلى T_USER_SECRET، وصاحبها
--      يخسر الدخول بعد تحويل الواجهة إلى verify_login.
--   2. تجزئة فارغة ('') لصفوف كُتبت ببديل مؤقت قبل تعيين كلمة مرور حقيقية.
--
-- ويعيد نشر verify_login بنسختها المحصّنة (تتجاهل التجزئة الفارغة بدل أن
-- تُخطئ)، مطابقة لـ 03_password_hardening.sql و services/dbSchema.ts.
--
-- لا يحذف أي كلمة مرور صالحة: ينسخ من T_USER.PASSWORD إن كان العمود موجودًا.
-- =============================================================================

BEGIN;

-- 1) النسخة المحصّنة من verify_login.
CREATE OR REPLACE FUNCTION public.verify_login(p_username text, p_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $fn$
DECLARE
  v_user public.T_USER;
  v_hash text;
BEGIN
  SELECT * INTO v_user FROM public.T_USER
   WHERE lower(btrim(USERNAME)) = lower(btrim(p_username))
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT PASSWORD INTO v_hash
    FROM public.T_USER_SECRET
   WHERE ID_USER = v_user.ID_USER;

  -- تجزئة فارغة أو تالفة (صفوف كُتبت ببديل مؤقت قبل تعيين كلمة المرور)
  -- ليست خطأً بل «لا بيانات دخول»: crypt() يرفع استثناءً على مِلح غير صالح،
  -- فيظهر للمستخدم «خطأ في التحقق» بدل «بيانات غير صحيحة». bcrypt دائمًا 60 حرفًا.
  IF v_hash IS NULL OR length(v_hash) < 59 THEN
    RETURN NULL;
  END IF;

  -- bcrypt-ts يُنتج البادئة $2b$ (وأحيانًا $2y$)، وpgcrypto يفهم $2a$ فقط.
  -- البادئات الثلاث تصف نفس الخوارزمية بنفس المِلح والجولات، فالاستبدال آمن.
  v_hash := regexp_replace(v_hash, '^\$2[by]\$', '$2a$');

  IF crypt(p_password, v_hash) IS DISTINCT FROM v_hash THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'ID_USER', v_user.ID_USER,
    'USERNAME', v_user.USERNAME,
    'ROLE', v_user.ROLE,
    'ALLOWED_PAGES', v_user.ALLOWED_PAGES,
    'ALLOWED_OPERATIONS', v_user.ALLOWED_OPERATIONS,
    -- التجزئة الافتراضية المزروعة (admin123) ⇒ على الواجهة إجبار التغيير.
    -- تُحسب هنا لأن العميل لم يعد يرى التجزئة أبدًا.
    'NEEDS_PASSWORD_CHANGE',
      (v_hash = regexp_replace('$2b$10$rA9vBL8p087PyWkp4gge1OkLV2tTLhb.ABfM2k/b.LlpyLoaKM68C', '^\$2[by]\$', '$2a$'))
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.verify_login(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_login(text, text) TO anon, authenticated;

-- 1b) النسخة المحصّنة من set_user_password — تُضيف حاجز «مستخدم غير موجود»
--     بدل مفتاح أجنبي لا يشرح السبب.
CREATE OR REPLACE FUNCTION public.set_user_password(p_id_user integer, p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $fn$
BEGIN
  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'PASSWORD_TOO_SHORT' USING HINT = 'Minimum 8 characters';
  END IF;

  -- لا تجزئة لمستخدم غير موجود: بدونه يفشل الإدراج بمفتاح أجنبي لا يشرح
  -- السبب (صف موجود على جهاز واحد فقط، أو حُذف من T_USER قبل هذا الاستدعاء).
  IF NOT EXISTS (SELECT 1 FROM public.T_USER WHERE ID_USER = p_id_user) THEN
    RAISE EXCEPTION 'USER_NOT_FOUND'
      USING HINT = 'ID_USER غير موجود في T_USER — قد يكون الصف محليًا فقط';
  END IF;

  INSERT INTO public.T_USER_SECRET (ID_USER, PASSWORD, UPDATED_AT)
  VALUES (p_id_user, crypt(p_password, gen_salt('bf', 10)), now())
  ON CONFLICT (ID_USER) DO UPDATE
     SET PASSWORD = excluded.PASSWORD,
         UPDATED_AT = now();
END;
$fn$;

REVOKE ALL ON FUNCTION public.set_user_password(integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_user_password(integer, text) TO anon, authenticated;

-- 2) إعادة مزامنة T_USER_SECRET — فقط إذا كان العمود لم يُحذف بعد.
DO $$
DECLARE
  v_has_column boolean;
  v_synced     integer;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'T_USER'
       AND column_name  = 'PASSWORD'
  ) INTO v_has_column;

  IF NOT v_has_column THEN
    RAISE NOTICE 'T_USER.PASSWORD محذوف (نُفّذ 05) — لا شيء لمزامنته.';
    RETURN;
  END IF;

  INSERT INTO public.T_USER_SECRET (ID_USER, PASSWORD, UPDATED_AT)
  SELECT ID_USER, PASSWORD, now()
    FROM public.T_USER
   WHERE PASSWORD IS NOT NULL AND PASSWORD <> ''
  ON CONFLICT (ID_USER) DO UPDATE
     SET PASSWORD   = excluded.PASSWORD,
         UPDATED_AT = now();

  GET DIAGNOSTICS v_synced = ROW_COUNT;
  RAISE NOTICE 'تمت مزامنة % تجزئة من T_USER.PASSWORD.', v_synced;
END $$;

COMMIT;

-- PostgREST يخزّن مخطط الدوال مؤقتًا؛ هذا يجعله يرى النسخة الجديدة فورًا.
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- 3) ما تبقّى بلا بيانات دخول صالحة — يجب أن تكون النتيجة فارغة.
--    كل صف يظهر هنا يحتاج تعيين كلمة مرور من داخل التطبيق (أو بالاستعلام 4).
-- =============================================================================
SELECT u.ID_USER,
       u.USERNAME,
       CASE WHEN s.ID_USER IS NULL             THEN 'MISSING'
            WHEN coalesce(s.PASSWORD, '') = '' THEN 'EMPTY'
            ELSE 'OK' END AS state
  FROM public.T_USER u
  LEFT JOIN public.T_USER_SECRET s ON s.ID_USER = u.ID_USER
 WHERE s.ID_USER IS NULL OR coalesce(s.PASSWORD, '') = '';

-- =============================================================================
-- 4) إن بقي مستخدم بلا بيانات دخول — أو نسيت كلمة مرور admin — عيّن واحدة
--    مؤقتة ثم غيّرها من داخل التطبيق (الطول الأدنى 8 محارف):
--
--   SELECT public.set_user_password(ID_USER, 'GOFT3-temp-2026')
--     FROM public.T_USER WHERE USERNAME = 'admin';
--
--    وحين تظهر جلسة مفتوحة تنتهي هذه المشكلة نهائيًا: set_user_password تكتب
--    في T_USER_SECRET مباشرة، فلا حاجة لأي مزامنة يدوية بعدها.
-- =============================================================================
