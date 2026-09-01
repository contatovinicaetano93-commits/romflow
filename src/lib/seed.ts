import type { Database } from "./types";

export const SEED_REVISION = 6;

export const SEED: Database = {
  revision: SEED_REVISION,
  companies: [
    {
      id: "cmp_baru_brasil",
      name: "Baru Bistro Brasil",
      legal_name: "Baru Bistro Brasil Ltda.",
      slug: "baru-bistro-brasil",
      initials: "BBB",
      color: "#F59E0B",
      is_active: true,
    },
    {
      id: "cmp_baru_iguatemi",
      name: "Baru Bistro Iguatemi",
      legal_name: "Baru Bistro Iguatemi Ltda.",
      slug: "baru-bistro-iguatemi",
      initials: "BBI",
      color: "#3B82F6",
      is_active: true,
    },
    {
      id: "cmp_academy",
      name: "Rom Academy",
      legal_name: "Rom Academy Educacional Ltda.",
      slug: "rom-academy",
      initials: "RA",
      color: "#8B5CF6",
      is_active: true,
    },
    {
      id: "cmp_concept_brasil",
      name: "Rom Concept Brasil",
      legal_name: "Rom Concept Brasil Ltda.",
      slug: "rom-concept-brasil",
      initials: "RCB",
      color: "#EC4899",
      is_active: true,
    },
    {
      id: "cmp_concept_iguatemi",
      name: "Rom Concept Iguatemi",
      legal_name: "Rom Concept Iguatemi Ltda.",
      slug: "rom-concept-iguatemi",
      initials: "RCI",
      color: "#10B981",
      is_active: true,
    },
  ],
  categories: [
    { id: "cat_viagem", name: "Viagem", color: "#6366F1", is_active: true },
    { id: "cat_alim", name: "Alimentação", color: "#F59E0B", is_active: true },
    { id: "cat_esc", name: "Escritório", color: "#EC4899", is_active: true },
    { id: "cat_soft", name: "Software", color: "#10B981", is_active: true },
    { id: "cat_outros", name: "Outros", color: "#71717A", is_active: true },
  ],
  users: [
    {
      id: "usr_adm",
      name: "Rodrigo",
      email: "adm@romconcept.com.br",
      password: "demo",
      role: "admin",
      status: "active",
      companyIds: [
        "cmp_baru_brasil",
        "cmp_baru_iguatemi",
        "cmp_academy",
        "cmp_concept_brasil",
        "cmp_concept_iguatemi",
      ],
      created: "2026-01-10T12:00:00.000Z",
    },
  ],
  invitations: [],
  expenses: [],
  auditLogs: [],
};
