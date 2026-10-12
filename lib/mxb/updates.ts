/** One install revision, plus the notes that shipped with each id. */

export type UpdateEntry = {
  id: string;
  lines: string[];
};

export type UpdateLog = {
  id: string;
  date: string;
  entries: UpdateEntry[];
};

/** Parse UPDATES.txt. The header `id:` is what the website compares. */
export function parseUpdates(text: string): UpdateLog {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  let id = "";
  let date = "";
  const entries: UpdateEntry[] = [];
  let current: UpdateEntry | null = null;
  let header = true;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (header) {
      const idMatch = line.match(/^\s*id:\s*(\S+)\s*$/);
      const dateMatch = line.match(/^\s*date:\s*(\S+)\s*$/);
      if (idMatch && !id) {
        id = idMatch[1];
        continue;
      }
      if (dateMatch && !date) {
        date = dateMatch[1];
        continue;
      }
      if (!line.trim()) continue;
    }
    if (line.startsWith("## ")) {
      header = false;
      if (current) entries.push(current);
      current = { id: line.slice(3).trim(), lines: [] };
      continue;
    }
    if (current && line.trim() && !line.trim().startsWith("#")) {
      header = false;
      current.lines.push(line.trim());
    }
  }
  if (current) entries.push(current);
  if (!id && entries[0]) id = entries[0].id.split(/\s+/)[0];
  return { id, date, entries };
}
