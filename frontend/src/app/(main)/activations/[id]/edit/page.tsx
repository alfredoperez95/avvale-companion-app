'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { parseHubSpotStyleProjectName } from '@/lib/parse-project-name';
import { downloadUrlsAndUploadAttachments } from '@/lib/download-urls-and-upload';
import styles from '../new/form.module.css';

type SubAreaOption = { id: string; name: string };
type AreaWithSubareas = { id: string; name: string; subAreas?: SubAreaOption[] };
type CcContact = { id: string; name: string; email: string };
type SelectedArea = { type: 'area'; areaId: string; areaName: string };
type SelectedSubarea = { type: 'subarea'; subAreaId: string; subAreaName: string; areaId: string; areaName: string };
type SelectedItem = SelectedArea | SelectedSubarea;

function selectedKey(item: SelectedItem): string {
  return item.type === 'area' ? `area:${item.areaId}` : `subarea:${item.subAreaId}`;
}
function selectedLabel(item: SelectedItem): string {
  return item.type === 'area' ? item.areaName : `${item.areaName} › ${item.subAreaName}`;
}

export default function EditActivationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const [fetchLoading, setFetchLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [areas, setAreas] = useState<AreaWithSubareas[]>([]);
  const [ccContacts, setCcContacts] = useState<CcContact[]>([]);
  const [selectedCcEmail, setSelectedCcEmail] = useState('');
  const [selected, setSelected] = useState<SelectedItem[]>([]);
  const [form, setForm] = useState({
    projectName: '',
    client: '',
    offerCode: '',
    projectAmount: '',
    projectType: '' as '' | 'CONSULTORIA' | 'SW',
    hubspotUrl: '',
    body: '',
    attachmentUrlsText: '',
  });
  const [attachments, setAttachments] = useState<{ id: string; fileName: string; originalUrl: string; contentType: string | null; createdAt: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [downloadingFromUrls, setDownloadingFromUrls] = useState(false);
  const [downloadResult, setDownloadResult] = useState<{ uploaded: number; total: number; errors: string[] } | null>(null);

  const computedSubject = `Activación AEP - ${(form.client || '').trim().toUpperCase()} - ${(form.projectName || '').trim()}`;

  useEffect(() => {
    apiFetch('/api/areas?withSubareas=true')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAreas(Array.isArray(data) ? data : []))
      .catch(() => setAreas([]));
  }, []);
  useEffect(() => {
    apiFetch('/api/cc-contacts')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCcContacts(Array.isArray(data) ? data : []))
      .catch(() => setCcContacts([]));
  }, []);

  useEffect(() => {
    if (!id) return;
    apiFetch(`/api/activations/${id}`)
      .then((r) => {
        if (r.status === 401) {
          window.location.href = '/login';
          return null;
        }
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (!data) {
          setLoadError('No se pudo cargar la activación');
          return;
        }
        if (data.status !== 'DRAFT') {
          router.replace(`/activations/${id}`);
          return;
        }
        let urlsText = '';
        if (data.attachmentUrls) {
          try {
            const arr = JSON.parse(data.attachmentUrls);
            urlsText = Array.isArray(arr) ? arr.join('\n') : data.attachmentUrls;
          } catch {
            urlsText = data.attachmentUrls;
          }
        }
        setForm({
          projectName: data.projectName ?? '',
          client: data.client ?? '',
          offerCode: data.offerCode ?? '',
          projectAmount: data.projectAmount ?? '',
          projectType: (data.projectType === 'CONSULTORIA' || data.projectType === 'SW' ? data.projectType : '') as '' | 'CONSULTORIA' | 'SW',
          hubspotUrl: data.hubspotUrl ?? '',
          body: data.body ?? '',
          attachmentUrlsText: urlsText,
        });
        setSelectedCcEmail((data.recipientCc ?? '').trim());
        const items: SelectedItem[] = [];
        (data.activationAreas ?? []).forEach((aa: { area: { id: string; name: string } }) => {
          items.push({ type: 'area', areaId: aa.area.id, areaName: aa.area.name });
        });
        (data.activationSubAreas ?? []).forEach((asa: { subArea: { id: string; name: string; area: { id: string; name: string } } }) => {
          const sub = asa.subArea;
          items.push({
            type: 'subarea',
            subAreaId: sub.id,
            subAreaName: sub.name,
            areaId: sub.area.id,
            areaName: sub.area.name,
          });
        });
        setSelected(items);
        setAttachments(data.attachments ?? []);
      })
      .catch(() => setLoadError('Error al cargar'))
      .finally(() => setFetchLoading(false));
  }, [id, router]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const name = e.target.name;
    const value = e.target.value;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleFileUploadEdit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!id || !files?.length) return;
    setUploadError('');
    setUploading(true);
    let failed = false;
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('file', files[i]);
        const res = await apiFetch(`/api/activations/${id}/attachments/upload`, { method: 'POST', body: formData });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setUploadError(data.message ?? 'Error al subir archivo');
          failed = true;
          break;
        }
      }
      if (!failed) {
        const r = await apiFetch(`/api/activations/${id}`);
        if (r.ok) {
          const data = await r.json();
          setAttachments(data.attachments ?? []);
        }
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDownloadFromUrls = async () => {
    if (!id) return;
    const urlList = form.attachmentUrlsText
      .split(/[\n,]/)
      .map((u) => u.trim())
      .filter(Boolean);
    if (urlList.length === 0) return;
    setDownloadResult(null);
    setDownloadingFromUrls(true);
    try {
      const result = await downloadUrlsAndUploadAttachments(id, urlList, apiFetch);
      setDownloadResult({
        uploaded: result.uploaded,
        total: urlList.length,
        errors: result.errors,
      });
      const r = await apiFetch(`/api/activations/${id}`);
      if (r.ok) {
        const data = await r.json();
        setAttachments(data.attachments ?? []);
      }
    } finally {
      setDownloadingFromUrls(false);
    }
  };

  const handleProjectNameBlur = () => {
    const parsed = parseHubSpotStyleProjectName(form.projectName);
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
    setSaving(true);
    try {
      const attachmentUrls = form.attachmentUrlsText
        .split(/[\n,]/)
        .map((u) => u.trim())
        .filter(Boolean);
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
      };
      const res = await apiFetch(`/api/activations/${id}`, {
        method: 'PATCH',
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
      router.push(`/activations/${id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  if (fetchLoading) return <p className={styles.error} style={{ padding: '2rem' }}>Cargando…</p>;
  if (loadError) return <p className={styles.error} style={{ padding: '2rem' }}>{loadError}</p>;

  return (
    <main className={styles.page}>
      <Link href={`/activations/${id}`} className={styles.back}>← Volver al detalle</Link>
      <h1 className={styles.h1}>Editar activación</h1>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="projectName">Nombre del proyecto *</label>
          <input id="projectName" name="projectName" type="text" value={form.projectName} onChange={handleChange} onBlur={handleProjectNameBlur} required className={styles.input} placeholder="Implementación S/4HANA Public" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="client">Cliente</label>
          <input id="client" name="client" type="text" value={form.client} onChange={handleChange} className={styles.input} placeholder="Nombre del cliente" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="offerCode">Código de oferta *</label>
          <input id="offerCode" name="offerCode" type="text" value={form.offerCode} onChange={handleChange} required className={styles.input} placeholder="ESP_XX_XXXX" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="projectAmount">Importe del proyecto *</label>
          <input id="projectAmount" name="projectAmount" type="text" value={form.projectAmount} onChange={handleChange} required className={styles.input} placeholder="Ej. 150000" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="projectType">Tipo de oportunidad *</label>
          <select id="projectType" name="projectType" value={form.projectType} onChange={handleChange} required className={styles.input} aria-label="Tipo de oportunidad">
            <option value="">— Seleccionar —</option>
            <option value="CONSULTORIA">Consultoría</option>
            <option value="SW">Software</option>
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="hubspotUrl">URL HubSpot</label>
          <input id="hubspotUrl" name="hubspotUrl" type="url" value={form.hubspotUrl} onChange={handleChange} className={styles.input} placeholder="https://app.hubspot.com/contacts/..../" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Áreas *</label>
          <div className={styles.areaTagsRow}>
            <select
              className={styles.areaSelect}
              value=""
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
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="subject">Asunto</label>
          <input id="subject" type="text" value={computedSubject} readOnly className={styles.inputReadOnly} aria-readonly="true" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="cc">CC (opcional)</label>
          <input
            id="cc"
            type="text"
            value={selectedCcEmail}
            onChange={(e) => setSelectedCcEmail(e.target.value)}
            list={selectedCcEmail.trim().length > 2 ? 'cc-contacts-datalist-edit' : undefined}
            className={styles.input}
            placeholder="Escribe o elige un email en copia"
            aria-label="Email en copia (autocompletado desde contactos)"
            autoComplete="off"
          />
          <datalist id="cc-contacts-datalist-edit">
            {ccContacts.map((c) => (
              <option key={c.id} value={c.email}>{c.name} ({c.email})</option>
            ))}
          </datalist>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="body">Cuerpo del correo</label>
          <textarea id="body" name="body" value={form.body} onChange={handleChange} className={styles.textarea} style={{ minHeight: 120 }} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="attachmentUrlsText">URLs recopiladas</label>
          <textarea id="attachmentUrlsText" name="attachmentUrlsText" value={form.attachmentUrlsText} onChange={handleChange} className={styles.textarea} style={{ minHeight: 60 }} placeholder="URLs recopiladas: una por línea o separadas por comas" aria-label="URLs recopiladas" />
          <p style={{ fontSize: '0.8125rem', color: 'var(--fiori-text-secondary)', marginTop: 'var(--fiori-space-1)' }}>
            Los enlaces de HubSpot no se pueden descargar automáticamente desde la app. Usa &quot;Abrir enlaces en nuevas pestañas&quot;, descarga los archivos con tu sesión y súbelos con &quot;Añadir archivos&quot;.
          </p>
          {form.attachmentUrlsText.trim().length > 0 && (
            <div style={{ marginTop: 'var(--fiori-space-1)', display: 'flex', gap: 'var(--fiori-space-2)', flexWrap: 'wrap' }}>
              <button type="button" className={styles.btnSecondary} onClick={() => form.attachmentUrlsText.split(/[\n,]/).map((u) => u.trim()).filter(Boolean).forEach((u) => window.open(u, '_blank', 'noopener'))}>
                Abrir enlaces en nuevas pestañas
              </button>
              <button type="button" className={styles.btnSecondary} onClick={handleDownloadFromUrls} disabled={downloadingFromUrls}>
                {downloadingFromUrls ? 'Descargando y adjuntando…' : 'Intentar descargar desde enlaces'}
              </button>
            </div>
          )}
          {downloadResult != null && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--fiori-text-secondary)', marginTop: 'var(--fiori-space-1)' }}>
              {downloadResult.uploaded > 0 ? `${downloadResult.uploaded} de ${downloadResult.total} adjuntos descargados.` : 'No se pudieron descargar automáticamente.'}
              {downloadResult.errors.length > 0 && (
                <> Usa &quot;Abrir enlaces en nuevas pestañas&quot; y luego &quot;Añadir archivos&quot;.</>
              )}
            </p>
          )}
        </div>
        <div className={styles.formGroup}>
          <span className={styles.label}>Archivos adjuntos</span>
          {attachments.length > 0 && (
            <ul style={{ margin: 'var(--fiori-space-1) 0 0', paddingLeft: '1.2rem' }}>
              {attachments.map((att) => (
                <li key={att.id}>{att.fileName}</li>
              ))}
            </ul>
          )}
          <p style={{ fontSize: '0.8125rem', color: 'var(--fiori-text-secondary)', marginTop: 'var(--fiori-space-1)' }}>
            Añade archivos descargados desde HubSpot (o desde tu ordenador).
          </p>
          <label className={styles.btnSecondary} style={{ display: 'inline-block', marginTop: 'var(--fiori-space-1)', cursor: uploading ? 'not-allowed' : 'pointer' }}>
            <input type="file" multiple disabled={uploading} onChange={handleFileUploadEdit} style={{ display: 'none' }} />
            {uploading ? 'Subiendo…' : 'Añadir archivos'}
          </label>
          {uploadError && <p className={styles.error} style={{ marginTop: 'var(--fiori-space-1)' }}>{uploadError}</p>}
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button type="submit" disabled={saving || selected.length === 0 || !form.projectAmount.trim() || !form.projectType} className={styles.btnPrimary}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <Link href={`/activations/${id}`} className={styles.btnSecondary}>Cancelar</Link>
        </div>
      </form>
    </main>
  );
}
