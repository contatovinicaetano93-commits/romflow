"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Lock, Mail, Shield, Sparkles, UserRound } from "lucide-react";
import type { Invitation } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/format";

function suggestedName(email: string): string {
  return email
    .split("@")[0]
    .replace(/[._-]/g, " ")
    .split(" ")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1).toLowerCase() : ""))
    .join(" ");
}

export function InvitePage({
  token,
  onValidate,
  onAccept,
  onGoToLogin,
}: {
  token: string;
  onValidate: (token: string) => Promise<Invitation>;
  onAccept: (token: string, name: string, password: string) => Promise<void>;
  onGoToLogin: () => void;
}) {
  const [invite, setInvite] = useState<Invitation | null>(null);
  const [resolvedError, setResolvedError] = useState("");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!token) {
        setResolvedError("Token de convite não encontrado na URL. Verifique o link recebido.");
        setLoading(false);
        return;
      }
      try {
        const next = await onValidate(token);
        if (cancelled) {
          return;
        }
        setInvite(next);
        setName(suggestedName(next.email));
        setResolvedError("");
      } catch (caught) {
        if (cancelled) {
          return;
        }
        setInvite(null);
        setResolvedError(
          caught instanceof Error
            ? caught.message
            : "Convite inválido ou expirado. Solicite um novo convite ao administrador.",
        );
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
  }, [onValidate, token]);

  const error = formError || resolvedError;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setFormError("A senha deve ter no mínimo 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setFormError("As senhas não coincidem.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      await onAccept(token, name, password);
    } catch (caught) {
      setFormError(
        caught instanceof Error ? caught.message : "Não foi possível ativar seu acesso com este convite.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-page">
      <section className="login-visual">
        <div className="login-gradient-orb orb-one" />
        <div className="login-gradient-orb orb-two" />
        <div className="brand-row login-brand">
          <div className="brand-mark">R</div>
          <div>
            <strong>ROM FLOW</strong>
            <span>Fluxo de despesas</span>
          </div>
        </div>
        <div className="login-promise">
          <span className="eyebrow">
            <Sparkles size={14} /> BEM-VINDO AO ROM FLOW
          </span>
          <h1>
            Ative seu
            <br />
            acesso
            <br />
            <span>corporativo.</span>
          </h1>
          <p>Você foi convidado para acessar o sistema financeiro e de despesas do ROM Flow.</p>
          <div className="login-features">
            <div>
              <span>
                <Shield size={16} />
              </span>
              <p>
                <strong>Ativação rápida e segura</strong>
                <small>Defina sua senha e comece a utilizar imediatamente.</small>
              </p>
            </div>
            <div>
              <span>
                <Lock size={16} />
              </span>
              <p>
                <strong>Acesso controlado</strong>
                <small>Permissões personalizadas para suas empresas atribuídas.</small>
              </p>
            </div>
          </div>
        </div>
        <small className="login-copyright">
          © 2026 Grupo ROM • Ambiente corporativo protegido
        </small>
      </section>
      <section className="login-form-wrap">
        {loading ? (
          <div className="login-form">
            <span className="secure-label">Validando convite</span>
            <h2>Estamos conferindo seu acesso.</h2>
          </div>
        ) : error && !invite ? (
          <div className="login-form">
            <span className="secure-label">Atenção</span>
            <h2>Não foi possível ativar seu acesso com este convite.</h2>
            <div className="form-error">{error}</div>
            <div className="login-help">
              <span>Precisa de ajuda?</span>
              <button type="button" onClick={onGoToLogin}>
                Fale com o administrador
              </button>
            </div>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleSubmit}>
            <span className="secure-label">
              <Lock size={14} /> ACESSO SEGURO
            </span>
            <h2>Aceitar Convite</h2>
            <p>Você foi convidado para acessar o ROM Flow. Crie sua senha de acesso.</p>
            <label>
              E-mail corporativo
              <div className="input-with-icon" style={{ opacity: 0.85, background: "rgba(255,255,255,0.03)" }}>
                <Mail size={18} />
                <input type="email" value={invite?.email ?? ""} readOnly />
              </div>
            </label>
            {invite ? (
              <p style={{ marginTop: -20, marginBottom: 18, color: "#71717a", fontSize: 12 }}>
                Perfil: {ROLE_LABEL[invite.role]}
              </p>
            ) : null}
            <label>
              Nome completo
              <div className="input-with-icon">
                <UserRound size={18} />
                <input value={name} onChange={(event) => setName(event.target.value)} required />
              </div>
            </label>
            <label>
              Senha <span>* (mínimo 8 caracteres)</span>
              <div className="input-with-icon">
                <Lock size={18} />
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
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
                />
              </div>
            </label>
            {error ? <div className="form-error">{error}</div> : null}
            <button className="primary-button login-submit" disabled={submitting}>
              {submitting ? <span className="spinner" /> : "Ativar acesso"}
            </button>
            <div className="login-help">
              <span>Já possui uma conta ativa?</span>
              <button type="button" onClick={onGoToLogin}>
                Fazer login
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
