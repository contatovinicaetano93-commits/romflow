"use client";

import { FormEvent, useState } from "react";
import { Eye, EyeOff, KeyRound, Lock } from "lucide-react";

export function ChangePasswordDialog({
  onSubmit,
  onClose,
}: {
  onSubmit: (currentPassword: string, nextPassword: string) => Promise<void>;
  onClose: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

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
      await onSubmit(currentPassword, password);
      setDone(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Não foi possível trocar a senha.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-layer">
      <button className="modal-overlay" type="button" onClick={onClose} />
      {done ? (
        <div className="action-modal">
          <header>
            <div className="modal-icon emerald">
              <KeyRound size={20} />
            </div>
            <div>
              <h3>Senha atualizada</h3>
              <p className="modal-lead">Sua nova senha já vale neste acesso. Outras sessões foram encerradas.</p>
            </div>
          </header>
          <footer>
            <button className="primary-button" type="button" onClick={onClose}>
              Fechar
            </button>
          </footer>
        </div>
      ) : (
        <form className="action-modal" onSubmit={handleSubmit}>
          <header>
            <div className="modal-icon emerald">
              <KeyRound size={20} />
            </div>
            <div>
              <h3>Trocar senha</h3>
              <p className="modal-lead">Qualquer usuário cadastrado pode atualizar a própria senha por aqui.</p>
            </div>
          </header>
          <label>
            Senha atual
            <div className="input-with-icon">
              <Lock size={18} />
              <input
                type={showPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </label>
          <label>
            Nova senha
            <div className="input-with-icon">
              <Lock size={18} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label="Mostrar senha">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          <label>
            Confirmar nova senha
            <div className="input-with-icon">
              <Lock size={18} />
              <input
                type={showPassword ? "text" : "password"}
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          <footer>
            <button className="secondary-button" type="button" disabled={submitting} onClick={onClose}>
              Cancelar
            </button>
            <button className="primary-button" disabled={submitting}>
              {submitting ? <span className="spinner" /> : null}
              {submitting ? "Salvando..." : "Salvar senha"}
            </button>
          </footer>
        </form>
      )}
    </div>
  );
}
