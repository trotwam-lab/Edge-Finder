// Minimal in-memory stand-in for the Firestore Admin API surface the ledger
// uses (docs, subcollections, transactions, batches, simple queries).
// Test-only — not imported by any route.

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function setPath(target, path, value) {
  const parts = path.split('.');
  let node = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    if (!node[parts[i]] || typeof node[parts[i]] !== 'object') node[parts[i]] = {};
    node = node[parts[i]];
  }
  node[parts[parts.length - 1]] = value;
}

function deepMerge(target, source) {
  Object.entries(source).forEach(([k, v]) => {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object') deepMerge(target[k], v);
    else target[k] = clone(v);
  });
  return target;
}

export function createFakeFirestore() {
  const store = new Map(); // path -> data

  function snapshot(path) {
    const data = store.get(path);
    return { exists: data !== undefined, id: path.split('/').pop(), ref: docRef(path), data: () => clone(data) };
  }

  function docRef(path) {
    return {
      path,
      id: path.split('/').pop(),
      collection: (name) => collectionRef(`${path}/${name}`),
      get: async () => snapshot(path),
      set: async (data, opts) => write.set(path, data, opts),
      update: async (data) => write.update(path, data),
      delete: async () => write.delete(path),
    };
  }

  const write = {
    set(path, data, opts) {
      if (opts?.merge && store.has(path)) store.set(path, deepMerge(clone(store.get(path)), data));
      else store.set(path, clone(data));
    },
    update(path, data) {
      if (!store.has(path)) throw new Error(`No document to update: ${path}`);
      const next = clone(store.get(path));
      Object.entries(data).forEach(([k, v]) => setPath(next, k, clone(v)));
      store.set(path, next);
    },
    delete(path) { store.delete(path); },
  };

  function directChildren(path) {
    const prefix = `${path}/`;
    return [...store.keys()].filter(k => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'));
  }

  function query(path, filters = [], order = null, max = Infinity) {
    return {
      where: (field, op, value) => query(path, [...filters, { field, op, value }], order, max),
      orderBy: (field) => query(path, filters, field, max),
      limit: (n) => query(path, filters, order, n),
      get: async () => {
        let docs = directChildren(path).map(snapshot);
        filters.forEach(({ field, op, value }) => {
          docs = docs.filter(d => {
            const v = d.data()[field];
            if (op === '<=') return v <= value;
            if (op === '==') return v === value;
            if (op === '>=') return v >= value;
            throw new Error(`Unsupported op ${op}`);
          });
        });
        if (order) docs.sort((a, b) => (a.data()[order] > b.data()[order] ? 1 : -1));
        return { docs: docs.slice(0, max), size: Math.min(docs.length, max) };
      },
    };
  }

  function collectionRef(path) {
    return { ...query(path), doc: (id) => docRef(`${path}/${id}`) };
  }

  return {
    store,
    collection: (name) => collectionRef(name),
    batch() {
      const ops = [];
      return {
        set: (ref, data, opts) => ops.push(() => write.set(ref.path, data, opts)),
        update: (ref, data) => ops.push(() => write.update(ref.path, data)),
        delete: (ref) => ops.push(() => write.delete(ref.path)),
        commit: async () => { ops.forEach(op => op()); },
      };
    },
    // Serial transactions: buffer writes, apply only if the callback succeeds.
    async runTransaction(fn) {
      const ops = [];
      const tx = {
        get: async (ref) => snapshot(ref.path),
        set: (ref, data, opts) => ops.push(() => write.set(ref.path, data, opts)),
        update: (ref, data) => ops.push(() => write.update(ref.path, data)),
        delete: (ref) => ops.push(() => write.delete(ref.path)),
      };
      const result = await fn(tx);
      ops.forEach(op => op());
      return result;
    },
  };
}
