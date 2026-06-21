import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { applyTenantFilter } from "@/lib/tenant";

export function usePendingExpensesCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: ["pendingExpensesCount", user?.id],
    queryFn: async () => {
      if (!user || user.role !== "admin") return 0;
      const query = applyTenantFilter(
        supabase
          .from("expenses")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending")
      );
      const { count, error } = await query;
      if (error || count === null) return 0;
      return count;
    },
    enabled: !!user && user.role === "admin",
    staleTime: Infinity,
    refetchInterval: 5000, // Poll every 5 seconds as fallback for realtime
  });

  useEffect(() => {
    if (!user || user.role !== "admin") return;

    const channelName = `expenses_changes_${Math.random().toString(36).substring(7)}`;
    const subscription = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "expenses" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pendingExpensesCount"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, queryClient]);

  return count;
}
