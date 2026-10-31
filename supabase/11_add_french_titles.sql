-- =============================================================================
-- GOFT3 — 11: إضافة أعمدة العناوين بالفرنسية (للجداول الموجودة)
-- يعمل بأمان على قاعدة بيانات موجودة: ALTER TABLE ADD COLUMN IF NOT EXISTS
-- =============================================================================

ALTER TABLE public.T_PROGRAMME
  ADD COLUMN IF NOT EXISTS INT_PROGRAMME_FR text;

ALTER TABLE public.T_SPROGRAMME
  ADD COLUMN IF NOT EXISTS INT_SPROGRAMME_FR text;

ALTER TABLE public.T_CATEGORIE
  ADD COLUMN IF NOT EXISTS INT_CATEGORIE_FR text;

ALTER TABLE public.T_SCATEGORIE
  ADD COLUMN IF NOT EXISTS INT_SCATEGORIE_FR text;

ALTER TABLE public.T_RUBRIQUE
  ADD COLUMN IF NOT EXISTS RUBRIQUE_FR text;

ALTER TABLE public.T_DIRECTION
  ADD COLUMN IF NOT EXISTS DIRECTION_FR text,
  ADD COLUMN IF NOT EXISTS INT_PORTEFEUILLE_FR text,
  ADD COLUMN IF NOT EXISTS INT_ACTION_FR text,
  ADD COLUMN IF NOT EXISTS INT_SACTION_FR text;
