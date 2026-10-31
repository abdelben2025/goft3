// هذا الملف يحتوي على كود SQL لإنشاء الجداول في Supabase (PostgreSQL).
//
// تنبيه: هذا ملف TypeScript، ولا يمكن لصقه في "SQL Editor" مباشرة — سيظهر
// الخطأ `syntax error at or near "export"` (42601).
// النسخ الجاهزة للصق موجودة في مجلد supabase/:
//   supabase/01_tables.sql             ← createTablesSQL
//   supabase/02_indexes.sql            ← createIndexesSQL
//   supabase/03_password_hardening.sql ← hardenSecuritySQL
// بعد أي تعديل هنا، يجب تحديث الملف المقابل حتى لا تختلف النسختان.
//
// ترتيب التطبيق:
//   1. createTablesSQL   — إنشاء الجداول (تشغيل أول مرة فقط).
//   2. createIndexesSQL  — الفهارس. آمنة على قاعدة تعمل، ولا تُغيّر أي سلوك.
//   3. hardenSecuritySQL — عزل كلمات المرور في جدول غير قابل للقراءة بمفتاح anon
//                          + دالة verify_login. لا تُغيّر سلوك التطبيق الحالي؛
//                          يلزمها تعديل الواجهة لتستعملها (انظر التعليقات أدناه).

