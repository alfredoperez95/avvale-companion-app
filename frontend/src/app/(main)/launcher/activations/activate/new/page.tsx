'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { getActivationPayloadFromHash } from '@/lib/activation-payload';
import { parseHubSpotStyleProjectName } from '@/lib/parse-project-name';
import { RichTextEditor } from '@/components/RichTextEditor/RichTextEditor';
import { replaceTemplateVariables } from '@/lib/replace-template-variables';
import styles from './form.module.css';

type SubAreaOption = { id: string; name: string };
type AreaWithSubareas = { id: string; name: string; subAreas?: SubAreaOption[] };
type CcContact = { id: string; name: string; email: string; isProjectJp: boolean };
type ProjectJpAutoCandidate = { id: string; name: string; email: string };
type EmailTemplateItem = { id: string; name: string; content: string };
type SelectedArea = { type: 'area'; areaId: string; areaName: string };
type SelectedSubarea = { type: 'subarea'; subAreaId: string; subAreaName: string; areaId: string; areaName: string };
type SelectedItem = SelectedArea | SelectedSubarea;

/** Entradas CC manuales (añadidas por teclado y chips). */
type ManualCcEntry = { email: string; name: string; id?: string };

function manualCcKey(e: ManualCcEntry): string {
  return e.email.trim().toLowerCase();
}

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function buildManualCcEntriesFromDraft(draft: string, ccContacts: CcContact[]): ManualCcEntry[] {
  const parts = draft
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: ManualCcEntry[] = [];
  for (const part of parts) {
    const c = ccContacts.find((x) => x.email.trim().toLowerCase() === part.toLowerCase());
    const emailRaw = (c?.email ?? part).trim();
    if (!SIMPLE_EMAIL_RE.test(emailRaw)) continue;
    if (c) {
      out.push({ id: c.id, name: c.name, email: emailRaw });
    } else {
      out.push({ name: emailRaw, email: emailRaw });
    }
  }
  return out;
}

function selectedKey(item: SelectedItem): string {
  return item.type === 'area' ? `area:${item.areaId}` : `subarea:${item.subAreaId}`;
}
function selectedLabel(item: SelectedItem): string {
  return item.type === 'area' ? item.areaName : `${item.areaName} › ${item.subAreaName}`;
}

