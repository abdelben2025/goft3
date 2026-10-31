-- =============================================================================
-- GOFT3 — 03: عزل كلمات المرور (Supabase / PostgreSQL)
--
-- يُنفَّذ بعد 02_indexes.sql. لا يُغيّر سلوك التطبيق الحالي:
-- ينسخ تجزئات T_USER.PASSWORD إلى جدول T_USER_SECRET غير القابل للقراءة
-- بمفتاح anon، ويضيف دالتين للتحقق والتعيين داخل القاعدة.
--
-- لماذا: التطبيق يتصل بـ Supabase بمفتاح anon فقط (لا جلسة مصادقة)، لذا لا
-- تستطيع سياسات RLS التمييز بين admin و viewer: أي سياسة تسمح للتطبيق بالعمل
-- تسمح أيضًا لأي حامل للمفتاح بالعمل. الحماية الممكنة اليوم هي إخراج التجزئات
-- من الجداول التي يقرأها العميل، والتحقق منها داخل القاعدة.
--
-- المطلوب لاحقًا (تعديل واجهة منفصل):
--   • LoginPage:     supabase.rpc('verify_login',      { p_username, p_password })
--   • UsersPage:     supabase.rpc('set_user_password', { p_id_user, p_password })
--   • بعده فقط:      ALTER TABLE public.T_USER DROP COLUMN PASSWORD;
--
-- تنبيه: set_user_password متاحة لأي حامل لمفتاح anon — نفس مستوى التعرض الحالي
-- (اليوم يمكن لأي حامل للمفتاح تعديل T_USER.PASSWORD مباشرة). تُلغى هذه الثغرة
-- نهائيًا فقط بالانتقال إلى Supabase Auth.
-- =============================================================================

BEGIN;

-- pgcrypto يوفّر crypt()/gen_salt() (bcrypt) داخل القاعدة.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.T_USER_SECRET (
  ID_USER integer NOT NULL,
  PASSWORD text NOT NULL,
  UPDATED_AT timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT T_USER_SECRET_pkey PRIMARY KEY (ID_USER),
  CONSTRAINT T_USER_SECRET_ID_USER_fkey FOREIGN KEY (ID_USER)
    REFERENCES public.T_USER (ID_USER) ON DELETE CASCADE
);

-- RLS مفعّل بدون أي سياسة + سحب الصلاحيات ⇒ لا قراءة ولا كتابة بمفتاح anon.
ALTER TABLE public.T_USER_SECRET ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.T_USER_SECRET FROM anon, authenticated;

-- ترحيل التجزئات الموجودة. تُنفَّذ مرة واحدة قبل تحويل التطبيق إلى verify_login.
INSERT INTO public.T_USER_SECRET (ID_USER, PASSWORD)
SELECT ID_USER, PASSWORD FROM public.T_USER
ON CONFLICT (ID_USER) DO NOTHING;

-- التحقق من بيانات الدخول دون إرجاع التجزئة أبدًا.
-- تُرجع صف المستخدم (بدون كلمة المرور) عند النجاح، و NULL عند الفشل.
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

-- تعيين/تغيير كلمة مرور: التجزئة تُحسب في القاعدة (bcrypt cost 10) فلا تعود
-- التجزئة تنتقل عبر الشبكة أبدًا.
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

COMMIT;

-- =============================================================================
-- تحقق بعد التنفيذ (شغّل هذه الأسطر منفصلة):
--
--   -- 1) عدد التجزئات يجب أن يساوي عدد المستخدمين
--   SELECT (SELECT count(*) FROM public.T_USER)        AS users,
--          (SELECT count(*) FROM public.T_USER_SECRET) AS secrets;
--
--   -- 2) الدالتان موجودتان
--   SELECT proname, prosecdef FROM pg_proc
--    WHERE proname IN ('verify_login', 'set_user_password');
--
-- =============================================================================

-- =============================================================================
-- ملحق: إعادة مزامنة T_USER_SECRET (تُنفّذ مرة واحدة قبل تحويل الواجهة)
--
-- السبب: الترحيل أعلاه يستعمل ON CONFLICT DO NOTHING، فهو صورة واحدة من لحظة
-- التنفيذ. كل تغيير لكلمة المرور من داخل التطبيق بعد ذلك يكتب في T_USER.PASSWORD
-- فقط، فتتخلّف T_USER_SECRET عن الحقيقة. إن حُوّل تسجيل الدخول إلى verify_login
-- قبل إعادة المزامنة، يخسر هؤلاء المستخدمون الدخول.
--
-- هذا الملحق لا يعمل شيئًا إذا لم تتغيّر أي كلمة مرور بين التنفيذين.
-- نفّذه مباشرة قبل تغيير الواجهة، وليس قبل ذلك.
-- =============================================================================
--
-- INSERT INTO public.T_USER_SECRET (ID_USER, PASSWORD, UPDATED_AT)
-- SELECT ID_USER, PASSWORD, now() FROM public.T_USER
-- ON CONFLICT (ID_USER) DO UPDATE
--    SET PASSWORD   = excluded.PASSWORD,
--        UPDATED_AT = now();