export const createTablesSQL = `
CREATE TABLE public.T_USER (
  ID_USER integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  USERNAME text NOT NULL UNIQUE,
  PASSWORD text NOT NULL,
  ROLE text NOT NULL CHECK ("ROLE" = ANY (ARRAY['admin'::text, 'user'::text, 'viewer'::text])),
  ALLOWED_PAGES text,
  ALLOWED_OPERATIONS text,
  CONSTRAINT T_USER_pkey PRIMARY KEY (ID_USER)
);

CREATE TABLE public.T_BENEFICIAIRE (
  ID_BENEFICIAIRE integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  BENEFICIAIRE text NOT NULL,
  ADRESSE text NOT NULL,
  ACTIVITE text,
  RC text,
  CODE_FISCALE text,
  CONSTRAINT T_BENEFICIAIRE_pkey PRIMARY KEY (ID_BENEFICIAIRE)
);

CREATE TABLE public.T_COMPTE_BANCAIRE (
  ID_COMPTE integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  ID_BENEFICIAIRE integer NOT NULL,
  RIB text NOT NULL,
  BANQUE text NOT NULL,
  CONSTRAINT T_COMPTE_BANCAIRE_pkey PRIMARY KEY (ID_COMPTE),
  CONSTRAINT T_COMPTE_BANCAIRE_ID_BENEFICIAIRE_fkey FOREIGN KEY (ID_BENEFICIAIRE) REFERENCES public.T_BENEFICIAIRE(ID_BENEFICIAIRE)
);

CREATE TABLE public.T_CATEGORIE (
  ID_CATEGORIE integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  C_CATEGORIE text NOT NULL,
  INT_CATEGORIE text NOT NULL,
  CONSTRAINT T_CATEGORIE_pkey PRIMARY KEY (ID_CATEGORIE)
);

CREATE TABLE public.T_SCATEGORIE (
  ID_SCATEGORIE integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  ID_CATEGORIE integer NOT NULL,
  C_SCATEGORIE text NOT NULL,
  INT_SCATEGORIE text NOT NULL,
  CONSTRAINT T_SCATEGORIE_pkey PRIMARY KEY (ID_SCATEGORIE),
  CONSTRAINT T_SCATEGORIE_ID_CATEGORIE_fkey FOREIGN KEY (ID_CATEGORIE) REFERENCES public.T_CATEGORIE(ID_CATEGORIE)
);

CREATE TABLE public.T_OPERATION (
  ID_OPERATION integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  N_OPERATION text NOT NULL,
  N_OPERATION_ANCIEN text,
  INT_OPERATION text NOT NULL,
  ID_CATEGORIE integer NOT NULL,
  status text NOT NULL CHECK (status = ANY (ARRAY['جارية'::text, 'مغلقة'::text])),
  CREATED_BY numeric,
  ID_SCATEGORIE integer,
  TYPE_OP text,
  CONSTRAINT T_OPERATION_pkey PRIMARY KEY (ID_OPERATION),
  CONSTRAINT T_OPERATION_ID_CATEGORIE_fkey FOREIGN KEY (ID_CATEGORIE) REFERENCES public.T_CATEGORIE(ID_CATEGORIE),
  CONSTRAINT T_OPERATION_ID_SCATEGORIE_fkey FOREIGN KEY (ID_SCATEGORIE) REFERENCES public.T_SCATEGORIE(ID_SCATEGORIE)
);

CREATE TABLE public.T_RUBRIQUE (
  ID_RUBRIQUE integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  RUBRIQUE text NOT NULL,
  CONSTRAINT T_RUBRIQUE_pkey PRIMARY KEY (ID_RUBRIQUE)
);

CREATE TABLE public.T_PIECE (
  ID_PIECE integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  NAT_PIECE text NOT NULL,
  ID_PIECE_INIT integer,
  ID_OPERATION integer NOT NULL,
  PIECE text NOT NULL,
  ID_BENEFICIAIRE integer,
  ID_COMPTE integer,
  MONTANT_PIECE double precision NOT NULL,
  ID_SCATEGORIE integer NOT NULL,
  ID_RUBRIQUE integer,
  DELAI_EX_JOURS text,
  SAI_ENG boolean NOT NULL DEFAULT false,
  SAI_PAI boolean NOT NULL DEFAULT false,
  N_VISA_CM text,
  DATE_VISA_CM text,
  CAUTION text,
  TYPE_CAUTION text,
  CONSTRAINT T_PIECE_pkey PRIMARY KEY (ID_PIECE),
  CONSTRAINT T_PIECE_ID_PIECE_INIT_fkey FOREIGN KEY (ID_PIECE_INIT) REFERENCES public.T_PIECE(ID_PIECE),
  CONSTRAINT T_PIECE_ID_COMPTE_fkey FOREIGN KEY (ID_COMPTE) REFERENCES public.T_COMPTE_BANCAIRE(ID_COMPTE),
  CONSTRAINT T_PIECE_ID_RUBRIQUE_fkey FOREIGN KEY (ID_RUBRIQUE) REFERENCES public.T_RUBRIQUE(ID_RUBRIQUE),
  CONSTRAINT T_PIECE_ID_SCATEGORIE_fkey FOREIGN KEY (ID_SCATEGORIE) REFERENCES public.T_SCATEGORIE(ID_SCATEGORIE),
  CONSTRAINT T_PIECE_ID_OPERATION_fkey FOREIGN KEY (ID_OPERATION) REFERENCES public.T_OPERATION(ID_OPERATION),
  CONSTRAINT T_PIECE_ID_BENEFICIAIRE_fkey FOREIGN KEY (ID_BENEFICIAIRE) REFERENCES public.T_BENEFICIAIRE(ID_BENEFICIAIRE)
);

CREATE TABLE public.T_BORDEREAU (
  ID_BORDEREAU bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  ID_PIECE integer,
  N_BORDEREAU text,
  ANNEE text NOT NULL DEFAULT 'NULL'::text,
  DATE_BORDEREAU text,
  DESTINATAIRE text,
  DOCUMENTS_JOINTS text,
  COPIES_NOTE text,
  CONSTRAINT T_BORDEREAU_pkey PRIMARY KEY (ID_BORDEREAU)
);

CREATE TABLE public.T_ENGAGEMENT (
  ID_ENGAGEMENT integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  ID_OPERATION integer NOT NULL,
  ID_PIECE integer NOT NULL,
  N_ENG text NOT NULL,
  ANNEE text NOT NULL,
  NATURE_ENG text NOT NULL,
  OBJET_ENG text NOT NULL,
  MONTANT_ENG double precision NOT NULL,
  AE_ENG double precision NOT NULL,
  TOTAL_ENG_ANTERIEURE double precision NOT NULL,
  SOLDE_ANTERIEURE double precision NOT NULL,
  SOLDE_RELIQUAT double precision NOT NULL,
  DATE_ENG text,
  N_VISA_CB text,
  DATE_VISA_CB text,
  ID_BORDEREAU bigint,
  BORD_DOCS text,
  BORD_COPIES text,
  BORD_OBJET text,
  CONSTRAINT T_ENGAGEMENT_pkey PRIMARY KEY (ID_ENGAGEMENT),
  CONSTRAINT T_ENGAGEMENT_ID_BORDEREAU_fkey FOREIGN KEY (ID_BORDEREAU) REFERENCES public.T_BORDEREAU(ID_BORDEREAU),
  CONSTRAINT T_ENGAGEMENT_ID_OPERATION_fkey FOREIGN KEY (ID_OPERATION) REFERENCES public.T_OPERATION(ID_OPERATION),
  CONSTRAINT T_ENGAGEMENT_ID_PIECE_fkey FOREIGN KEY (ID_PIECE) REFERENCES public.T_PIECE(ID_PIECE)
);

CREATE TABLE public.T_PAIEMENT (
  ID_PAIEMENT integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  ID_OPERATION integer NOT NULL,
  ID_ENG integer NOT NULL,
  ID_PIECE integer NOT NULL,
  N_PAI text NOT NULL,
  ANNEE text NOT NULL,
  DATE_PAI text NOT NULL,
  OBJET_PAI text NOT NULL,
  MONTANT_PAI double precision NOT NULL,
  TOTAL_PAI double precision NOT NULL,
  N_MANDAT text,
  DATE_MANDAT text,
  DATE_ADMIS text,
  MONTANT_TRAVAUX_REALISES double precision,
  AVANCE_FORFAITAIRE double precision,
  AVANCE_APPROVISIONNEMENT double precision,
  RETENUE_GARANTIE double precision,
  PENALITE_RETARD double precision,
  AUTRE_DEDUCTION double precision,
  REMBOURSEMENT_AVANCE_FORFAITAIRE double precision,
  REMBOURSEMENT_AVANCE_APPROVISIONNEMENT double precision,
  CONSTRAINT T_PAIEMENT_pkey PRIMARY KEY (ID_PAIEMENT),
  CONSTRAINT T_PAIEMENT_ID_PIECE_fkey FOREIGN KEY (ID_PIECE) REFERENCES public.T_PIECE(ID_PIECE),
  CONSTRAINT T_PAIEMENT_ID_ENG_fkey FOREIGN KEY (ID_ENG) REFERENCES public.T_ENGAGEMENT(ID_ENGAGEMENT),
  CONSTRAINT T_PAIEMENT_ID_OPERATION_fkey FOREIGN KEY (ID_OPERATION) REFERENCES public.T_OPERATION(ID_OPERATION)
);

CREATE TABLE public.T_CP (
  ID_CP integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  ID_OPERATION integer NOT NULL,
  ANNEE text NOT NULL,
  MONTANT_INITIALE_CP double precision NOT NULL,
  MONTANT_FINALE_CP double precision NOT NULL,
  CONSTRAINT T_CP_pkey PRIMARY KEY (ID_CP),
  CONSTRAINT T_CP_ID_OPERATION_fkey FOREIGN KEY (ID_OPERATION) REFERENCES public.T_OPERATION(ID_OPERATION)
);

CREATE TABLE public.T_LOT_OPERATION (
  ID_LOT integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  ID_OPERATION integer NOT NULL,
  N_LOT text NOT NULL,
  INTITULE_LOT text NOT NULL,
  MONTANT_INITIALE_LOT double precision NOT NULL,
  MONTANT_FINALE_LOT double precision NOT NULL,
  ATTRIBUER boolean NOT NULL DEFAULT false,
  CONSTRAINT T_LOT_OPERATION_pkey PRIMARY KEY (ID_LOT),
  CONSTRAINT T_LOT_OPERATION_ID_OPERATION_fkey FOREIGN KEY (ID_OPERATION) REFERENCES public.T_OPERATION(ID_OPERATION)
);

CREATE TABLE public.T_LOT_PIECE (
  ID_LOT_PIECE integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  ID_LOT integer NOT NULL,
  ID_PIECE integer NOT NULL,
  DELAI_EX_JOURS text,
  CONSTRAINT T_LOT_PIECE_pkey PRIMARY KEY (ID_LOT_PIECE),
  CONSTRAINT T_LOT_PIECE_ID_LOT_fkey FOREIGN KEY (ID_LOT) REFERENCES public.T_LOT_OPERATION(ID_LOT),
  CONSTRAINT T_LOT_PIECE_ID_PIECE_fkey FOREIGN KEY (ID_PIECE) REFERENCES public.T_PIECE(ID_PIECE)
);

CREATE TABLE public.T_RUBRIQUE_OP (
  ID_RUBRIQUE_OP integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  ID_OPERATION integer NOT NULL,
  ID_RUBRIQUE integer NOT NULL,
  MONTANT_INITIALE double precision NOT NULL,
  MONTANT_FINALE double precision,
  CONSTRAINT T_RUBRIQUE_OP_pkey PRIMARY KEY (ID_RUBRIQUE_OP),
  CONSTRAINT T_RUBRIQUE_OP_ID_OPERATION_fkey FOREIGN KEY (ID_OPERATION) REFERENCES public.T_OPERATION(ID_OPERATION),
  CONSTRAINT T_RUBRIQUE_OP_ID_RUBRIQUE_fkey FOREIGN KEY (ID_RUBRIQUE) REFERENCES public.T_RUBRIQUE(ID_RUBRIQUE)
);

CREATE TABLE public.T_SCATEGORIE_OP (
  ID_SCATEGORIE_OP integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  ID_OPERATION integer NOT NULL,
  ID_SCATEGORIE integer NOT NULL,
  MONTANT_INITIALE double precision NOT NULL,
  MONTANT_FINALE double precision,
  CONSTRAINT T_SCATEGORIE_OP_pkey PRIMARY KEY (ID_SCATEGORIE_OP),
  CONSTRAINT T_SCATEGORIE_OP_ID_SCATEGORIE_fkey FOREIGN KEY (ID_SCATEGORIE) REFERENCES public.T_SCATEGORIE(ID_SCATEGORIE),
  CONSTRAINT T_SCATEGORIE_OP_ID_OPERATION_fkey FOREIGN KEY (ID_OPERATION) REFERENCES public.T_OPERATION(ID_OPERATION)
);

CREATE TABLE public.T_ODS (
  ID_ODS integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  OBJET_ODS text NOT NULL,
  NATURE_ODS text NOT NULL,
  DATE_ODS text NOT NULL,
  ID_PIECE integer NOT NULL,
  ID_LOT integer,
  CONSTRAINT T_ODS_pkey PRIMARY KEY (ID_ODS),
  CONSTRAINT T_ODS_ID_LOT_fkey FOREIGN KEY (ID_LOT) REFERENCES public.T_LOT_OPERATION(ID_LOT),
  CONSTRAINT T_ODS_ID_PIECE_fkey FOREIGN KEY (ID_PIECE) REFERENCES public.T_PIECE(ID_PIECE)
);

CREATE TABLE public.T_DIRECTION (
  ID_DIRECTION integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  PORTEFEUILLE text NOT NULL,
  INT_PORTEFEUILLE text NOT NULL,
  ORDONATEUR text NOT NULL,
  DIRECTION text NOT NULL,
  ACTION text NOT NULL,
  INT_ACTION text NOT NULL,
  SACTION text,
  INT_SACTION text,
  CONSTRAINT T_DIRECTION_pkey PRIMARY KEY (ID_DIRECTION)
);

CREATE TABLE public.T_PROGRAMME (
  ID_PROGRAMME integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  PROGRAMME text NOT NULL,
  INT_PROGRAMME text NOT NULL,
  CONSTRAINT T_PROGRAMME_pkey PRIMARY KEY (ID_PROGRAMME)
);

CREATE TABLE public.T_SPROGRAMME (
  ID_SPROGRAMME integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  ID_PROGRAMME integer NOT NULL,
  SPROGRAMME text NOT NULL,
  INT_SPROGRAMME text NOT NULL,
  CONSTRAINT T_SPROGRAMME_pkey PRIMARY KEY (ID_SPROGRAMME),
  CONSTRAINT T_SPROGRAMME_ID_PROGRAMME_fkey FOREIGN KEY (ID_PROGRAMME) REFERENCES public.T_PROGRAMME(ID_PROGRAMME)
);`;

