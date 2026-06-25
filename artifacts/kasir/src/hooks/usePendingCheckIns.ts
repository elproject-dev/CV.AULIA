import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminMode } from "@/lib/auth";

export function usePendingCheckInsCount() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = isAdminMode(user);

  const { data: count = 0 } = useQuery({
    queryKey: ["pendingCheckInsCount", user?.id],
    queryFn: async () => {
      if (!user || !isAdmin) return 0;

      const ownerIdStr = localStorage.getItem('ownerId') || localStorage.getItem('tenantOwnerId') || '';
      let query = supabase
        .from('visit_logs')
        .select('id, notes')
        .order('visited_at', { ascending: false })
        .limit(100);

      if (ownerIdStr) {
        query = query.eq('owner_id', ownerIdStr);
      }

      const { data: logs, error } = await query;
      if (error || !logs) return 0;

      // Get verified logs from localStorage for fallback/session consistency
      let verifiedLogs: Record<number, boolean> = {};
      try {
        const stored = localStorage.getItem("kasir_verified_logs");
        if (stored) verifiedLogs = JSON.parse(stored);
      } catch {}

      const pending = logs.filter(
        (log: any) => !(verifiedLogs[log.id] || (log.notes && log.notes.includes('[verified]')))
      );

      return pending.length;
    },
    enabled: !!user && isAdmin,
    staleTime: Infinity,
    refetchInterval: 5000, // Poll every 5 seconds as fallback
  });

  useEffect(() => {
    if (!user || !isAdmin) return;

    const channelName = `visit_logs_sidebar_${Math.random().toString(36).substring(7)}`;
    const subscription = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visit_logs" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["pendingCheckInsCount"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user, isAdmin, queryClient]);

  return count;
}
