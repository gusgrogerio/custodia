// Single source of truth for occurrence types — used in NewCustody, History, Central, Details.

export const OCCURRENCE_TYPES = {
  desconhecido_no_local: 'Desconhecido no local',
  numero_nao_localizado: 'Número não localizado',
  numero_insuficiente: 'Número insuficiente',
  endereco_nao_localizado: 'Endereço não localizado',
  mudou_se: 'Mudou-se',
  cliente_ausente: 'Ausente',
  ausente_3: 'Ausente 3',
  restricao_acesso: 'Restrição de acesso',
  recusado: 'Recusado',
  caixa_postal: 'Caixa Postal (Correios)',
  entrega_reagendada: 'Entrega reagendada',
  outro: 'Outro',
};

// Occurrences that auto-mark a custody as "ready_for_return" upon creation/edit.
export const AUTO_RETURN_OCCURRENCES = new Set([
  'caixa_postal',
  'recusado',
  'ausente_3',
  'mudou_se',
]);

export function isAutoReturnOccurrence(type) {
  return AUTO_RETURN_OCCURRENCES.has(type);
}

export const TREATMENT_DAYS_THRESHOLD = 10;
export const NEAR_RETURN_THRESHOLD = 8;

/** Returns the human-readable treatment days summary. */
export function formatTreatmentDays(days, status) {
  const n = Number(days || 0);
  if (status === 'ready_for_return' || n >= TREATMENT_DAYS_THRESHOLD) {
    return `${n} dias com tratativa – Pode devolver`;
  }
  return `${n} dias com tratativa`;
}
