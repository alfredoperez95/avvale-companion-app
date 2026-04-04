'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch, apiUpload } from '@/lib/api';
import { parseHubSpotStyleProjectName } from '@/lib/parse-project-name';
import { AttachmentGrid } from '@/components/AttachmentGrid/AttachmentGrid';
import { RichTextEditor } from '@/components/RichTextEditor/RichTextEditor';
import { replaceTemplateVariables, replaceUrlsEscaneadasPlaceholder } from '@/lib/replace-template-variables';
import { formatActivationCode } from '@/lib/activation-code';
import { getActivationPayloadFromHash } from '@/lib/activation-payload';
import { PageBreadcrumb, PageBackLink, PageHero } from '@/components/page-hero';
import styles from '../../new/form.module.css';

type SubAreaOption = { id: string; name: string };
type AreaWithSubareas = { id: string; name: string; subAreas?: SubAreaOption[] };
type CcContact = { id: string; name: string; email: string; isProjectJp: boolean };
type ProjectJpAutoCandidate = { id: string; name: string; email: string };
type EmailTemplateItem = { id: string; name: string; content: string };
type SelectedArea = { type: 'area'; areaId: string; areaName: string };
type SelectedSubarea = { type: 'subarea'; subAreaId: string; subAreaName: string; areaId: string; areaName: string };
type SelectedItem = SelectedArea | SelectedSubarea;

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
  const [ccContactsLoaded, setCcContactsLoaded] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplateItem[]>([]);
  const [manualCcEntries, setManualCcEntries] = useState<ManualCcEntry[]>([]);
  const [ccDraft, setCcDraft] = useState('');
  /** Fuerza reconciliación con el directorio CC tras cargar la activación (evita cierre stale de ccContacts). */
  const [manualCcHydrateKey, setManualCcHydrateKey] = useState(0);
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
  const [appliedTemplateName, setAppliedTemplateName] = useState<string | null>(null);
  /** Plantilla cuyo HTML crudo se re-sustituye al cambiar el formulario. */
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedItem[]>([]);
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
    attachmentUrlsText: '',
    attachmentNames: [] as string[],
  });
  const [attachments, setAttachments] = useState<{ id: string; fileName: string; originalUrl: string; contentType: string | null; createdAt: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  const [newUrl, setNewUrl] = useState('');
  const [newUrlName, setNewUrlName] = useState('');
  const [activationNumber, setActivationNumber] = useState<number | null>(null);

  const computedSubject =
    activationNumber != null
      ? `Activación AEP - ${(form.client || '').trim().toUpperCase()} - ${(form.projectName || '').trim()} [${formatActivationCode(activationNumber)}]`
      : `Activación AEP - ${(form.client || '').trim().toUpperCase()} - ${(form.projectName || '').trim()}`;

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
    apiFetch('/api/contacts')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setCcContacts(Array.isArray(data) ? data : []))
      .catch(() => setCcContacts([]))
      .finally(() => setCcContactsLoaded(true));
  }, []);

  useEffect(() => {
    const payload = getActivationPayloadFromHash();
    const pmEmail = payload?.projectManagerEmail?.trim() || '';
    if (!pmEmail) return;
    setPendingProjectManagerEmail(pmEmail);
    if (typeof history !== 'undefined' && typeof location !== 'undefined') {
      history.replaceState(null, '', location.pathname + location.search);
    }
  }, []);

  useEffect(() => {
    if (!ccContactsLoaded || !pendingProjectManagerEmail) return;
    if (projectJpContactId || projectJpSearch.trim()) {
      setPendingProjectManagerEmail('');
      return;
    }
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
  }, [ccContacts, ccContactsLoaded, pendingProjectManagerEmail, projectJpContactId, projectJpSearch]);

  useEffect(() => {
    if (ccContacts.length === 0) return;
    setManualCcEntries((prev) => {
      let changed = false;
      const next = prev.map((entry) => {
        const c = ccContacts.find(
          (x) => x.email.trim().toLowerCase() === entry.email.trim().toLowerCase(),
        );
        if (c && (entry.id !== c.id || entry.name !== c.name || entry.email !== c.email.trim())) {
          changed = true;
          return { id: c.id, name: c.name, email: c.email.trim() };
        }
        return entry;
      });
      return changed ? next : prev;
    });
  }, [ccContacts, manualCcHydrateKey]);
  useEffect(() => {
    apiFetch('/api/email-templates')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setEmailTemplates(Array.isArray(data) ? data : []))
      .catch(() => setEmailTemplates([]));
  }, []);

  useEffect(() => {
    if (!appliedTemplateId) return;
    const t = emailTemplates.find((x) => x.id === appliedTemplateId);
    if (!t) return;
    setForm((prev) => {
      const urlList = prev.attachmentUrlsText
        .split(/[\n,]/)
        .map((u) => u.trim())
        .filter(Boolean);
      const scannedUrls = urlList.map((url, i) => ({
        url,
        name: (prev.attachmentNames[i] ?? '').trim() || url,
      }));
      return {
        ...prev,
        body: replaceTemplateVariables(t.content ?? '', {
          ...prev,
          scannedUrls,
          hasUploadedAttachments: attachments.length > 0,
        }),
      };
    });
  }, [
    appliedTemplateId,
    emailTemplates,
    form.projectName,
    form.client,
    form.offerCode,
    form.projectAmount,
    form.projectType,
    form.hubspotUrl,
    form.projectJpName,
    form.projectJpEmail,
    form.attachmentUrlsText,
    form.attachmentNames,
    attachments.length,
  ]);

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
          router.replace(`/launcher/activations/activate/${id}`);
          return;
        }
        if (typeof data.activationNumber === 'number') {
          setActivationNumber(data.activationNumber);
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
        let namesArr: string[] = [];
        if (data.attachmentNames) {
          try {
            const parsed = JSON.parse(data.attachmentNames);
            namesArr = Array.isArray(parsed) ? parsed : [];
          } catch {
            namesArr = [];
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
          projectJpName: data.projectJpName ?? '',
          projectJpEmail: data.projectJpEmail ?? '',
          attachmentUrlsText: urlsText,
          attachmentNames: namesArr,
        });
        setProjectJpPreview({
          projectJpName: data.projectJpName ?? null,
          projectJpEmail: data.projectJpEmail ?? null,
          projectJpSource: data.projectJpSource ?? null,
          autoCandidates: [],
        });
        const rawManual = Array.isArray(data.manualCcEmails) ? data.manualCcEmails : [];
        setManualCcEntries(
          rawManual
            .map((em: string) => {
              const email = String(em).trim();
              if (!email) return null;
              return { name: email, email };
            })
            .filter((x: ManualCcEntry | null): x is ManualCcEntry => x != null),
        );
        setManualCcHydrateKey((k) => k + 1);
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

  useEffect(() => {
    const areaIds = selected.filter((s): s is SelectedArea => s.type === 'area').map((s) => s.areaId);
    const subAreaIds = selected.filter((s): s is SelectedSubarea => s.type === 'subarea').map((s) => s.subAreaId);
    if (areaIds.length === 0 && subAreaIds.length === 0) return;
    const params = new URLSearchParams();
    areaIds.forEach((x) => params.append('areaIds', x));
    subAreaIds.forEach((x) => params.append('subAreaIds', x));
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
    setUploadProgress(0);
    let failed = false;
    const allFiles = Array.from(files);
    const totalBytes = allFiles.reduce((acc, file) => acc + Math.max(file.size, 1), 0);
    let uploadedBytes = 0;
    try {
      for (let i = 0; i < allFiles.length; i++) {
        const formData = new FormData();
        const file = allFiles[i];
        formData.append('file', file);
        const res = await apiUpload(`/api/activations/${id}/attachments/upload`, formData, (loaded) => {
          const current = uploadedBytes + loaded;
          setUploadProgress(Math.min(100, Math.round((current / totalBytes) * 100)));
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setUploadError(data.message ?? 'Error al subir archivo');
          failed = true;
          break;
        }
        uploadedBytes += Math.max(file.size, 1);
        setUploadProgress(Math.min(100, Math.round((uploadedBytes / totalBytes) * 100)));
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
    setSaving(true);
    try {
      const attachmentUrls = form.attachmentUrlsText
        .split(/[\n,]/)
        .map((u) => u.trim())
        .filter(Boolean);
      const attachmentNames = attachmentUrls.map((_, i) => form.attachmentNames[i] ?? '');
      const scannedUrls = attachmentUrls.map((url, i) => ({
        url,
        name: (form.attachmentNames[i] ?? '').trim() || url,
      }));
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
        body:
          replaceUrlsEscaneadasPlaceholder(form.body.trim(), {
            ...form,
            scannedUrls,
            hasUploadedAttachments: attachments.length > 0,
          }).trim() || undefined,
        attachmentUrls: attachmentUrls.length ? attachmentUrls : undefined,
        attachmentNames: attachmentUrls.length ? attachmentNames : undefined,
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
      router.push(`/launcher/activations/activate/${id}`);
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  if (fetchLoading) return null;
  if (loadError) return <p className={`${styles.error} ${styles.errorStandalone}`}>{loadError}</p>;

  return (
    <main className={styles.page}>
      <PageBreadcrumb>
        <PageBackLink href={`/launcher/activations/activate/${id}`}>← Volver al detalle</PageBackLink>
      </PageBreadcrumb>
      <PageHero
        title="Editar activación"
        subtitle="Modifica los datos y guarda los cambios; el detalle reflejará la versión actualizada."
      />
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="projectName">Nombre del proyecto *</label>
          <input id="projectName" name="projectName" type="text" value={form.projectName} onChange={handleChange} onBlur={handleProjectNameBlur} required className={styles.input} placeholder="Implementación S/4HANA Public" />
        </div>
        <div className={styles.formGroupRow2}>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="projectJpCustomSearchEdit">JP del Proyecto</label>
          <input
            id="projectJpCustomSearchEdit"
            list={projectJpSearch.trim().length >= 3 ? 'project-jp-contacts-edit' : undefined}
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
          <datalist id="project-jp-contacts-edit">
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
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="cc-input-edit">CC (opcional)</label>
          <div className={styles.areaTagsRow}>
            <div style={{ display: 'flex', flex: '1 1 14rem', gap: 'var(--fiori-space-2)', alignItems: 'center', minWidth: '12rem' }}>
              <input
                id="cc-input-edit"
                type="text"
                value={ccDraft}
                onChange={(e) => setCcDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    commitCcDraft();
                  }
                }}
                list={ccDraft.trim().length >= 3 ? 'contacts-datalist-cc-edit' : undefined}
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
            <datalist id="contacts-datalist-cc-edit">
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
          <input id="projectAmount" name="projectAmount" type="text" value={form.projectAmount} onChange={handleChange} required className={styles.input} placeholder="Ej. 150.000,00€" />
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
          <p style={{ fontSize: '0.8125rem', color: 'var(--fiori-text-secondary)', marginTop: 'var(--fiori-space-2)' }}>
            En Para se incluyen siempre Facturación/Administración, creador y JP. En CC se añaden automáticamente director y contactos de subárea.
          </p>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="subject">Asunto</label>
          <input id="subject" type="text" value={computedSubject} readOnly className={styles.inputReadOnly} aria-readonly="true" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="template-select-edit">Usar plantilla</label>
          <select
            id="template-select-edit"
            className={styles.input}
            value=""
            onChange={(e) => {
              const templateId = e.target.value;
              if (!templateId) return;
              const t = emailTemplates.find((x) => x.id === templateId);
              if (t) {
                setAppliedTemplateId(templateId);
                setAppliedTemplateName(t.name);
              }
              e.target.value = '';
            }}
            style={{ maxWidth: '20rem' }}
          >
            <option value="">Sin plantilla</option>
            {emailTemplates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {appliedTemplateName && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--fiori-text-secondary)', marginTop: 'var(--fiori-space-1)' }}>
              Cuerpo generado desde la plantilla &quot;{appliedTemplateName}&quot;. Al cambiar datos del formulario se actualizan las variables; si editas el cuerpo a mano, esos cambios pueden perderse al modificar esos campos.
            </p>
          )}
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="body">Cuerpo del correo</label>
          <RichTextEditor
            id="body"
            value={form.body}
            onChange={(value) => setForm((prev) => ({ ...prev, body: value }))}
            placeholder="Contenido del email (opcional)"
            minHeight={120}
            aria-label="Cuerpo del correo"
          />
        </div>
        {(() => {
          const urlList = form.attachmentUrlsText.split(/[\n,]/).map((u) => u.trim()).filter(Boolean);
          const attachmentList = urlList.map((url, i) => ({ url, name: (form.attachmentNames[i] ?? '').trim() || url }));
          const removeScanned = (index: number) => {
            const next = attachmentList.filter((_, j) => j !== index);
            setForm((prev) => ({
              ...prev,
              attachmentUrlsText: next.map((a) => a.url).join('\n'),
              attachmentNames: next.map((a) => a.name),
            }));
          };
          const addScanned = (url: string, name: string) => {
            setForm((prev) => ({
              ...prev,
              attachmentUrlsText: prev.attachmentUrlsText ? prev.attachmentUrlsText + '\n' + url : url,
              attachmentNames: [...(prev.attachmentNames ?? []), name || url],
            }));
            setNewUrl('');
            setNewUrlName('');
            setAddingUrl(false);
          };
          return (
            <>
              {(attachmentList.length > 0 || addingUrl) && (
                <div className={styles.formGroup}>
                  <label className={styles.label}>URLs escaneadas</label>
                  {attachmentList.length > 0 && (
                    <ul className={styles.attachmentList} style={{ margin: '0 0 var(--fiori-space-2)', paddingLeft: '1.2rem' }}>
                      {attachmentList.map(({ url, name }, i) => (
                        <li key={i} style={{ marginBottom: 'var(--fiori-space-1)' }}>
                          <a href={url} target="_blank" rel="noopener noreferrer" className={styles.attachmentLink}>{name?.trim() || url}</a>
                          {' '}
                          <button type="button" className={styles.attachmentRemove} onClick={() => removeScanned(i)} aria-label="Quitar">Quitar</button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {addingUrl && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--fiori-space-2)', alignItems: 'center', marginBottom: 'var(--fiori-space-2)' }}>
                      <input type="url" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} className={styles.input} placeholder="URL" style={{ minWidth: '14rem' }} aria-label="URL" />
                      <input type="text" value={newUrlName} onChange={(e) => setNewUrlName(e.target.value)} className={styles.input} placeholder="Título" style={{ minWidth: '10rem' }} aria-label="Título" />
                      <button type="button" className={styles.btnSecondary} onClick={() => { if (newUrl.trim()) addScanned(newUrl.trim(), newUrlName.trim() || newUrl.trim()); }}>Añadir</button>
                      <button type="button" className={styles.btnSecondary} onClick={() => { setAddingUrl(false); setNewUrl(''); setNewUrlName(''); }}>Cancelar</button>
                    </div>
                  )}
                  {!addingUrl && (
                    <div style={{ display: 'flex', gap: 'var(--fiori-space-2)', flexWrap: 'wrap', marginTop: attachmentList.length > 0 ? 'var(--fiori-space-1)' : 0 }}>
                      <button type="button" className={styles.btnSecondary} onClick={() => setAddingUrl(true)}>Añadir URL</button>
                      <button type="button" className={styles.btnSecondary} onClick={() => { const raw = window.prompt('Pega una o más URLs (una por línea o separadas por comas)'); if (raw) { const urls = raw.split(/[\n,]/).map((u) => u.trim()).filter(Boolean); setForm((prev) => ({ ...prev, attachmentUrlsText: prev.attachmentUrlsText ? prev.attachmentUrlsText + '\n' + urls.join('\n') : urls.join('\n'), attachmentNames: [...(prev.attachmentNames ?? []), ...urls.map((u) => u)] })); } }}>Pegar URLs</button>
                    </div>
                  )}
                  {attachmentList.length > 0 && (
                    <div style={{ marginTop: 'var(--fiori-space-1)', display: 'flex', gap: 'var(--fiori-space-2)', flexWrap: 'wrap' }}>
                      <button type="button" className={styles.btnSecondary} onClick={() => attachmentList.forEach(({ url }) => window.open(url, '_blank', 'noopener'))}>
                        Descargar todos los adjuntos
                      </button>
                    </div>
                  )}
                  <p style={{ fontSize: '0.8125rem', color: 'var(--fiori-text-secondary)', marginTop: 'var(--fiori-space-2)' }}>
                    Los enlaces de HubSpot no se pueden descargar automáticamente. Usa &quot;Descargar todos los adjuntos&quot;, descarga con tu sesión y súbelos con &quot;Añadir archivos&quot;.
                  </p>
                </div>
              )}
              {attachmentList.length === 0 && !addingUrl && (
                <div className={styles.formGroup}>
                  <button type="button" className={styles.btnSecondary} onClick={() => setAddingUrl(true)}>Añadir URLs escaneadas</button>
                </div>
              )}
            </>
          );
        })()}
        <div className={styles.formGroup}>
          <span className={styles.label}>Archivos adjuntos</span>
          {attachments.length > 0 && (
            <div style={{ marginTop: 'var(--fiori-space-1)' }}>
              <AttachmentGrid
                attachments={attachments}
                activationId={id!}
                apiFetch={apiFetch}
                onDeleted={async () => {
                  const r = await apiFetch(`/api/activations/${id}`);
                  if (r.ok) {
                    const data = await r.json();
                    setAttachments(data.attachments ?? []);
                  }
                }}
              />
            </div>
          )}
          <p style={{ fontSize: '0.8125rem', color: 'var(--fiori-text-secondary)', marginTop: 'var(--fiori-space-1)' }}>
            Añade archivos descargados desde HubSpot (o desde tu ordenador).
          </p>
          <label className={styles.btnSecondary} style={{ display: 'inline-block', marginTop: 'var(--fiori-space-1)', cursor: uploading ? 'not-allowed' : 'pointer' }}>
            <input type="file" multiple disabled={uploading} onChange={handleFileUploadEdit} style={{ display: 'none' }} />
            {uploading ? 'Subiendo…' : 'Añadir archivos'}
          </label>
          {uploading && (
            <div className={styles.uploadProgressWrap} aria-live="polite">
              <div className={styles.uploadProgressBar} style={{ width: `${uploadProgress}%` }} />
              <span className={styles.uploadProgressText}>{uploadProgress}%</span>
            </div>
          )}
          {uploadError && <p className={`${styles.error} ${styles.errorMarginTop}`}>{uploadError}</p>}
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button type="submit" disabled={saving || selected.length === 0 || !form.projectAmount.trim() || !form.projectType} className={styles.btnPrimary}>
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          <Link href={`/launcher/activations/activate/${id}`} className={styles.btnSecondary}>Cancelar</Link>
        </div>
      </form>
    </main>
  );
}
