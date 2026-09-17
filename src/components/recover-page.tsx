"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Lock } from "lucide-react";

export function RecoverPage({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [valid, setValid] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) {
        setError("Link inválido ou expirado. Solicite uma nova redefinição de senha.");
        setLoading(false);
        return;
      }
      try {
        const res = await fetch(`/api/auth/reset?token=${encodeURIComponent(token)}`, { cache: "no-store" });
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (cancelled) {
          return;
        }
        if (!res.ok) {
          setError(body.error || "Link inválido ou expirado. Solicite uma nova redefinição de senha.");
          setValid(false);
        } else {
          setValid(true);
          setError("");
        }
      } catch {
        if (!cancelled) {
          setError("Não foi possível validar o link. Tente de novo.");
          setValid(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não coincidem.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, password }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || "Não foi possível redefinir a senha.");
      }
      router.replace("/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível redefinir a senha.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-form-wrap">
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="mobile-login-logo">
            <div className="brand-mark">R</div>
            <strong>ROM FLOW</strong>
          </div>
          <span className="secure-label">
            <Lock size={14} /> NOVA SENHA
          </span>
          <h2>Redefinir senha</h2>
          <p>Crie uma senha nova para voltar ao fluxo de solicitações.</p>
          {loading ? <div className="spinner" /> : null}
          {!loading && valid ? (
            <>
              <label>
                Nova senha
                <div className="input-with-icon">
                  <Lock size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label="Mostrar senha"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </label>
              <label>
                Confirmar senha
                <div className="input-with-icon">
                  <Lock size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    required
                    minLength={8}
                  />
                </div>
              </label>
            </>
          ) : null}
          {error ? <div className="form-error">{error}</div> : null}
          {!loading && valid ? (
            <button className="primary-button login-submit" disabled={submitting}>
              {submitting ? <span className="spinner" /> : (
                <>
                  Salvar senha e entrar <ArrowRight size={18} />
                </>
              )}
            </button>
          ) : null}
          <div className="login-help">
            <Link href="/">Voltar ao login</Link>
          </div>
        </form>
      </section>
    </div>
  );
}
