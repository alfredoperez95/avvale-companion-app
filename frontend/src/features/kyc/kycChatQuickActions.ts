export type KycChatQuickAction = { label: string; message: string };

const INTAKE_ACTIONS: KycChatQuickAction[] = [
  { label: 'Economía y márgenes', message: 'Profundicemos en economía: ingresos, márgenes y escala.' },
  { label: 'Stack y sistemas', message: 'Detallemos el stack: ERP, CRM, cloud, integraciones y herramientas.' },
  { label: 'Modelo de negocio', message: 'Exploremos el modelo de negocio, propuesta de valor y canales.' },
  { label: 'Clientes', message: 'Hablemos de clientes: segmentos, concentración e ICP.' },
  { label: 'Organigrama', message: '¿Quiénes son las personas clave y cómo está organizado el equipo?' },
  { label: 'Procesos críticos', message: '¿Cuáles son los procesos críticos (pedido-cobro, compras, etc.)?' },
];

const RESEARCH_ACTIONS: KycChatQuickAction[] = [
  { label: 'Síntesis', message: 'Haz un resumen ejecutivo de lo que sabemos y qué falta por aclarar.' },
  { label: 'Riesgos y señales', message: '¿Qué riesgos o señales comerciales destacarías?' },
  { label: 'Competencia', message: '¿Cómo se sitúa frente a la competencia en su sector?' },
  { label: 'Stack tech', message: 'Resume el stack tecnológico inferido y qué conviene confirmar.' },
  { label: 'Próximos pasos', message: 'Propón pendientes concretos para la próxima sesión (lista numerada).' },
];

export function buildKycChatQuickActions(opts: {
  sessionType: string | undefined;
  openQuestionCount: number;
  completeness: number | null;
}): KycChatQuickAction[] {
  const base = (opts.sessionType || '').toLowerCase() === 'intake' ? [...INTAKE_ACTIONS] : [...RESEARCH_ACTIONS];
  const extra: KycChatQuickAction[] = [];

  if (opts.openQuestionCount > 0) {
    extra.push({
      label: 'Ver pendientes',
      message:
        'Tengo preguntas en el tablero «Por resolver». ¿Cuál debería priorizar y cómo la formularías?',
    });
  }

  if (opts.completeness != null && opts.completeness < 60) {
    extra.push({
      label: 'Completar perfil',
      message: `El completado del perfil es ${opts.completeness}%. ¿Qué bloques conviene rellenar primero y con qué preguntas?`,
    });
  }

  const seen = new Set<string>();
  const out: KycChatQuickAction[] = [];
  for (const a of [...extra, ...base]) {
    const k = a.message.slice(0, 120);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(a);
    if (out.length >= 8) break;
  }
  return out;
}
