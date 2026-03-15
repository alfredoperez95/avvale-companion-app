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
type CcContact = { id: string; name: string; email: string };
type EmailTemplateItem = { id: string; name: string; content: string };
type SelectedArea = { type: 'area'; areaId: string; areaName: string };
type SelectedSubarea = { type: 'subarea'; subAreaId: string; subAreaName: string; areaId: string; areaName: string };
type SelectedItem = SelectedArea | SelectedSubarea;

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
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateItem[]>([]);
  const [selectedCcEmail, setSelectedCcEmail] = useState('');
  const [appliedTemplateName, setAppliedTemplateName] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
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
  });

  const computedSubject = `Activación AEP - ${(form.client || '').trim().toUpperCase()} - ${(form.projectName || '').trim()}`;

  useEffect(() => {
    apiFetch('/api/areas?withSubareas=true')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAreas(Array.isArray(data) ? data : []))
      .catch(() => setAreas([]));
  }, []);
  useEffect(() => {
    apiFetch('/api/contacts')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCcContacts(Array.isArray(data) ? data : []))
      .catch(() => setCcContacts([]));
  }, []);
  useEffect(() => {
    apiFetch('/api/email-templates')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setEmailTemplates(Array.isArray(data) ? data : []))
      .catch(() => setEmailTemplates([]));
  }, []);

  useEffect(() => {
    const p = getActivationPayloadFromHash();
    if (!p) return;
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
        recipientCc: selectedCcEmail.trim() || undefined,
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
      router.push(`/activations/${activationId}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <Link href="/dashboard" className={styles.back}>← Dashboard</Link>
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
          <input id="projectAmount" name="projectAmount" type="text" value={form.projectAmount} onChange={handleChange} required className={styles.input} placeholder="Ej. 150000" autoComplete="off" />
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
            Los contactos de Facturación y Administración se incluyen siempre en Para.
          </p>
        </div>
        <div className={styles.formGroupRow2}>
          <div id="form-group-subject" className={styles.formGroup}>
            <label className={styles.label} htmlFor="subject"><span className={styles.labelText}>Asunto email</span></label>
            <input id="subject" type="text" value={computedSubject} readOnly className={styles.inputReadOnly} aria-readonly="true" />
          </div>
          <div id="form-group-cc" className={styles.formGroup}>
            <label className={styles.label} htmlFor="cc"><span className={styles.labelText}>CC (opcional)</span></label>
            <input
              id="cc"
              type="text"
              value={selectedCcEmail}
              onChange={(e) => setSelectedCcEmail(e.target.value)}
              list={selectedCcEmail.trim().length > 2 ? 'contacts-datalist' : undefined}
              className={styles.input}
              placeholder="Escribe o elige un email en copia"
              aria-label="Email en copia (autocompletado desde contactos)"
              autoComplete="off"
            />
            <datalist id="contacts-datalist">
              {ccContacts.map((c) => (
                <option key={c.id} value={c.email}>{c.name} ({c.email})</option>
              ))}
            </datalist>
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
                if (t) {
                  setForm((prev) => ({
                    ...prev,
                    body: replaceTemplateVariables(t.content ?? '', prev),
                  }));
                  setAppliedTemplateName(t.name);
                }
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
              Cuerpo rellenado con la plantilla &quot;{appliedTemplateName}&quot;. Puedes modificarlo abajo.
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
          <Link href="/activations" className={styles.btnSecondary}>Cancelar</Link>
        </div>
      </form>
    </main>
  );
}
