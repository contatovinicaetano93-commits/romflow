"use client";

import { ArrowRight, Shield } from "lucide-react";
import { ROLE_LABEL } from "@/lib/format";
import type { Company, User } from "@/lib/types";

export function CompanySelect({
  user,
  companies,
  onSelect,
  onLogout,
}: {
  user: User;
  companies: Company[];
  onSelect: (id: string) => void;
  onLogout: () => void;
}) {
  return (
    <div className="company-select-page">
      <div className="company-glow company-glow-one" />
      <div className="company-glow company-glow-two" />
      <header className="company-select-header">
        <div className="brand-row">
          <div className="brand-mark">R</div>
          <div>
            <strong>ROM FLOW</strong>
            <span>Solicitações • Aprovações • Pagamentos</span>
          </div>
        </div>
        <div className="company-user">
          <span>
            Olá, <strong>{user.name.split(" ")[0]}</strong>
          </span>
          <button type="button" onClick={onLogout}>
            Sair
          </button>
        </div>
      </header>
      <div className="company-select-content">
        <span className="eyebrow">GRUPO ROM</span>
        <h1>
          Qual empresa você
          <br />
          <span>quer acessar?</span>
        </h1>
        <p>
          Selecione uma empresa para visualizar solicitações, aprovações e pagamentos em um único
          fluxo. Perfil {ROLE_LABEL[user.role]}.
        </p>
        {companies.length === 0 ? (
          <p>Nenhuma empresa ativa disponível.</p>
        ) : (
          <div className="company-grid">
            {companies.map((company, index) => (
              <button
                key={company.id}
                className="company-card"
                style={{
                  ["--company-color" as string]: company.color,
                  ["--delay" as string]: `${index * 70}ms`,
                }}
                type="button"
                onClick={() => onSelect(company.id)}
              >
                <div className="company-card-pattern" />
                <div className="company-card-icon">{company.initials}</div>
                <div className="company-card-copy">
                  <small>EMPRESA</small>
                  <strong>{company.name}</strong>
                  <em>{company.legal_name}</em>
                </div>
                <div className="company-card-arrow">
                  <ArrowRight size={16} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
      <footer className="company-select-footer">
        <span className="security-shield">
          <Shield size={12} />
        </span>
        Ambiente corporativo protegido • Governança ativa
      </footer>
    </div>
  );
}
