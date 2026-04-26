import { supabase } from "@/integrations/supabase/client";

export type AuditEntity =
  | "dossier"
  | "paiement"
  | "facture_fournisseur"
  | "compte"
  | "transfert"
  | "bank_transaction"
  | "rapprochement"
  | "export_comptable";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "validate"
  | "reject"
  | "import"
  | "export";

export interface LogAuditInput {
  userId: string | undefined | null;
  entity: AuditEntity;
  action: AuditAction;
  description: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}

/**
 * Insert an audit log row. Silent on failure (never blocks user actions).
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  if (!input.userId) return;
  try {
    await supabase.from("audit_logs").insert({
      user_id: input.userId,
      entity_type: input.entity,
      entity_id: input.entityId ?? null,
      action: input.action,
      description: input.description,
      old_value: input.oldValue ? JSON.parse(JSON.stringify(input.oldValue)) : null,
      new_value: input.newValue ? JSON.parse(JSON.stringify(input.newValue)) : null,
    });
  } catch {
    // never throw from an audit call
  }
}

export const ENTITY_LABELS: Record<AuditEntity, string> = {
  dossier: "Dossier",
  paiement: "Paiement",
  facture_fournisseur: "Facture fournisseur",
  compte: "Compte",
  transfert: "Transfert",
  bank_transaction: "Transaction bancaire",
  rapprochement: "Rapprochement",
  export_comptable: "Export comptable",
};

export const ACTION_LABELS: Record<AuditAction, string> = {
  create: "Création",
  update: "Modification",
  delete: "Suppression",
  validate: "Validation",
  reject: "Rejet",
  import: "Import",
  export: "Export",
};
