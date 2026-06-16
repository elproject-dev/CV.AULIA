import { useState, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Store, User, Loader2, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useListOutlets } from "@/mocks/api-client-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

export function ProfileContent() {
  const { user, logout, updateUser } = useAuth();
  const { toast } = useToast();
  const { data: outlets } = useListOutlets();
  
  const assignedOutletName = outlets?.find((o: any) => o.id.toString() === user?.outletId)?.name || 'Semua Outlet';
  
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    try {
      setIsUploadingAvatar(true);
      
      const fileExt = file.name.split('.').pop() || 'jpg';
      const fileName = `${user.id}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('staff')
        .update({ avatar_url: publicUrl })
        .eq('email', user.email);

      if (updateError) throw updateError;

      toast({
        title: "Berhasil",
        description: "Foto profil berhasil diperbarui",
      });

      updateUser({ avatarUrl: publicUrl });

    } catch (error: any) {
      toast({
        title: "Gagal Mengunggah",
        description: error.message || "Terjadi kesalahan saat mengunggah foto profil",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-row gap-4 sm:gap-6 items-start justify-between relative">
      <div className="flex-1 min-w-0 space-y-4">
        <div className="space-y-1">
          <Label className="text-xs text-slate-500 uppercase tracking-wider">Nama Lengkap</Label>
          <p className="font-medium text-slate-900 dark:text-white text-base">{user?.name || "Tidak ada nama"}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500 uppercase tracking-wider">Email</Label>
          <p className="font-medium text-slate-900 dark:text-white text-base">{user?.email}</p>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-slate-500 uppercase tracking-wider">Peran</Label>
          <div>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
              {user?.role === 'admin' ? 'Administrator' : 'Kasir'}
            </span>
          </div>
        </div>
        
        <div className="space-y-1">
          <Label className="text-xs text-slate-500 uppercase tracking-wider">Outlet / Cabang</Label>
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <Store className="w-3.5 h-3.5 text-slate-500" />
              {user?.role === 'admin' ? 'Semua Outlet' : (user?.outletId ? assignedOutletName : 'Belum Ditugaskan')}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center gap-3">
        <div className="relative w-24 h-24 rounded-full border-4 border-white dark:border-slate-800 shadow-md bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
          {user?.avatarUrl ? (
            <img src={user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <User className="w-10 h-10 text-slate-400" />
          )}
          {isUploadingAvatar && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-white animate-spin" />
            </div>
          )}
        </div>
        <input 
          type="file" 
          accept="image/*" 
          className="hidden" 
          ref={fileInputRef} 
          onChange={handleAvatarUpload} 
          disabled={isUploadingAvatar}
        />
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full text-xs h-8" 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploadingAvatar}
        >
          Ubah Foto
        </Button>

        <Button
          variant="destructive"
          size="sm"
          className="w-full text-xs h-8"
          onClick={async () => {
            await logout();
            window.location.href = "/login";
          }}
        >
          <LogOut className="w-3.5 h-3.5 mr-1.5" />
          Logout
        </Button>
      </div>
    </div>
  );
}
