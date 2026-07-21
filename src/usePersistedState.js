import { useState, useEffect } from "react";

/* A useState that's also read from and written back to a Web Storage object
   (localStorage or sessionStorage) under `key` — the pattern every "remember
   what was pasted here" field in this app needs (the equipment table, the
   Protocol Visualizer's paste, the Lab Optimizer's protocol textareas), just
   with a different storage object/key/shape each time. Every storage error
   (private browsing, disabled storage, corrupt/unexpected stored data) is
   swallowed the same way: fall back to `defaultValue` on read, silently skip
   persisting on write, rather than crashing the app.

   `serialize`/`deserialize` default to identity, for the common case of a
   plain pasted string; pass `JSON.stringify`/a validating JSON.parse for a
   structured value (see LabOptimizerTab's array of protocol texts) — a
   `deserialize` that also validates the parsed shape (not just catches a
   parse error) should return its own fallback for a wrong-shaped value,
   the same way it would for a parse failure. */
export function usePersistedState(storage, key, defaultValue, { serialize = (v) => v, deserialize = (v) => v } = {}) {
  const [value, setValue] = useState(() => {
    try {
      const raw = storage.getItem(key);
      return raw == null ? defaultValue : deserialize(raw);
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try { storage.setItem(key, serialize(value)); } catch { /* storage unavailable — nothing to persist to */ }
  }, [value]);

  return [value, setValue];
}
