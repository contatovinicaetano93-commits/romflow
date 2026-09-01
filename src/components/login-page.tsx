"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Shield, Sparkles, UserRound } from "lucide-react";

export function LoginPage({
  onLogin,
  onBootstrap,
  needsSetup,
  banner,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onBootstrap: (name: string, email: string, password: string) => Promise<void>;
  needsSetup: boolean;
  banner?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (needsSetup) {
        if (password.length < 8) {
          throw new Error("A senha deve ter no mínimo 8 caracteres.");
        }
        if (password !== confirm) {
          throw new Error("As senhas não coincidem.");
        }
        await onBootstrap(name, email, password);
      } else {
        await onLogin(email, password);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to authenticate.");
    } finally {
      setLoading(false);
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
            <Sparkles size={14} /> CONTROLE FINANCEIRO INTELIGENTE
          </span>
          <h1>
            Solicitações.
            <br />
            Aprovações.
            <br />
            <span>Pagamentos.</span>
          </h1>
          <p>Tudo em um único fluxo — simples, seguro e totalmente auditável.</p>
          <div className="login-features">
            <div>
              <span>
                <ArrowRight size={16} />
              </span>
              <p>
                <strong>Do pedido ao comprovante</strong>
                <small>Acompanhe cada etapa em tempo real.</small>
              </p>
            </div>
            <div>
              <span>
                <Shield size={16} />
              </span>
              <p>
                <strong>Governança por padrão</strong>
                <small>Permissões por perfil e trilha de auditoria.</small>
              </p>
            </div>
          </div>
        </div>
        <small className="login-copyright">
          © 2026 Grupo ROM • Ambiente corporativo protegido
        </small>
      </section>
      <section className="login-form-wrap">
        <form className="login-form" onSubmit={handleSubmit}>
          <div className="mobile-login-logo">
            <div className="brand-mark">R</div>
            <strong>ROM FLOW</strong>
          </div>
          <span className="secure-label">
            <Lock size={14} /> ACESSO SEGURO
          </span>
          <h2>{needsSetup ? "Criar primeiro acesso" : "Bem-vindo de volta"}</h2>
          <p>
            {needsSetup
              ? "Cadastre o administrador do grupo para começar a usar o ROM Flow."
              : "Entre com suas credenciais corporativas para continuar."}
          </p>
          {banner ? <div className="success-banner mb-4">{banner}</div> : null}
          {needsSetup ? (
            <label>
              Nome completo
              <div className="input-with-icon">
                <UserRound size={18} />
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
            </label>
          ) : null}
          <label>
            E-mail corporativo
            <div className="input-with-icon">
              <Mail size={18} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="e-mail corporativo"
                required
              />
            </div>
          </label>
          <label>
            Senha
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
          {needsSetup ? (
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
          ) : null}
          {error ? <div className="form-error">{error}</div> : null}
          <button className="primary-button login-submit" disabled={loading}>
            {loading ? (
              <span className="spinner" />
            ) : needsSetup ? (
              "Criar acesso de administrador"
            ) : (
              <>
                Entrar no ROM Flow <ArrowRight size={18} />
              </>
            )}
          </button>
          {needsSetup ? null : (
            <div className="login-help">
              <span>Problemas para acessar?</span>
              <button type="button">Fale com o administrador</button>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
