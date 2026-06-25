import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";

export function usePendingReceivablesCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: ["pendingReceivablesCount", user?.id],
    queryFn: async () => {
      if (!user) return 0;

      const ownerIdStr = localStorage.getItem('ownerId') || localStorage.getItem('tenantOwnerId') || '';
      let query = supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .not('due_date', 'is', null)
        .neq('payment_status', 'paid');

      if (ownerIdStr) {
        query = query.eq('owner_id', ownerIdStr);
      }

      const { count, error } = await query;
      if (error || count === null) return 0;
      return count;
    },
    enabled: !!user,
    staleTime: Infinity,
    refetchInterval: 5000, // Poll every 5 seconds as fallback
  });

  useEffect(() => {
    if (!user) return;

    const channelName = `receivables_sidebar_${Math.random().toString(36).substring(7)}`;
    const subscription = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pendingReceivablesCount"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, queryClient]);

  return count;
}