// ─────────────────────────────────────────────────────────────────────────────
// 2) الفهارس
//    PostgreSQL لا يُنشئ فهارس تلقائيًا على أعمدة المفاتيح الأجنبية، وكل صفحات
//    التقارير تفلتر بـ ID_OPERATION / ID_PIECE / ID_ENG / ID_PAIEMENT / ID_RUBRIQUE.
//    بدون هذه الفهارس يتحوّل كل تقرير إلى مسح كامل للجدول.
//    IF NOT EXISTS ⇒ قابلة للتشغيل أكثر من مرة دون ضرر.
// ─────────────────────────────────────────────────────────────────────────────
export const createIndexesSQL = `
CREATE INDEX IF NOT EXISTS idx_compte_banque_benef     ON public.T_COMPTE_BANCAIRE (ID_BENEFICIAIRE);
CREATE INDEX IF NOT EXISTS idx_scategorie_categorie    ON public.T_SCATEGORIE (ID_CATEGORIE);

CREATE INDEX IF NOT EXISTS idx_operation_categorie     ON public.T_OPERATION (ID_CATEGORIE);
CREATE INDEX IF NOT EXISTS idx_operation_scategorie    ON public.T_OPERATION (ID_SCATEGORIE);

CREATE INDEX IF NOT EXISTS idx_piece_operation         ON public.T_PIECE (ID_OPERATION);
CREATE INDEX IF NOT EXISTS idx_piece_piece_init        ON public.T_PIECE (ID_PIECE_INIT);
CREATE INDEX IF NOT EXISTS idx_piece_beneficiaire      ON public.T_PIECE (ID_BENEFICIAIRE);
CREATE INDEX IF NOT EXISTS idx_piece_compte            ON public.T_PIECE (ID_COMPTE);
CREATE INDEX IF NOT EXISTS idx_piece_scategorie        ON public.T_PIECE (ID_SCATEGORIE);
CREATE INDEX IF NOT EXISTS idx_piece_rubrique          ON public.T_PIECE (ID_RUBRIQUE);

CREATE INDEX IF NOT EXISTS idx_bordereau_piece         ON public.T_BORDEREAU (ID_PIECE);

CREATE INDEX IF NOT EXISTS idx_engagement_operation    ON public.T_ENGAGEMENT (ID_OPERATION);
CREATE INDEX IF NOT EXISTS idx_engagement_piece        ON public.T_ENGAGEMENT (ID_PIECE);
CREATE INDEX IF NOT EXISTS idx_engagement_bordereau    ON public.T_ENGAGEMENT (ID_BORDEREAU);
CREATE INDEX IF NOT EXISTS idx_engagement_annee        ON public.T_ENGAGEMENT (ID_OPERATION, ANNEE);

CREATE INDEX IF NOT EXISTS idx_paiement_operation      ON public.T_PAIEMENT (ID_OPERATION);
CREATE INDEX IF NOT EXISTS idx_paiement_engagement     ON public.T_PAIEMENT (ID_ENG);
CREATE INDEX IF NOT EXISTS idx_paiement_piece          ON public.T_PAIEMENT (ID_PIECE);
CREATE INDEX IF NOT EXISTS idx_paiement_annee          ON public.T_PAIEMENT (ID_OPERATION, ANNEE);

CREATE INDEX IF NOT EXISTS idx_cp_operation            ON public.T_CP (ID_OPERATION, ANNEE);
CREATE INDEX IF NOT EXISTS idx_lot_operation           ON public.T_LOT_OPERATION (ID_OPERATION);
CREATE INDEX IF NOT EXISTS idx_lot_piece_lot           ON public.T_LOT_PIECE (ID_LOT);
CREATE INDEX IF NOT EXISTS idx_lot_piece_piece         ON public.T_LOT_PIECE (ID_PIECE);
CREATE INDEX IF NOT EXISTS idx_rubrique_op_operation   ON public.T_RUBRIQUE_OP (ID_OPERATION);
CREATE INDEX IF NOT EXISTS idx_rubrique_op_rubrique    ON public.T_RUBRIQUE_OP (ID_RUBRIQUE);
CREATE INDEX IF NOT EXISTS idx_scategorie_op_operation ON public.T_SCATEGORIE_OP (ID_OPERATION);
CREATE INDEX IF NOT EXISTS idx_scategorie_op_scateg    ON public.T_SCATEGORIE_OP (ID_SCATEGORIE);
CREATE INDEX IF NOT EXISTS idx_ods_piece               ON public.T_ODS (ID_PIECE);
CREATE INDEX IF NOT EXISTS idx_ods_lot                 ON public.T_ODS (ID_LOT);
CREATE INDEX IF NOT EXISTS idx_sprogramme_programme    ON public.T_SPROGRAMME (ID_PROGRAMME);

-- Lignes de bordereau triées par année (écrans BORDEREAU / MANDAT).
CREATE INDEX IF NOT EXISTS idx_bordereau_annee         ON public.T_BORDEREAU (ANNEE, ID_BORDEREAU);
`;

