"use client";

import { useState } from "react";
import { ArrowRight, Bell, Settings } from "lucide-react";
import { AREA_LABEL, ROLE_LABEL, STATUS_LABEL } from "@/lib/format";
import type { Company, Expense, User } from "@/lib/types";
import { companyInbox } from "@/lib/workflow";

export function CompanySelect({
  user,
  companies,
  expenses,
  onSelect,
  onLogout,
  onOpenSettings,
}: {
  user: User;
  companies: Company[];
  expenses: Expense[];
  onSelect: (id: string) => void;
  onLogout: () => void;
  onOpenSettings?: () => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

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
          <div className="empty-state">
            <strong>Nenhuma empresa disponível</strong>
            <span>
              {onOpenSettings
                ? "Nenhuma empresa ativa. Reative ou cadastre em Configurações."
                : "Peça a um master para atribuir empresas ao seu acesso."}
            </span>
            {onOpenSettings ? (
              <button className="primary-button company-select-settings" type="button" onClick={onOpenSettings}>
                <Settings size={16} />
                Abrir configurações
              </button>
            ) : null}
          </div>
        ) : (
          <div className="company-grid">
            {companies.map((company, index) => {
              const inbox = companyInbox(user, expenses, company.id);
              const open = openId === company.id;
              return (
                <div key={company.id} className="company-card-wrap">
                  <button
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
                      <small>NEGÓCIO</small>
                      <strong>{company.name}</strong>
                      <em>{company.legal_name}</em>
                    </div>
                    <div className="company-card-arrow">
                      <ArrowRight size={16} />
                    </div>
                  </button>
                  {inbox.length > 0 ? (
                    <button
                      type="button"
                      className="company-inbox-badge"
                      onClick={(event) => {
                        event.stopPropagation();
                        setOpenId(open ? null : company.id);
                      }}
                    >
                      <Bell size={14} />
                      {inbox.length}
                    </button>
                  ) : null}
                  {open ? (
                    <div className="company-inbox-popup">
                      <strong>
                        {user.role === "solicitante"
                          ? "Devolvidas e respondidas"
                          : "Em andamento e para aprovar"}
                      </strong>
                      {inbox.map((item) => (
                        <p key={item.id}>
                          {item.title} · {AREA_LABEL[item.area]} · {STATUS_LABEL[item.status]}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>
      <footer className="company-select-footer">
        <span>ROM Flow · Grupo ROM</span>
        {onOpenSettings ? (
          <button type="button" className="company-select-settings-link" onClick={onOpenSettings}>
            Configurações do grupo
          </button>
        ) : null}
      </footer>
    </div>
  );
}
