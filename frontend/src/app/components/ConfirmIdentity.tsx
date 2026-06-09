import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { ShieldCheck, Loader2 } from 'lucide-react';

export function ConfirmIdentity() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!token) {
      navigate('/forgot-password');
      return;
    }
    const timer = setTimeout(() => setChecking(false), 800);
    return () => clearTimeout(timer);
  }, [token, navigate]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] p-4">
        <div className="flex items-center gap-3 text-white">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Verificando identidad...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <ShieldCheck className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="mb-2">Confirmación de Identidad Exitosa</h1>
          <p className="text-muted-foreground mb-6">
            Tu identidad ha sido confirmada correctamente.
          </p>
          <button
            onClick={() => navigate(`/forgot-password?confirmed&token=${token}`)}
            className="w-full bg-gradient-to-r from-[#9FE0C3] via-[#9FDDE0] to-[#9FBCE0] py-3 rounded-lg hover:opacity-90 transition-all shadow-lg"
          >
            Ir a cambiar contraseña
          </button>
        </div>
      </div>
    </div>
  );
}