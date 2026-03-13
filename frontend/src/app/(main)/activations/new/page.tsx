'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import styles from './form.module.css';

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

export default function NewActivationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [areas, setAreas] = useState<AreaWithSubareas[]>([]);
  const [ccContacts, setCcContacts] = useState<CcContact[]>([]);
  const [selectedCcEmail, setSelectedCcEmail] = useState('');
  const [selected, setSelected] = useState<SelectedItem[]>([]);
  const [form, setForm] = useState({
    projectName: '',
    client: '',
    offerCode: '',
    hubspotUrl: '',
    body: '',
    attachmentUrlsText: '',
  });

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
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
    setLoading(true);
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
        hubspotUrl: form.hubspotUrl.trim() || undefined,
        areaIds,
        subAreaIds: subAreaIds.length ? subAreaIds : undefined,
        recipientCc: selectedCcEmail.trim() || undefined,
        body: form.body.trim() || undefined,
        attachmentUrls: attachmentUrls.length ? attachmentUrls : undefined,
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
      router.push('/activations');
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className={styles.page}>
      <Link href="/dashboard" className={styles.back}>← Inicio</Link>
      <h1 className={styles.h1}>Nueva activación</h1>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="projectName">Nombre del proyecto *</label>
          <input id="projectName" name="projectName" type="text" value={form.projectName} onChange={handleChange} required className={styles.input} placeholder="Implementación S/4HANA Public" />
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
          {selected.length === 0 && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--fiori-text-secondary)', marginTop: 'var(--fiori-space-1)' }}>
              Añade al menos un área (o subárea si aplica). Los destinatarios se asignarán según los contactos configurados.
            </p>
          )}
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
            list="cc-contacts-datalist"
            className={styles.input}
            placeholder="Escribe o elige un email en copia"
            aria-label="Email en copia (autocompletado desde contactos)"
            autoComplete="off"
          />
          <datalist id="cc-contacts-datalist">
            {ccContacts.map((c) => (
              <option key={c.id} value={c.email}>{c.name} ({c.email})</option>
            ))}
          </datalist>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="body">Cuerpo del correo</label>
          <textarea id="body" name="body" value={form.body} onChange={handleChange} className={styles.textarea} style={{ minHeight: 120 }} placeholder="Contenido del email (opcional)" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="attachmentUrlsText">URLs de adjuntos</label>
          <textarea id="attachmentUrlsText" name="attachmentUrlsText" value={form.attachmentUrlsText} onChange={handleChange} className={styles.textarea} style={{ minHeight: 60 }} placeholder="Una URL por línea o separadas por comas" />
        </div>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.actions}>
          <button type="submit" disabled={loading || selected.length === 0} className={styles.btnPrimary}>
            {loading ? 'Guardando…' : 'Guardar borrador'}
          </button>
          <Link href="/activations" className={styles.btnSecondary}>Cancelar</Link>
        </div>
      </form>
    </main>
  );
}
