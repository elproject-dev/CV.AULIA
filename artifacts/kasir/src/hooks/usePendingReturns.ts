import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { applyTenantFilter } from "@/lib/tenant";

export function usePendingReturnsCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: count = 0 } = useQuery({
    queryKey: ["pendingReturnsCount", user?.id],
    queryFn: async () => {
      if (!user || user.role !== "admin") return 0;
      const query = supabase
          .from("sales_returns")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending");
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

    const channelName = `returns_changes_${Math.random().toString(36).substring(7)}`;
    const subscription = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sales_returns" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pendingReturnsCount"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, queryClient]);

  return count;
}
