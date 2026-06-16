import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { User } from "lucide-react";
import { ProfileContent } from "./ProfileContent";

interface ProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto sm:rounded-2xl">
        <DialogHeader className="shrink-0 mb-4">
          <DialogTitle className="flex items-center gap-2">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
              <User className="w-5 h-5" />
            </div>
            Profil Pengguna
          </DialogTitle>
          <DialogDescription className="sr-only">Informasi profil dan foto Anda</DialogDescription>
        </DialogHeader>
        
        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-xl border border-slate-100 dark:border-slate-700">
          <ProfileContent />
        </div>
      </DialogContent>
    </Dialog>
  );
}
