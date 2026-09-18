import { useEffect, useMemo, useRef, useState } from 'react';
import { Folder, FileText } from 'lucide-react';
import type { Board, Project } from '@shared/types';
import { fuzzyScore } from '@/util/fuzzy';

export type PaletteEntry =
  | { kind: 'board'; id: string; board: Board; project: Project; label: string; sub: string; updatedAt: number }
  | { kind: 'project'; id: string; project: Project; label: string; sub: string; updatedAt: number };

/**
 * ⌘K: jump to any board or project. Loads the whole library each time it
 * opens (cheap: one row per board), scores entries with the fuzzy matcher,
 * and lists the best twelve; with no query, the most recently edited first.
 */
export default function CommandPalette({
  open,
  onClose,
  onOpenBoard,
  onOpenProject,
}: {
  open: boolean;
  onClose: () => void;
  onOpenBoard: (board: Board, project: Project) => void;
  onOpenProject: (project: Project) => void;
}) {
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<PaletteEntry[]>([]);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    let cancelled = false;
    (async () => {
      const [projects, boards] = await Promise.all([window.haldraw.projects.list(), window.haldraw.boards.listAll()]);
      if (cancelled) return;
      const byId = new Map(projects.map((p) => [p.id, p]));
      const out: PaletteEntry[] = [];
      for (const b of boards) {
        const p = byId.get(b.projectId);
        if (!p) continue;
        out.push({ kind: 'board', id: b.id, board: b, project: p, label: b.name, sub: p.name, updatedAt: b.updatedAt });
      }
      for (const p of projects) {
        const n = boards.filter((b) => b.projectId === p.id).length;
        out.push({ kind: 'project', id: p.id, project: p, label: p.name, sub: `Project · ${n} board${n === 1 ? '' : 's'}`, updatedAt: p.updatedAt });
      }
      setEntries(out);
    })();
    setTimeout(() => inputRef.current?.focus(), 10);
    return () => {
      cancelled = true;
    };
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [...entries].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 12);
    const scored: Array<{ e: PaletteEntry; score: number }> = [];
    for (const e of entries) {
      // Boards match on their own name and on "project › board".
      const own = fuzzyScore(q, e.label);
      const full = e.kind === 'board' ? fuzzyScore(q, `${e.project.name} › ${e.label}`) : null;
      const best = Math.max(own?.score ?? -Infinity, full ? full.score - 30 : -Infinity);
      if (best === -Infinity) continue;
      scored.push({ e, score: best + (e.kind === 'board' ? 10 : 0) });
    }
    scored.sort((a, b) => b.score - a.score || b.e.updatedAt - a.e.updatedAt);
    return scored.slice(0, 12).map((s) => s.e);
  }, [entries, query]);

  useEffect(() => setCursor(0), [query]);
  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  if (!open) return null;

  const choose = (e: PaletteEntry | undefined) => {
    if (!e) return;
    onClose();
    if (e.kind === 'board') onOpenBoard(e.board, e.project);
    else onOpenProject(e.project);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-[12vh] z-50" onClick={onClose} data-testid="command-palette">
      <div className="w-[560px] max-w-[92%] bg-panel border border-border rounded-xl shadow-panel overflow-hidden text-sm" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setCursor((c) => Math.min(results.length - 1, c + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setCursor((c) => Math.max(0, c - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              choose(results[cursor]);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            }
            e.stopPropagation();
          }}
          placeholder="Go to board or project…"
          className="w-full bg-transparent px-4 py-3 border-b border-border outline-none text-base"
        />
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto scrollbar-thin py-1">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-fg-muted">{entries.length ? 'No matches.' : 'Loading…'}</div>
          ) : (
            results.map((r, i) => (
              <div
                key={`${r.kind}-${r.id}`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => choose(r)}
                data-palette-row={r.kind}
                className={`flex items-center gap-3 px-4 py-2 cursor-pointer ${i === cursor ? 'bg-accent-soft text-fg' : 'hover:bg-panel-hover'}`}
              >
                {r.kind === 'board' ? <FileText size={14} className="text-fg-muted shrink-0" /> : <Folder size={14} className="text-fg-muted shrink-0" />}
                <span className="flex-1 truncate">
                  <Highlight text={r.label} query={query} />
                </span>
                <span className="text-xs text-fg-muted truncate max-w-[45%]">{r.sub}</span>
              </div>
            ))
          )}
        </div>
        <div className="px-4 py-1.5 border-t border-border text-[11px] text-fg-muted flex gap-3">
          <span>↑↓ move</span>
          <span>↩ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}

/** Matched characters in the accent colour. */
function Highlight({ text, query }: { text: string; query: string }) {
  const m = query.trim() ? fuzzyScore(query, text) : null;
  if (!m || !m.positions.length) return <>{text}</>;
  const set = new Set(m.positions);
  return (
    <>
      {[...text].map((ch, i) => (
        <span key={i} className={set.has(i) ? 'text-accent font-semibold' : undefined}>
          {ch}
        </span>
      ))}
    </>
  );
}
