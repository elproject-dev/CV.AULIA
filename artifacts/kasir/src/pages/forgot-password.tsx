import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { Mail, Send, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export default function ForgotPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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
    window.addEventListener('storeSettingsChanged', syncColor);
    return () => window.removeEventListener('storeSettingsChanged', syncColor);
  }, []);

  const primaryColor = `hsl(${primaryHue}, ${primarySaturation}%, ${primaryLightness}%)`;
  const primaryDark = `hsl(${primaryHue}, ${primarySaturation}%, ${Math.max(primaryLightness - 20, 20)}%)`;
  const primaryDarker = `hsl(${primaryHue}, ${primarySaturation}%, ${Math.max(primaryLightness - 30, 10)}%)`;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) throw error;

      setIsSuccess(true);
      toast({
        title: "Email Terkirim",
        description: "Silakan periksa kotak masuk email Anda untuk mereset kata sandi.",
        variant: "success",
      });
    } catch (error: any) {
      toast({
        title: "Gagal Mengirim Email",
        description: error?.message || "Terjadi kesalahan",
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
          <h1 className="text-3xl font-extrabold text-white drop-shadow-lg">Lupa Kata Sandi</h1>
          <p className="text-white/70 mt-2 text-sm font-medium">Masukkan email Anda untuk menerima link pemulihan</p>
        </div>

        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-white/20 to-white/0 rounded-[2rem] blur opacity-30 transition duration-1000"></div>
          
          <div className="relative bg-white/10 backdrop-blur-2xl rounded-[2rem] border border-white/20 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] p-8 sm:p-10">
            {isSuccess ? (
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/30">
                  <Mail className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-white">Periksa Email Anda</h3>
                <p className="text-white/80 text-sm leading-relaxed">
                  Kami telah mengirimkan link untuk mereset kata sandi ke <strong>{email}</strong>. 
                  Silakan klik link tersebut untuk membuat kata sandi baru.
                </p>
                <Button
                  onClick={() => setLocation("/login")}
                  className="w-full h-12 rounded-xl border border-white/20 text-white font-semibold text-base hover:bg-white/10 transition-colors"
                  variant="ghost"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Login
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2.5">
                  <label className="text-sm font-semibold text-white/90 ml-1">Email Anda</label>
                  <div className="relative group/input">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50 group-focus-within/input:text-white transition-colors duration-300" />
                    <Input
                      type="email"
                      placeholder="contoh: budi@sbagiamu.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-12 pl-11 bg-white/5 border-white/10 text-white placeholder:text-white/40 rounded-xl focus:bg-white/10 focus:border-white/30 focus:ring-4 focus:ring-white/10 focus-visible:ring-0 focus-visible:border-white/30 focus-visible:ring-offset-0 transition-all duration-300"
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full h-12 mt-2 rounded-xl border border-white/20 text-white font-semibold text-base shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
                  style={{ backgroundColor: primaryColor }}
                  disabled={isSubmitting}
                >
                  <Send className="w-4 h-4 mr-2.5" />
                  {isSubmitting ? "Mengirim..." : "Kirim Link Pemulihan"}
                </Button>
              </form>
            )}

            {!isSuccess && (
              <div className="mt-6 text-center">
                <Link href="/login" className="text-white/70 text-sm font-medium hover:text-white hover:underline transition-colors flex items-center justify-center cursor-pointer">
                  <ArrowLeft className="w-4 h-4 mr-1.5" /> Kembali ke Halaman Login
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
