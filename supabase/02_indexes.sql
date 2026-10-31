-- =============================================================================
-- GOFT3 — 02: الفهارس (Supabase / PostgreSQL)
--
-- آمنة على قاعدة تعمل: IF NOT EXISTS، ولا تُغيّر أي سلوك في التطبيق.
-- تُنفَّذ بعد 01_tables.sql، ويمكن إعادة تشغيلها في أي وقت.
--
-- لماذا: PostgreSQL لا يُنشئ فهارس تلقائيًا على أعمدة المفاتيح الأجنبية،
-- وكل صفحات التقارير تفلتر بـ ID_OPERATION / ID_PIECE / ID_ENG / ID_RUBRIQUE.
-- بدون هذه الفهارس يتحوّل كل تقرير إلى مسح كامل للجدول.
--
-- ملاحظة: على جداول كبيرة قد يستغرق التنفيذ دقيقة أو دقيقتين.
-- =============================================================================

BEGIN;

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

COMMIT;
