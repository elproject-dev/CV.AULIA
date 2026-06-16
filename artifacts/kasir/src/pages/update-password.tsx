import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Lock, Save, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export default function UpdatePasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Check if user is actually authenticated (they should be if they clicked the reset link)
  useEffect(() => {
    // 1. Handle PKCE Flow (URL contains ?code=...)
    const code = new URLSearchParams(window.location.search).get('code');
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          toast({
            title: "Sesi Tidak Valid",
            description: "Link pemulihan tidak valid atau sudah kedaluwarsa. Silakan minta link baru.",
            variant: "destructive",
          });
          setLocation("/forgot-password");
        } else {
          // Clean the URL so code isn't exchanged again on refresh
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      });
      return; // Exit early because we handled the code
    }

    // 2. Handle Implicit Flow (URL contains #access_token=...)
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsSuccess(false);
        }
      }
    );

    const checkAndSetSession = async () => {
      // Manual fallback: Extract token from hash if Supabase missed it
      const hash = window.location.hash;
      if (hash && hash.includes("access_token")) {
        const params = new URLSearchParams(hash.substring(1));
        const accessToken = params.get("access_token");
        const refreshToken = params.get("refresh_token");
        
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          if (!error) {
            setIsSuccess(false);
            // Clean hash so we don't process it again
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
          }
        }
      }

      // Check standard session
      const { data: { session } } = await supabase.auth.getSession();
      const isProcessingHash = hash && hash.includes("access_token");

      if (!session && !isProcessingHash) {
        toast({
          title: "Sesi Tidak Valid",
          description: "Sesi pemulihan tidak ditemukan. Pastikan membuka dari link email yang benar.",
          variant: "destructive",
        });
        setLocation("/forgot-password");
      }
    };

    const timer = setTimeout(checkAndSetSession, 1000);

    return () => {
      clearTimeout(timer);
      authListener.subscription.unsubscribe();
    };
  }, [setLocation, toast]);

  // Get custom primary color from localStorage
  const [primaryHue, setPrimaryHue] = useState(() => parseInt(localStorage.getItem('primaryHue') || '35'));
  const [primarySaturation, setPrimarySaturation] = useState(() => parseInt(localStorage.getItem('primarySaturation') || '100'));
  const [primaryLightness, setPrimaryLightness] = useState(() => parseInt(localStorage.getItem('primaryLightness') || '45'));

  useEffect(() => {
    const syncColor = () => {
      setPrimaryHue(parseInt(localStorage.getItem('primaryHue') || '35'));
      setPrimarySaturation(parseInt(localStorage.getItem('primarySaturation') || '100'));
      setPrimaryLightness(parseInt(localStorage.getItem('primaryLightness') || '45'));
    };
    syncColor();
  }, []);

  const primaryColor = `hsl(${primaryHue}, ${primarySaturation}%, ${primaryLightness}%)`;
  const primaryDark = `hsl(${primaryHue}, ${primarySaturation}%, ${Math.max(primaryLightness - 20, 20)}%)`;
  const primaryDarker = `hsl(${primaryHue}, ${primarySaturation}%, ${Math.max(primaryLightness - 30, 10)}%)`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (password.length < 6) {
      toast({
        title: "Password Terlalu Pendek",
        description: "Password minimal 6 karakter.",
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Password Tidak Cocok",
        description: "Konfirmasi password harus sama dengan password baru.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) throw error;

      setIsSuccess(true);
      toast({
        title: "Berhasil!",
        description: "Kata sandi Anda telah berhasil diperbarui.",
        variant: "success",
      });
      
      // Auto redirect to pos/admin after success
      setTimeout(() => {
        setLocation("/");
      }, 2000);
      
    } catch (error: any) {
      toast({
        title: "Gagal Menyimpan",
        description: error?.message || "Terjadi kesalahan saat memperbarui kata sandi",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${primaryDarker} 0%, ${primaryDark} 50%, ${primaryColor} 100%)`
      }}
    >
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-white/5 blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-black/20 blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-[420px] relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-white drop-shadow-lg">Buat Kata Sandi Baru</h1>
          <p className="text-white/70 mt-2 text-sm font-medium">Silakan buat kata sandi baru untuk akun Anda</p>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-white/20 to-white/0 rounded-[2rem] blur opacity-30 transition duration-1000"></div>
          
          <div className="relative bg-white/10 backdrop-blur-2xl rounded-[2rem] border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-8 sm:p-10">
            {isSuccess ? (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30">
                  <Save className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white">Sukses Diperbarui!</h3>
                <p className="text-white/80 text-sm leading-relaxed">
                  Kata sandi Anda berhasil diubah. Mengarahkan Anda ke aplikasi...
                </p>
                <Button
                  onClick={() => setLocation("/")}
                  className="w-full h-12 rounded-xl border border-white/20 text-white font-semibold text-base hover:bg-white/10 transition-colors"
                  variant="ghost"
                >
                  Masuk Sekarang
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2.5">
                  <label className="text-sm font-semibold text-white/90 ml-1">Password Baru</label>
                  <div className="relative group/input">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 group-focus-within/input:text-white transition-colors duration-300" />
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimal 6 karakter"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-12 pl-11 pr-12 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl focus:bg-white/10 focus:border-white/30 focus:ring-4 focus:ring-white/10 focus-visible:ring-0 focus-visible:border-white/30 focus-visible:ring-offset-0 transition-all duration-300"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <label className="text-sm font-semibold text-white/90 ml-1">Konfirmasi Password</label>
                  <div className="relative group/input">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 group-focus-within/input:text-white transition-colors duration-300" />
                    <Input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Ulangi password baru"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-12 pl-11 pr-12 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl focus:bg-white/10 focus:border-white/30 focus:ring-4 focus:ring-white/10 focus-visible:ring-0 focus-visible:border-white/30 focus-visible:ring-offset-0 transition-all duration-300"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 mt-2 rounded-xl border border-white/20 text-white font-semibold text-base shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
                  style={{ backgroundColor: primaryColor }}
                  disabled={isSubmitting}
                >
                  <Save className="w-4 h-4 mr-2.5" />
                  {isSubmitting ? "Menyimpan..." : "Simpan Kata Sandi"}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
