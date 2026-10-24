import { useQuery } from '@tanstack/react-query';
import { supabase } from '../services/supabaseClient';
import { Database } from '../types';

export const useTableData = <K extends keyof Database>(tableName: K) => {
  return useQuery({
    queryKey: [tableName],
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase not configured");
      const { data, error } = await supabase.from(tableName as string).select('*');
      if (error) throw error;
      return data as Database[K];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useSummaries = (selectedYear: string) => {
  return useQuery({
    queryKey: ['summaries', selectedYear],
    queryFn: async () => {
      if (!supabase) throw new Error("Supabase not configured");
      
      // In a real scalability scenario, we'd use an RPC or edge function here.
      // For now, we'll fetch only the columns we need to minimize data transfer.
      
      let engagementsQuery = supabase.from('T_ENGAGEMENT').select('ID_OPERATION, MONTANT_ENG, NATURE_ENG, ANNEE');
      let paiementsQuery = supabase.from('T_PAIEMENT').select('ID_OPERATION, MONTANT_PAI, ANNEE');
      let cpsQuery = supabase.from('T_CP').select('ID_OPERATION, MONTANT_FINALE_CP, ANNEE');

      if (selectedYear) {
        engagementsQuery = engagementsQuery.eq('ANNEE', selectedYear);
        paiementsQuery = paiementsQuery.eq('ANNEE', selectedYear);
        cpsQuery = cpsQuery.eq('ANNEE', selectedYear);
      }

      const [ops, rubriques, engagements, paiements, cps] = await Promise.all([
        supabase.from('T_OPERATION').select('ID_OPERATION, status, N_OPERATION'),
        supabase.from('T_RUBRIQUE_OP').select('ID_OPERATION, MONTANT_FINALE, MONTANT_INITIALE'),
        engagementsQuery,
        paiementsQuery,
        cpsQuery,
      ]);

      if (ops.error || rubriques.error || engagements.error || paiements.error || cps.error) {
        throw new Error("Failed to fetch summary data");
      }

      return {
        operations: ops.data,
        rubriques: rubriques.data,
        engagements: engagements.data,
        paiements: paiements.data,
        cps: cps.data,
      };
    },
  });
};
