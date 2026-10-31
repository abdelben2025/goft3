-- Migration 11: add the four T_PIECE columns that exist in the local
-- SQLite schema but were missing from the live Supabase schema. Without
-- these, cloud import (and normal cloud inserts) failed with
-- "Could not find the '...' column of 'T_PIECE' in the schema cache".
--
-- Safe to run repeatedly: each ADD COLUMN uses IF NOT EXISTS.

ALTER TABLE public.T_PIECE ADD COLUMN IF NOT EXISTS DATE_OD_PIECE text;
ALTER TABLE public.T_PIECE ADD COLUMN IF NOT EXISTS N_OD_PIECE text;
ALTER TABLE public.T_PIECE ADD COLUMN IF NOT EXISTS DATE_DEPOT_PIECE text;
ALTER TABLE public.T_PIECE ADD COLUMN IF NOT EXISTS BORDEREAU_PIECE text;
