"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail, Shield, Sparkles, UserRound } from "lucide-react";

export function LoginPage({
  onLogin,
  onBootstrap,
  onForgot,
  needsSetup,
  banner,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
  onBootstrap: (name: string, email: string, password: string) => Promise<void>;
  onForgot: (email: string) => Promise<void>;
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
  const [forgot, setForgot] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

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
      } else if (forgot) {
        await onForgot(email);
        setForgotSent(true);
      } else {
        await onLogin(email, password);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível entrar. Tente de novo.");
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
          <h2>
            {needsSetup ? "Criar primeiro acesso" : forgot ? "Recuperar senha" : "Bem-vindo de volta"}
          </h2>
          <p>
            {needsSetup
              ? "Cadastre o administrador do grupo para começar a usar o ROM Flow."
              : forgot
                ? "Informe seu e-mail corporativo. Se houver uma conta ativa, enviamos o link para criar uma senha nova."
                : "Entre com suas credenciais corporativas para continuar."}
          </p>
          {banner ? <div className="success-banner mb-4">{banner}</div> : null}
          {forgotSent ? (
            <div className="success-banner mb-4">
              Se o e-mail estiver cadastrado, o link de redefinição já saiu. Confira a caixa de entrada.
            </div>
          ) : null}
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
          {needsSetup || (!forgot && !forgotSent) ? (
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
          ) : null}
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
          {forgotSent ? (
            <button className="primary-button login-submit" type="button" onClick={() => { setForgot(false); setForgotSent(false); setError(""); }}>
              Voltar ao login
            </button>
          ) : (
            <button className="primary-button login-submit" disabled={loading}>
              {loading ? (
                <span className="spinner" />
              ) : needsSetup ? (
                "Criar acesso de administrador"
              ) : forgot ? (
                "Enviar link de senha"
              ) : (
                <>
                  Entrar no ROM Flow <ArrowRight size={18} />
                </>
              )}
            </button>
          )}
          {needsSetup ? null : (
            <div className="login-help">
              {forgot ? (
                <button
                  type="button"
                  onClick={() => {
                    setForgot(false);
                    setForgotSent(false);
                    setError("");
                  }}
                >
                  Voltar ao login
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setForgot(true);
                    setForgotSent(false);
                    setError("");
                  }}
                >
                  Esqueci a senha
                </button>
              )}
              <a href="mailto:adm@romconcept.com.br?subject=Acesso%20ROM%20Flow">Fale com o administrador</a>
            </div>
          )}
        </form>
      </section>
    </div>
  );
}