export default function NewActivationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [areas, setAreas] = useState<AreaWithSubareas[]>([]);
  const [ccContacts, setCcContacts] = useState<CcContact[]>([]);
  const [ccContactsLoaded, setCcContactsLoaded] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateItem[]>([]);
  const [manualCcEntries, setManualCcEntries] = useState<ManualCcEntry[]>([]);
  const [ccDraft, setCcDraft] = useState('');
  const [appliedTemplateName, setAppliedTemplateName] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [projectJpContactId, setProjectJpContactId] = useState<string>('');
  const [projectJpSearch, setProjectJpSearch] = useState('');
  const [pendingProjectManagerEmail, setPendingProjectManagerEmail] = useState('');
  const [projectManagerEmailWarning, setProjectManagerEmailWarning] = useState('');
  const [projectJpPreview, setProjectJpPreview] = useState<{ projectJpName: string | null; projectJpEmail: string | null; projectJpSource: string | null; autoCandidates: ProjectJpAutoCandidate[] }>({
    projectJpName: null,
    projectJpEmail: null,
    projectJpSource: null,
    autoCandidates: [],
  });
  const [bodySectionVisible, setBodySectionVisible] = useState(false);
  const [selected, setSelected] = useState<SelectedItem[]>([]);
  const [scannedAttachments, setScannedAttachments] = useState<{ url: string; name: string }[]>([]);
  const [addingUrl, setAddingUrl] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newUrlName, setNewUrlName] = useState('');
  const [form, setForm] = useState({
    projectName: '',
    client: '',
    offerCode: '',
    projectAmount: '',
    projectType: '' as '' | 'CONSULTORIA' | 'SW',
    hubspotUrl: '',
    body: '',
    projectJpName: '',
    projectJpEmail: '',
  });

  const computedSubject = `Activación AEP - ${(form.client || '').trim().toUpperCase()} - ${(form.projectName || '').trim()}`;

  const commitCcDraft = () => {
    const newOnes = buildManualCcEntriesFromDraft(ccDraft, ccContacts);
    if (newOnes.length === 0) return;
    setManualCcEntries((prev) => {
      const seen = new Set(prev.map(manualCcKey));
      const merged = [...prev];
      for (const e of newOnes) {
        const k = manualCcKey(e);
        if (!seen.has(k)) {
          seen.add(k);
          merged.push(e);
        }
      }
      return merged;
    });
    setCcDraft('');
  };

  useEffect(() => {
    apiFetch('/api/areas?withSubareas=true')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAreas(Array.isArray(data) ? data : []))
      .catch(() => setAreas([]));
  }, []);

  useEffect(() => {
    const areaIds = selected.filter((s): s is SelectedArea => s.type === 'area').map((s) => s.areaId);
    const subAreaIds = selected.filter((s): s is SelectedSubarea => s.type === 'subarea').map((s) => s.subAreaId);
    if (areaIds.length === 0 && subAreaIds.length === 0) {
      setProjectJpPreview({ projectJpName: null, projectJpEmail: null, projectJpSource: null, autoCandidates: [] });
      return;
    }
    const params = new URLSearchParams();
    areaIds.forEach((id) => params.append('areaIds', id));
    subAreaIds.forEach((id) => params.append('subAreaIds', id));
    if (projectJpContactId) params.set('projectJpContactId', projectJpContactId);
    apiFetch(`/api/activations/project-jp-preview?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data) return;
        setProjectJpPreview({
          projectJpName: data.projectJpName ?? null,
          projectJpEmail: data.projectJpEmail ?? null,
          projectJpSource: data.projectJpSource ?? null,
          autoCandidates: Array.isArray(data.autoCandidates) ? data.autoCandidates : [],
        });
        setForm((prev) => ({
          ...prev,
          projectJpName: data.projectJpName ?? '',
          projectJpEmail: data.projectJpEmail ?? '',
        }));
      })
      .catch(() => {});
  }, [selected, projectJpContactId]);
  useEffect(() => {
    apiFetch('/api/contacts')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCcContacts(Array.isArray(data) ? data : []))
      .catch(() => setCcContacts([]))
      .finally(() => setCcContactsLoaded(true));
  }, []);

  useEffect(() => {
    if (!ccContactsLoaded || !pendingProjectManagerEmail) return;
    const normalizedPendingEmail = pendingProjectManagerEmail.trim().toLowerCase();
    const matchedContact = ccContacts.find(
      (c) => c.email.trim().toLowerCase() === normalizedPendingEmail,
    );
    if (matchedContact) {
      setProjectJpContactId(matchedContact.id);
      setProjectJpSearch(`${matchedContact.name} (${matchedContact.email})`);
      setProjectManagerEmailWarning('');
    } else {
      setProjectJpContactId('');
      setProjectJpSearch(pendingProjectManagerEmail.trim());
      setProjectManagerEmailWarning(
        'El email de Project Manager recibido no coincide con un contacto. Si no seleccionas uno, JP quedará en automático.',
      );
    }
    setPendingProjectManagerEmail('');
  }, [ccContacts, ccContactsLoaded, pendingProjectManagerEmail]);
  useEffect(() => {
    apiFetch('/api/email-templates')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setEmailTemplates(Array.isArray(data) ? data : []))
      .catch(() => setEmailTemplates([]));
  }, []);

  useEffect(() => {
    if (!selectedTemplateId) return;
    const t = emailTemplates.find((x) => x.id === selectedTemplateId);
    if (!t) return;
    setForm((prev) => ({
      ...prev,
      body: replaceTemplateVariables(t.content ?? '', prev),
    }));
  }, [
    selectedTemplateId,
    emailTemplates,
    form.projectName,
    form.client,
    form.offerCode,
    form.projectAmount,
    form.projectType,
    form.hubspotUrl,
    form.projectJpName,
    form.projectJpEmail,
  ]);

  useEffect(() => {
    const p = getActivationPayloadFromHash();
    if (!p) return;
    const pmEmail = p.projectManagerEmail?.trim() || '';
    const projectTypeFromServiceType =
      p.serviceType === 'Consulting' ? 'CONSULTORIA' : p.serviceType === 'Software' ? 'SW' : '';
    const rawProjectName = p.projectName ?? '';
    const parsed = rawProjectName ? parseHubSpotStyleProjectName(rawProjectName) : null;
    const projectName = parsed ? parsed.projectDescription : rawProjectName || '';
    const client = parsed ? parsed.client : (p.client ?? '');
    setForm((prev) => ({
      ...prev,
      projectName: projectName || prev.projectName,
      client: client || prev.client,
      offerCode: p.offerCode ?? prev.offerCode,
      projectAmount: p.amount ?? prev.projectAmount,
      projectType: projectTypeFromServiceType || prev.projectType,
      hubspotUrl: p.hubspotUrl ?? prev.hubspotUrl,
    }));
    if (p.attachmentUrls?.length) {
      const names = p.attachmentNames ?? [];
      setScannedAttachments(
        p.attachmentUrls.map((url, i) => ({ url, name: (names[i] ?? '').trim() || url })),
      );
    }
    if (pmEmail) {
      setPendingProjectManagerEmail(pmEmail);
    }
    if (typeof history !== 'undefined' && typeof location !== 'undefined') {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const name = e.target.name;
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleProjectNameBlur = () => {
    const parsed = parseHubSpotStyleProjectName(form.projectName, areas.map((a) => a.name));
    if (!parsed) return;
    setForm((prev) => ({
      ...prev,
      projectName: parsed.projectDescription,
      ...(prev.client.trim() === '' ? { client: parsed.client } : {}),
    }));
  };

  const isAreaSelected = (areaId: string) => selected.some((s) => s.type === 'area' && s.areaId === areaId);
  const isSubareaSelected = (subAreaId: string) => selected.some((s) => s.type === 'subarea' && s.subAreaId === subAreaId);

  const addSelection = (value: string) => {
    if (value.startsWith('area:')) {
      const areaId = value.slice(5);
      const area = areas.find((a) => a.id === areaId);
      if (!area || isAreaSelected(areaId)) return;
      setSelected((prev) => [...prev, { type: 'area', areaId: area.id, areaName: area.name }]);
    } else if (value.startsWith('subarea:')) {
      const subAreaId = value.slice(8);
      for (const area of areas) {
        const sub = area.subAreas?.find((s) => s.id === subAreaId);
        if (sub) {
          if (isSubareaSelected(subAreaId) || isAreaSelected(area.id)) return;
          setSelected((prev) => [...prev, { type: 'subarea', subAreaId: sub.id, subAreaName: sub.name, areaId: area.id, areaName: area.name }]);
          return;
        }
      }
    }
  };

  const removeSelection = (key: string) => {
    if (key.startsWith('area:')) {
      setSelected((prev) => prev.filter((s) => s.type !== 'area' || s.areaId !== key.slice(5)));
    } else if (key.startsWith('subarea:')) {
      setSelected((prev) => prev.filter((s) => s.type !== 'subarea' || s.subAreaId !== key.slice(8)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (selected.length === 0) {
      setError('Selecciona al menos un área o subárea.');
      return;
    }
    if (!form.projectAmount.trim()) {
      setError('El importe del proyecto es obligatorio.');
      return;
    }
    if (!form.projectType) {
      setError('El tipo de oportunidad es obligatorio.');
      return;
    }
    setLoading(true);
    try {
      const validAttachments = scannedAttachments.filter((a) => a.url.trim());
      const attachmentUrls = validAttachments.map((a) => a.url.trim());
      const attachmentNames = validAttachments.map((a) => (a.name || a.url).trim());
      const areaIds = selected.filter((s): s is SelectedArea => s.type === 'area').map((s) => s.areaId);
      const subAreaIds = selected.filter((s): s is SelectedSubarea => s.type === 'subarea').map((s) => s.subAreaId);
      const body = {
        projectName: form.projectName.trim(),
        client: form.client.trim() || undefined,
        offerCode: form.offerCode.trim(),
        projectAmount: form.projectAmount.trim(),
        projectType: form.projectType,
        hubspotUrl: form.hubspotUrl.trim() || undefined,
        areaIds,
        subAreaIds: subAreaIds.length ? subAreaIds : undefined,
        recipientCc:
          manualCcEntries.length > 0
            ? manualCcEntries.map((e) => e.email.trim()).filter(Boolean).join(', ')
            : undefined,
        projectJpContactId: projectJpContactId || undefined,
        body: form.body.trim() || undefined,
        attachmentUrls: attachmentUrls.length ? attachmentUrls : undefined,
        attachmentNames: attachmentUrls.length ? attachmentNames : undefined,
      };
      const res = await apiFetch('/api/activations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        return;
      }
      if (!res.ok) {
        setError(Array.isArray(data.message) ? data.message.join(', ') : data.message ?? 'Error al guardar');
        return;
      }
      const activationId = (data as { id: string }).id;
      router.push(`/launcher/activations/activate/${activationId}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <Link href="/launcher" className={styles.back}>← Inicio</Link>
      <h1 className={styles.h1}>Nueva activación</h1>
      <form onSubmit={handleSubmit} className={styles.form} autoComplete="off">
        <div id="form-group-project-name" className={styles.formGroup}>
          <label className={styles.label} htmlFor="projectName"><span className={styles.labelText}>Nombre del proyecto</span> *</label>
          <input id="projectName" name="projectName" type="text" value={form.projectName} onChange={handleChange} onBlur={handleProjectNameBlur} required className={styles.input} placeholder="Implementación S/4HANA Public" autoComplete="off" />
        </div>
        <div id="form-group-client" className={styles.formGroup}>
          <label className={styles.label} htmlFor="client"><span className={styles.labelText}>Cliente</span></label>
          <input id="client" name="client" type="text" value={form.client} onChange={handleChange} className={styles.input} placeholder="Nombre del cliente" autoComplete="off" />
        </div>
        <div id="form-group-offer-code" className={styles.formGroup}>
          <label className={styles.label} htmlFor="offerCode"><span className={styles.labelText}>Código de oferta</span> *</label>
          <input id="offerCode" name="offerCode" type="text" value={form.offerCode} onChange={handleChange} required className={styles.input} placeholder="ESP_XX_XXXX" autoComplete="off" />
        </div>
        <div id="form-group-project-amount" className={styles.formGroup}>
          <label className={styles.label} htmlFor="projectAmount"><span className={styles.labelText}>Importe del proyecto</span> *</label>
          <input id="projectAmount" name="projectAmount" type="text" value={form.projectAmount} onChange={handleChange} required className={styles.input} placeholder="Ej. 150.000,00€" autoComplete="off" />
        </div>
        <div id="form-group-project-type" className={styles.formGroup}>
          <label className={styles.label} htmlFor="projectType"><span className={styles.labelText}>Tipo de oportunidad</span> *</label>
          <select id="projectType" name="projectType" value={form.projectType} onChange={handleChange} required className={styles.input} aria-label="Tipo de oportunidad" autoComplete="off">
            <option value="">— Seleccionar —</option>
            <option value="CONSULTORIA">Consultoría</option>
            <option value="SW">Software</option>
          </select>
        </div>
        <div id="form-group-hubspot-url" className={styles.formGroup}>
          <label className={styles.label} htmlFor="hubspotUrl"><span className={styles.labelText}>URL HubSpot</span></label>
          <input id="hubspotUrl" name="hubspotUrl" type="url" value={form.hubspotUrl} onChange={handleChange} className={styles.input} placeholder="https://app.hubspot.com/contacts/..../" autoComplete="off" />
        </div>
        <div id="form-group-areas" className={`${styles.formGroup} ${styles.formGroupFull}`}>
          <label className={styles.label}><span className={styles.labelText}>Áreas</span> *</label>
          <div className={styles.areaTagsRow}>
            <select
              className={styles.areaSelect}
              value=""
              autoComplete="off"
              onChange={(e) => {
                const v = e.target.value;
                if (v) {
                  addSelection(v);
                  e.target.value = '';
                }
              }}
              aria-label="Añadir área o subárea"
            >
              <option value="">Seleccionar área o subárea…</option>
              {areas.map((area) => {
                const wholeSelected = isAreaSelected(area.id);
                const hasSubareas = area.subAreas && area.subAreas.length > 0;
                return (
                  <optgroup key={area.id} label={area.name}>
                    {!wholeSelected && (
                      <option value={`area:${area.id}`}>
                        {area.name} (toda el área)
                      </option>
                    )}
                    {hasSubareas && !wholeSelected &&
                      area.subAreas!.filter((sub) => !isSubareaSelected(sub.id)).map((sub) => (
                        <option key={sub.id} value={`subarea:${sub.id}`}>
                          {area.name} › {sub.name}
                        </option>
                      ))}
                  </optgroup>
                );
              })}
            </select>
            {selected.map((item) => (
              <span key={selectedKey(item)} className={styles.areaTag}>
                {selectedLabel(item)}
                <button type="button" className={styles.areaTagRemove} onClick={() => removeSelection(selectedKey(item))} aria-label={`Quitar ${selectedLabel(item)}`}>×</button>
              </span>
            ))}
          </div>
          {selected.length === 0 && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--fiori-text-secondary)', marginTop: 'var(--fiori-space-1)' }}>
              Añade al menos un área (o subárea si aplica). Los destinatarios se asignarán según los contactos configurados.
            </p>
          )}
          <p style={{ fontSize: '0.8125rem', color: 'var(--fiori-text-secondary)', marginTop: 'var(--fiori-space-2)' }}>
            En Para se incluyen siempre Facturación/Administración, creador y JP. En CC se añaden automáticamente director y contactos de subárea.
          </p>
        </div>
        <div id="form-group-subject" className={`${styles.formGroup} ${styles.formGroupFull}`}>
          <label className={styles.label} htmlFor="subject"><span className={styles.labelText}>Asunto email</span></label>
          <input id="subject" type="text" value={computedSubject} readOnly className={styles.inputReadOnly} aria-readonly="true" />
        </div>
        <div className={styles.formGroupRow2}>
        <div id="form-group-project-jp" className={styles.formGroup}>
            <label className={styles.label} htmlFor="projectJpCustomSearch"><span className={styles.labelText}>JP del Proyecto</span></label>
            <input
              id="projectJpCustomSearch"
              list={projectJpSearch.trim().length >= 3 ? 'project-jp-contacts-new' : undefined}
              value={projectJpSearch}
              onChange={(e) => {
                const value = e.target.value;
                setProjectJpSearch(value);
                const selectedContact = ccContacts.find((c) => `${c.name} (${c.email})` === value);
                setProjectJpContactId(selectedContact?.id ?? '');
                setProjectManagerEmailWarning('');
              }}
              className={styles.input}
              placeholder="Busca y selecciona un contacto (vacío = automático)"
            />
            <datalist id="project-jp-contacts-new">
              {ccContacts
                .filter((c) =>
                  projectJpSearch.trim().length >= 3
                    ? `${c.name} ${c.email}`.toLowerCase().includes(projectJpSearch.trim().toLowerCase())
                    : false,
                )
                .map((c) => (
                <option key={c.id} value={`${c.name} (${c.email})`} />
                ))}
            </datalist>
            <p style={{ fontSize: '0.8125rem', color: 'var(--fiori-text-secondary)', marginTop: 'var(--fiori-space-1)' }}>
              {projectJpPreview.projectJpEmail ? (
                <strong>
                  {`Seleccionado: ${projectJpPreview.projectJpName} (${projectJpPreview.projectJpEmail}) [${projectJpPreview.projectJpSource ?? ''}]`}
                </strong>
              ) : (
                'Sin JP asignado. Marca contactos JP en áreas/subáreas o elige uno manual.'
              )}
            </p>
            {projectManagerEmailWarning && (
              <p style={{ fontSize: '0.8125rem', color: '#b71c1c', marginTop: 'var(--fiori-space-1)' }}>
                {projectManagerEmailWarning}
              </p>
            )}
        </div>
        <div id="form-group-cc" className={styles.formGroup}>
          <label className={styles.label} htmlFor="cc-input"><span className={styles.labelText}>CC (opcional)</span></label>
          <div className={styles.areaTagsRow}>
            <div style={{ display: 'flex', flex: '1 1 14rem', gap: 'var(--fiori-space-2)', alignItems: 'center', minWidth: '12rem' }}>
              <input
                id="cc-input"
                type="text"
                value={ccDraft}
                onChange={(e) => setCcDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitCcDraft();
                  }
                }}
                list={ccDraft.trim().length >= 3 ? 'contacts-datalist-cc-new' : undefined}
                className={styles.input}
                placeholder="Email (varios: separa por coma)"
                aria-label="Escribir email en copia"
                autoComplete="off"
                style={{ flex: 1, minWidth: 0 }}
              />
              <button type="button" className={styles.btnSecondary} onClick={commitCcDraft}>
                Añadir
              </button>
            </div>
            <datalist id="contacts-datalist-cc-new">
              {ccContacts.map((c) => (
                <option key={c.id} value={c.email}>
                  {c.name}
                </option>
              ))}
            </datalist>
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--fiori-text-secondary)', marginTop: 'var(--fiori-space-1)' }}>
            Escribe un email y pulsa Añadir o Enter; puedes encadenar varios. Director y subárea van en copia automáticamente.
          </p>
          <div className={styles.areaTagsRow} style={{ marginTop: 'var(--fiori-space-2)' }}>
            {manualCcEntries.map((entry) => (
              <span key={manualCcKey(entry)} className={styles.areaTag}>
                {entry.name} ({entry.email})
                <button
                  type="button"
                  className={styles.areaTagRemove}
                  onClick={() =>
                    setManualCcEntries((prev) => prev.filter((p) => manualCcKey(p) !== manualCcKey(entry)))
                  }
                  aria-label={`Quitar ${entry.email} de copia`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
        </div>
        <div id="form-group-template" className={`${styles.formGroup} ${styles.formGroupFull}`}>
          <label className={styles.label} htmlFor="template-select"><span className={styles.labelText}>Usar plantilla</span></label>
          <div className={styles.templateRow}>
            <select
              id="template-select"
              className={styles.input}
              value={selectedTemplateId}
              autoComplete="off"
              onChange={(e) => {
                const id = e.target.value;
                setSelectedTemplateId(id);
                if (!id) {
                  setAppliedTemplateName(null);
                  return;
                }
                const t = emailTemplates.find((x) => x.id === id);
                if (t) setAppliedTemplateName(t.name);
              }}
              style={{ maxWidth: '20rem' }}
            >
              <option value="">Sin plantilla</option>
              {emailTemplates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setBodySectionVisible(true)}
              aria-label={selectedTemplateId ? 'Previsualizar y editar el contenido de la plantilla' : 'Mostrar sección para personalizar el cuerpo del correo'}
            >
              {selectedTemplateId ? 'Modificar plantilla' : 'Personalizar email'}
            </button>
          </div>
          {appliedTemplateName && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--fiori-text-secondary)', marginTop: 'var(--fiori-space-1)' }}>
              Cuerpo generado desde la plantilla &quot;{appliedTemplateName}&quot;. Al cambiar datos del formulario se actualizan las variables; si editas el cuerpo a mano, esos cambios pueden perderse al modificar esos campos.
            </p>
          )}
        </div>
        {bodySectionVisible && (
          <div id="form-group-body" className={`${styles.formGroup} ${styles.formGroupFull}`}>
            <label className={styles.label} htmlFor="body"><span className={styles.labelText}>Cuerpo del correo</span></label>
            <RichTextEditor
              id="body"
              value={form.body}
              onChange={(value) => setForm((prev) => ({ ...prev, body: value }))}
              placeholder="Contenido del email (opcional)"
              minHeight={120}
              aria-label="Cuerpo del correo"
            />
          </div>
        )}
        {(scannedAttachments.length > 0 || addingUrl) && (
          <div id="form-group-scanned-urls" className={`${styles.formGroup} ${styles.formGroupFull}`}>
            <label className={styles.label}><span className={styles.labelText}>URLs escaneadas</span></label>
            {scannedAttachments.length > 0 && (
              <ul className={styles.attachmentList} style={{ margin: '0 0 var(--fiori-space-2)', paddingLeft: '1.2rem' }}>
                {scannedAttachments.map(({ url, name }, i) => (
                  <li key={i} style={{ marginBottom: 'var(--fiori-space-1)' }}>
                    <a href={url} target="_blank" rel="noopener noreferrer" className={styles.attachmentLink}>{name?.trim() || url}</a>
                    {' '}
                    <button type="button" className={styles.attachmentRemove} onClick={() => setScannedAttachments((prev) => prev.filter((_, j) => j !== i))} aria-label="Quitar">Quitar</button>
                  </li>
                ))}
              </ul>
            )}
            {addingUrl && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--fiori-space-2)', alignItems: 'center', marginBottom: 'var(--fiori-space-2)' }}>
                <input type="url" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className={styles.input} placeholder="URL" style={{ minWidth: '14rem' }} aria-label="URL" />
                <input type="text" value={newUrlName} onChange={(e) => setNewUrlName(e.target.value)} className={styles.input} placeholder="Título" style={{ minWidth: '10rem' }} aria-label="Título" />
                <button type="button" className={styles.btnSecondary} onClick={() => { if (newUrl.trim()) { setScannedAttachments((prev) => [...prev, { url: newUrl.trim(), name: newUrlName.trim() || newUrl.trim() }]); setNewUrl(''); setNewUrlName(''); setAddingUrl(false); } }}>Añadir</button>
                <button type="button" className={styles.btnSecondary} onClick={() => { setAddingUrl(false); setNewUrl(''); setNewUrlName(''); }}>Cancelar</button>
              </div>
            )}
            {!addingUrl && (
              <div style={{ display: 'flex', gap: 'var(--fiori-space-2)', flexWrap: 'wrap', marginTop: scannedAttachments.length > 0 ? 'var(--fiori-space-1)' : 0 }}>
                <button type="button" className={styles.btnSecondary} onClick={() => setAddingUrl(true)}>Añadir URL</button>
                <button type="button" className={styles.btnSecondary} onClick={() => { const raw = window.prompt('Pega una o más URLs (una por línea o separadas por comas)'); if (raw) { const urls = raw.split(/[\n,]/).map((u) => u.trim()).filter(Boolean); setScannedAttachments((prev) => [...prev, ...urls.map((url) => ({ url, name: url }))]); } }}>Pegar URLs</button>
              </div>
            )}
            <p style={{ fontSize: '0.8125rem', color: 'var(--fiori-text-secondary)', marginTop: 'var(--fiori-space-2)' }}>
              Los enlaces de HubSpot solo funcionan con tu sesión. Después de crear la activación, abre los enlaces, descarga los archivos y añádelos en la vista de detalle con &quot;Añadir archivos&quot;.
            </p>
          </div>
        )}
        {scannedAttachments.length === 0 && !addingUrl && (
          <div id="form-group-add-urls" className={`${styles.formGroup} ${styles.formGroupFull}`}>
            <button type="button" className={styles.btnSecondary} onClick={() => setAddingUrl(true)}>Añadir URLs escaneadas</button>
          </div>
        )}
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button type="submit" disabled={loading || selected.length === 0 || !form.projectAmount.trim() || !form.projectType} className={styles.btnPrimary}>
            {loading ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <Link href="/launcher/activations/activate" className={styles.btnSecondary}>Cancelar</Link>
        </div>
      </form>
    </main>
  );
}