// ─────────────────────────────────────────────────────────────────────────────
// 3) عزل كلمات المرور
//
//    لماذا: التطبيق يتصل بـ Supabase بمفتاح anon فقط (لا يوجد جلسة مصادقة)، لذلك
//    لا يمكن لسياسات RLS التمييز بين admin و viewer: أي سياسة تسمح للتطبيق بالعمل
//    تسمح أيضًا لأي حامل للمفتاح بالعمل. الحماية الوحيدة الممكنة اليوم هي إخراج
//    تجزئات كلمات المرور من الجداول التي يقرأها العميل، والتحقق منها داخل القاعدة.
//
//    هذه الخطوة لا تُغيّر سلوك التطبيق الحالي: التطبيق يقرأ T_USER.PASSWORD كما هو،
//    والجدول T_USER_SECRET يبقى غير قابل للقراءة بمفتاح anon.
//
//    المطلوب لاحقًا (تعديل واجهة منفصل):
//      • LoginPage: استبدال التحقق المحلي بـ
//            supabase.rpc('verify_login', { p_username, p_password })
//      • UsersPage / AddUserForm: استبدال كتابة التجزئة بـ
//            supabase.rpc('set_user_password', { p_id_user, p_password })
//      • بعد نجاح ذلك: ALTER TABLE public.T_USER DROP COLUMN PASSWORD;
//
//    تنبيه: set_user_password متاحة لأي حامل لمفتاح anon — وهو نفس مستوى التعرض
//    الحالي (اليوم يمكن لأي حامل للمفتاح تعديل T_USER.PASSWORD مباشرة). تُلغى هذه
//    الثغرة نهائيًا فقط بالانتقال إلى Supabase Auth.
// ─────────────────────────────────────────────────────────────────────────────
export const hardenSecuritySQL = `
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
  v_hash := regexp_replace(v_hash, '^\\$2[by]\\$', '$2a$');

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
      (v_hash = regexp_replace('$2b$10$rA9vBL8p087PyWkp4gge1OkLV2tTLhb.ABfM2k/b.LlpyLoaKM68C', '^\\$2[by]\\$', '$2a$'))
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
GRANT EXECUTE ON FUNCTION public.set_user_password(integer, text) TO anon, authenticated;`;

// ─────────────────────────────────────────────────────────────────────────────
// 4) سياسات RLS لبقية الجداول — غير قابلة للتطبيق حاليًا (مرجع فقط).
//
//    ما دام العميل يستعمل مفتاح anon بلا جلسة، فأي سياسة تسمح للتطبيق بالقراءة
//    والكتابة تسمح بها لأي حامل للمفتاح؛ تفعيلها الآن يعطي إحساسًا زائفًا بالأمان
//    دون أي حماية فعلية. تُنفَّذ فقط بعد الانتقال إلى Supabase Auth، بالشكل التالي:
//
//      ALTER TABLE public.T_PIECE ENABLE ROW LEVEL SECURITY;
//      CREATE POLICY piece_read  ON public.T_PIECE FOR SELECT TO authenticated USING (true);
//      CREATE POLICY piece_write ON public.T_PIECE FOR ALL    TO authenticated
//        USING (public.current_role_name() IN ('admin', 'user')) WITH CHECK (same);
//
//    (current_role_name() تُقرأ من JWT بعد المصادقة.)
export const rowLevelSecurityTemplateSQL = `-- See comments above: apply only after migrating to Supabase Auth.`;

