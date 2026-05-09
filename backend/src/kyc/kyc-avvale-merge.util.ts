/**
 * Fusión defensiva del JSON `avvale`: evita que parciales con `projects: []`
 * borren proyectos ya guardados (chat, PATCH genérico), salvo que se indique
 * vaciado explícito (`allowEmptyProjectsWipe`).
 */

export type MergeAvvaleRootPatchOpts = {
  allowEmptyProjectsWipe?: boolean;
};

/** Lista de proyectos desde la raíz de `avvale`. */
export function extractProjectsListFromAvvaleRoot(av: Record<string, unknown>): unknown[] {
  for (const k of ['projects', 'proyectos', 'project_list', 'Projects'] as const) {
    if (!(k in av)) continue;
    const v = av[k];
    if (Array.isArray(v)) return v;
    if (typeof v === 'string' && v.trim()) {
      try {
        const p = JSON.parse(v) as unknown;
        if (Array.isArray(p)) return p;
      } catch {
        /* empty */
      }
    }
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const vals = Object.values(v as Record<string, unknown>);
      if (
        vals.length > 0 &&
        vals.every((x) => x != null && typeof x === 'object' && !Array.isArray(x))
      ) {
        return vals;
      }
    }
  }
  return [];
}

function avvaleProjectRowIdentity(row: unknown): string {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return '';
  const r = row as Record<string, unknown>;
  const id = r.id != null ? String(r.id).trim() : '';
  if (id) return `id:${id}`;
  const name = String(r.name ?? r.nombre ?? '').trim().toLowerCase();
  if (name) return `name:${name.slice(0, 400)}`;
  return '';
}

/** Une filas: mismo id/nombre → actualiza; filas nuevas sin id estable se añaden. */
export function mergeAvvaleProjectRows(baseRows: unknown[], patchRows: unknown[]): unknown[] {
  const out: unknown[] = [];
  const indexByKey = new Map<string, number>();
  const pushBase = (row: unknown) => {
    const idKey = avvaleProjectRowIdentity(row);
    const key = idKey || `anon:base:${out.length}`;
    indexByKey.set(key, out.length);
    out.push(row);
  };
  for (const row of baseRows) pushBase(row);
  let patchAnon = 0;
  for (const row of patchRows) {
    const idKey = avvaleProjectRowIdentity(row);
    const key = idKey || `anon:patch:${patchAnon++}`;
    const idx = indexByKey.get(key);
    if (idx !== undefined) {
      const prev = out[idx];
      if (
        prev &&
        typeof prev === 'object' &&
        !Array.isArray(prev) &&
        row &&
        typeof row === 'object' &&
        !Array.isArray(row)
      ) {
        out[idx] = { ...(prev as Record<string, unknown>), ...(row as Record<string, unknown>) };
      } else {
        out[idx] = row;
      }
    } else {
      indexByKey.set(key, out.length);
      out.push(row);
    }
  }
  return out;
}

/**
 * Fusiona un parcial sobre `avvale` en raíz.
 * Por defecto, `projects`/`proyectos` explícitos como [] no borran lista existente.
 */
export function mergeAvvaleRootPatch(
  base: Record<string, unknown>,
  patch: Record<string, unknown>,
  opts?: MergeAvvaleRootPatchOpts,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...base, ...patch };
  const baseList = extractProjectsListFromAvvaleRoot(base);
  const allowEmpty = opts?.allowEmptyProjectsWipe === true;

  let patchExplicit = false;
  let patchList: unknown[] | undefined;
  if (Object.prototype.hasOwnProperty.call(patch, 'projects')) {
    patchExplicit = true;
    patchList = Array.isArray(patch.projects) ? patch.projects : [];
  } else if (Object.prototype.hasOwnProperty.call(patch, 'proyectos')) {
    patchExplicit = true;
    patchList = Array.isArray(patch.proyectos) ? patch.proyectos : [];
  }

  if (patchExplicit) {
    const pa = patchList ?? [];
    let nextList: unknown[];
    if (pa.length === 0) {
      nextList = baseList.length > 0 && !allowEmpty ? baseList : [];
    } else {
      nextList = mergeAvvaleProjectRows(baseList, pa);
    }
    merged.projects = nextList;
    delete merged.proyectos;
  }

  return merged;
}

/** Para rutas `avvale.projects` / `avvale.proyectos` en apply parcial. */
export function mergeAvvaleProjectsLeafValue(
  baseRoot: Record<string, unknown>,
  incomingArray: unknown[],
  opts?: MergeAvvaleRootPatchOpts,
): unknown[] {
  const baseList = extractProjectsListFromAvvaleRoot(baseRoot);
  const allowEmpty = opts?.allowEmptyProjectsWipe === true;
  if (incomingArray.length === 0) {
    return baseList.length > 0 && !allowEmpty ? baseList : [];
  }
  return mergeAvvaleProjectRows(baseList, incomingArray);
}
