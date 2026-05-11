export type KycChatQuickAction = { label: string; message: string };

const INTAKE_ACTIONS: KycChatQuickAction[] = [
  { label: 'Economía', message: 'Profundicemos en economía: ingresos, márgenes y escala.' },
  { label: 'Stack y sistemas', message: 'Detallemos el stack: ERP, CRM, cloud, integraciones y herramientas.' },
  { label: 'Modelo de negocio', message: 'Exploremos el modelo de negocio, propuesta de valor y canales.' },
  { label: 'Clientes', message: 'Hablemos de clientes: segmentos, concentración e ICP.' },
  { label: 'Organigrama', message: '¿Quiénes son las personas clave y cómo está organizado el equipo?' },
  { label: 'Procesos críticos', message: '¿Cuáles son los procesos críticos (pedido-cobro, compras, etc.)?' },
];

const RESEARCH_ACTIONS: KycChatQuickAction[] = [
  { label: 'Síntesis', message: 'Haz un resumen ejecutivo de lo que sabemos y qué falta por aclarar.' },
  { label: 'Riesgos y señales', message: '¿Qué riesgos o señales comerciales destacarías?' },
  {
    label: 'Competencia / partners (Avvale)',
    message:
      'Desde nuestro punto de vista (Avvale): ¿qué competidores y partners están presentes o influyen en la cuenta, y cómo están posicionados frente a nosotros?',
  },
  { label: 'Stack tech', message: 'Resume el stack tecnológico inferido y qué conviene confirmar.' },
  { label: 'Próximos pasos', message: 'Propón pendientes concretos para la próxima sesión (lista numerada).' },
];

const AVVALE_ACCOUNT_ACTION: KycChatQuickAction = {
  label: 'Avvale',
  message:
    'Quiero completar la ficha «Avvale» de esta cuenta desde el chat. ' +
    'Guíame con preguntas concretas y por orden sobre: (1) footprint de Avvale en el cliente (texto libre), ' +
    '(2) proyectos en la cuenta (pestaña «Proyectos»): pueden ser de Avvale o de otro partner; nombre, estado activo / en negociación / pasado y notas (p. ej. quién lidera), recogidos manualmente o vía chat, ' +
    '(3) presencia por líneas de solución: GROW, RUN, WISE, YUBIQ, SAIBORG y AXAZURE (AXAZURE solo si el foco es Dynamics 365 / BC / F&O / Power Platform de negocio; migraciones o hosting en Azure sin ese foco → RUN), con nota corta por línea donde aplique. ' +
    'Cuando yo aporte datos, en la última línea incluye KYC_PROPOSED_JSON con field_path avvale (objeto parcial con footprint, projects, solution_presence, solution_notes) o rutas avvale.footprint, avvale.projects, avvale.solution_presence, avvale.solution_notes para que queden guardados en el perfil.',
};

const PROJECTS_QUICK_ACTION: KycChatQuickAction = {
  label: 'Proyectos',
  message:
    'Quiero completar los proyectos en cuenta de esta empresa (pestaña «Proyectos»). ' +
    'Ayúdame a identificar o afilar cada uno: nombre, si está activo, en negociación, en análisis o pasado, y notas breves (partner, alcance, etc.). ' +
    'Cuando propongas datos para guardar, en la última línea incluye KYC_PROPOSED_JSON con field_path avvale y un objeto parcial { projects: [...] } o la ruta avvale.projects.',
};

export function buildKycChatQuickActions(opts: {
  sessionType: string | undefined;
  openQuestionCount: number;
  completeness: number | null;
}): KycChatQuickAction[] {
  const base = (opts.sessionType || '').toLowerCase() === 'intake' ? [...INTAKE_ACTIONS] : [...RESEARCH_ACTIONS];
  const extra: KycChatQuickAction[] = [AVVALE_ACCOUNT_ACTION, PROJECTS_QUICK_ACTION];

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
    if (out.length >= 9) break;
  }
  return out;
}
