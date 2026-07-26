'use client';

import { FormEvent, useEffect, useState } from 'react';
import { PageBreadcrumb, PageBackLink, PageHero } from '@/components/page-hero';
import { apiFetch, redirectToLogin } from '@/lib/api';
import styles from '../page.module.css';

type CatalogItem = {
  id: string;
  tipoSw: string;
  practica: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export default function SwFormsConfigurationPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [originalById, setOriginalById] = useState<Record<string, CatalogItem>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTipoSw, setNewTipoSw] = useState('');
  const [newPractica, setNewPractica] = useState('');
  const [newSortOrder, setNewSortOrder] = useState('');
  const [query, setQuery] = useState('');
  const [practiceFilter, setPracticeFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const practiceOptions = [...new Set(items.map((item) => item.practica).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
  const filteredItems = items.filter((item) => {
    const q = query.trim().toLowerCase();
    const matchesQuery = !q || item.tipoSw.toLowerCase().includes(q) || item.practica.toLowerCase().includes(q);
    const matchesPractice = !practiceFilter || item.practica === practiceFilter;
    return matchesQuery && matchesPractice;
  });

  useEffect(() => {
    loadCatalog();
  }, []);

  async function loadCatalog() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/sw-forms/catalog/admin');
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (res.status === 403) {
        throw new Error('Solo los administradores pueden configurar el catálogo de SW.');
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(extractApiError(text) ?? 'No se pudo cargar el catálogo.');
      }
      const data = (await res.json()) as CatalogItem[];
      setItems(data);
      setOriginalById(Object.fromEntries(data.map((item) => [item.id, item])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo cargar el catálogo.');
    } finally {
      setLoading(false);
    }
  }

  const updateDraft = (id: string, patch: Partial<CatalogItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const isDirty = (item: CatalogItem): boolean => {
    const original = originalById[item.id];
    if (!original) return false;
    return original.tipoSw !== item.tipoSw || original.practica !== item.practica || original.sortOrder !== item.sortOrder;
  };

  const createItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTipoSw.trim() || !newPractica.trim()) {
      setError('Completa Tipo SW y Práctica.');
      return;
    }

    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch('/api/sw-forms/catalog/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoSw: newTipoSw,
          practica: newPractica,
          ...(newSortOrder.trim() !== '' ? { sortOrder: Number(newSortOrder) } : {}),
        }),
      });
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(extractApiError(text) ?? 'No se pudo crear el tipo de SW.');
      }
      setNewTipoSw('');
      setNewPractica('');
      setNewSortOrder('');
      setSuccess('Tipo de SW añadido.');
      await loadCatalog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo crear el tipo de SW.');
    } finally {
      setCreating(false);
    }
  };

  const saveItem = async (item: CatalogItem) => {
    if (!item.tipoSw.trim() || !item.practica.trim()) {
      setError('Tipo SW y Práctica no pueden estar vacíos.');
      return;
    }

    setSavingId(item.id);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch(`/api/sw-forms/catalog/admin/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipoSw: item.tipoSw,
          practica: item.practica,
          sortOrder: Number(item.sortOrder),
        }),
      });
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(extractApiError(text) ?? 'No se pudo guardar el tipo de SW.');
      }
      const updated = (await res.json()) as CatalogItem;
      setItems((current) => current.map((entry) => (entry.id === updated.id ? updated : entry)));
      setOriginalById((current) => ({ ...current, [updated.id]: updated }));
      setSuccess('Tipo de SW actualizado.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar el tipo de SW.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageIntro}>
        <PageBreadcrumb>
          <PageBackLink href="/launcher/formularios-sw">← Formularios de SW</PageBackLink>
        </PageBreadcrumb>
        <PageHero
          animateEnter={false}
          title="Configuración de Formularios de SW"
          subtitle="Administra los Tipos SW y Prácticas disponibles en el formulario y en el Excel generado."
        />
      </div>

      {error ? <div className={styles.error}>{error}</div> : null}
      {success ? <div className={styles.success}>{success}</div> : null}

      <section className={styles.primaryCard}>
        <div className={styles.cardSection}>
          <div className={styles.sectionHead}>
            <span className={styles.stepBadge} aria-hidden>
              +
            </span>
            <div>
              <h2 className={styles.sectionTitle}>Añadir Tipo SW</h2>
              <p className={styles.sectionDesc}>
                El catálogo se inicializa desde la plantilla Excel y los cambios guardados se usan en el formulario.
              </p>
            </div>
          </div>

          <form className={styles.configFormGrid} onSubmit={createItem}>
            <label className={styles.field}>
              <span className={styles.label}>Tipo SW</span>
              <input className={styles.input} value={newTipoSw} onChange={(event) => setNewTipoSw(event.target.value)} required />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Práctica</span>
              <select className={styles.input} value={newPractica} onChange={(event) => setNewPractica(event.target.value)} required>
                <option value="" disabled>
                  Selecciona práctica
                </option>
                {practiceOptions.map((practice) => (
                  <option key={practice} value={practice}>
                    {practice}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.field}>
              <span className={styles.label}>Orden</span>
              <input
                className={styles.input}
                type="number"
                min="0"
                step="1"
                value={newSortOrder}
                onChange={(event) => setNewSortOrder(event.target.value)}
                placeholder="Auto"
              />
            </label>
            <button type="submit" className={styles.btnPrimary} disabled={creating}>
              {creating ? 'Añadiendo...' : 'Añadir'}
            </button>
          </form>
        </div>
      </section>

      <section className={styles.primaryCard}>
        <div className={styles.cardSection}>
          <div className={styles.sectionHeaderLine}>
            <div className={styles.sectionHead}>
              <span className={styles.stepBadge} aria-hidden>
                {items.length}
              </span>
              <div>
                <h2 className={styles.sectionTitle}>Catálogo cargado</h2>
                <p className={styles.sectionDesc}>Busca, filtra por práctica y guarda únicamente las filas modificadas.</p>
              </div>
            </div>
          </div>

          <div className={styles.configToolbar}>
            <label className={styles.configSearchField}>
              <span className={styles.label}>Buscar</span>
              <input
                className={styles.input}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tipo SW o práctica"
              />
            </label>
            <label className={styles.configFilterField}>
              <span className={styles.label}>Práctica</span>
              <select className={styles.input} value={practiceFilter} onChange={(event) => setPracticeFilter(event.target.value)}>
                <option value="">Todas</option>
                {practiceOptions.map((practice) => (
                  <option key={practice} value={practice}>
                    {practice}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.configToolbarMeta}>
              <span className={styles.configCountPill}>
                {filteredItems.length} de {items.length}
              </span>
              <button
                type="button"
                className={styles.btnSecondary}
                onClick={() => {
                  setQuery('');
                  setPracticeFilter('');
                }}
                disabled={!query && !practiceFilter}
              >
                Limpiar filtros
              </button>
            </div>
          </div>

          {loading ? (
            <div className={styles.configEmpty}>Cargando catálogo...</div>
          ) : filteredItems.length === 0 ? (
            <div className={styles.configEmpty}>No hay tipos de SW que coincidan con los filtros.</div>
          ) : (
            <div className={styles.configTable}>
              <div className={styles.configTableHead} aria-hidden>
                <span>Orden</span>
                <span>Tipo SW</span>
                <span>Práctica</span>
                <span />
              </div>
              {filteredItems.map((item) => {
                const dirty = isDirty(item);
                return (
                <div key={item.id} className={`${styles.configRow} ${dirty ? styles.configRowDirty : ''}`}>
                  <label className={styles.lineField}>
                    <span className={styles.mobileLabel}>Orden</span>
                    <input
                      className={styles.input}
                      type="number"
                      min="0"
                      step="1"
                      value={item.sortOrder}
                      onChange={(event) => updateDraft(item.id, { sortOrder: Number(event.target.value) })}
                    />
                  </label>
                  <label className={styles.lineField}>
                    <span className={styles.mobileLabel}>Tipo SW</span>
                    <input
                      className={styles.input}
                      value={item.tipoSw}
                      onChange={(event) => updateDraft(item.id, { tipoSw: event.target.value })}
                    />
                  </label>
                  <label className={styles.lineField}>
                    <span className={styles.mobileLabel}>Práctica</span>
                    <select
                      className={styles.input}
                      value={item.practica}
                      onChange={(event) => updateDraft(item.id, { practica: event.target.value })}
                    >
                      {practiceOptions.map((practice) => (
                        <option key={practice} value={practice}>
                          {practice}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    className={styles.btnSecondary}
                    onClick={() => saveItem(item)}
                    disabled={savingId === item.id || !dirty}
                  >
                    {savingId === item.id ? 'Guardando...' : 'Guardar'}
                  </button>
                </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function extractApiError(text: string): string | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as { message?: string | string[] };
    if (Array.isArray(parsed.message)) return parsed.message.join(' ');
    return parsed.message ?? text;
  } catch {
    return text;
  }
}
