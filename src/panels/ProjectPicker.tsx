import { useEffect, useRef, useState } from 'react';
import type { Board, PickedImageFile, Project } from '@shared/types';
import { Plus, Folder, FileText, Trash2, Pencil, Copy, Link2, ImagePlus, Keyboard, FileUp } from 'lucide-react';
import ShortcutHelp from './ShortcutHelp';
import { fileToPicked } from '@/util/importImage';
import {
  HALDRAW_FILE_FILTERS,
  importBoardFile,
  parseBoardFile,
  suggestedBoardName,
} from '@/util/haldrawFile';
import PromptModal from './PromptModal';
import { useDialogs } from '@/hooks/useDialogs';
import { APP_VERSION } from '@/util/version';

export default function ProjectPicker({
  onOpen,
  initialProjectId = null,
}: {
  onOpen: (project: Project, board: Board, pendingImport?: PickedImageFile | null) => void;
  /** Project to show selected on mount (⌘K → project); else the most recent. */
  initialProjectId?: string | null;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const { request, ask, confirm, onResolve } = useDialogs();
  const [dragOver, setDragOver] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(t);
  }, [error]);
  const selectedRef = useRef<Project | null>(null);
  selectedRef.current = selected;

  const refreshProjects = async () => {
    const p = await window.haldraw.projects.list();
    setProjects(p);
    if (!selected && p.length) setSelected(p.find((x) => x.id === initialProjectId) ?? p[0]);
  };

  useEffect(() => {
    refreshProjects();
  }, []);

  useEffect(() => {
    if (selected) window.haldraw.boards.listByProject(selected.id).then(setBoards);
    else setBoards([]);
  }, [selected?.id]);

  const createProject = async () => {
    const name = await ask({
      kind: 'prompt',
      title: 'New project',
      placeholder: 'Project name',
      initial: 'Untitled project',
      confirmLabel: 'Create',
    });
    if (!name) return;
    const p = await window.haldraw.projects.create(name);
    await refreshProjects();
    setSelected(p);
  };

  const renameProject = async (p: Project) => {
    const name = await ask({
      kind: 'prompt',
      title: 'Rename project',
      initial: p.name,
      confirmLabel: 'Rename',
    });
    if (!name) return;
    await window.haldraw.projects.rename(p.id, name);
    refreshProjects();
  };

  const deleteProject = async (p: Project) => {
    const ok = await confirm({
      kind: 'confirm',
      title: 'Delete project?',
      message: `"${p.name}" and all its boards will be permanently deleted.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await window.haldraw.projects.remove(p.id);
    if (selected?.id === p.id) setSelected(null);
    refreshProjects();
  };

  const createBoard = async () => {
    const name = await ask({
      kind: 'prompt',
      title: 'New board',
      placeholder: 'Board name',
      initial: 'Untitled board',
      confirmLabel: 'Create',
    });
    if (!name) return;
    const project = await ensureProject();
    const b = await window.haldraw.boards.create(project.id, name);
    setBoards([b, ...boards]);
  };

  /** The selected project, or a freshly created "Untitled project" when there is none. */
  const ensureProject = async (): Promise<Project> => {
    if (selectedRef.current) return selectedRef.current;
    const p = await window.haldraw.projects.create('Untitled project');
    selectedRef.current = p;
    setSelected(p);
    await refreshProjects();
    return p;
  };

  /** Create a board named after the image and open it with the image pending placement. */
  const createBoardFromPicked = async (picked: PickedImageFile) => {
    const project = await ensureProject();
    const base = picked.name.replace(/\.[^.]+$/, '') || 'Untitled board';
    const name = await ask({
      kind: 'prompt',
      title: 'New board from image',
      placeholder: 'Board name',
      initial: base,
      confirmLabel: 'Create',
    });
    if (!name) return;
    const b = await window.haldraw.boards.create(project.id, name);
    onOpen(project, b, picked);
  };

  const createBoardFromImage = async () => {
    const picked = await window.haldraw.images.pickFile();
    if (!picked) return;
    await createBoardFromPicked(picked);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setHelpOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setHelpOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /** Import a .haldraw file's text as a new board in the selected (or auto-created) project. */
  const importBoardText = async (text: string, fileName: string) => {
    try {
      const file = parseBoardFile(text);
      const project = await ensureProject();
      const name = await ask({
        kind: 'prompt',
        title: 'Import board',
        placeholder: 'Board name',
        initial: suggestedBoardName(file, fileName),
        confirmLabel: 'Import',
      });
      if (!name) return;
      const b = await importBoardFile(project.id, file, name);
      const list = await window.haldraw.boards.listByProject(project.id);
      setBoards(list);
      onOpen(project, b);
    } catch (err) {
      setError(`Import failed: ${(err as Error).message}`);
    }
  };

  const importBoardFromFile = async () => {
    const opened = await window.haldraw.files.openText({ filters: HALDRAW_FILE_FILTERS });
    if (!opened) return;
    await importBoardText(opened.text, opened.name);
  };

  useEffect(() => {
    return window.haldraw.onMenu('menu:importBoard', () => {
      importBoardFromFile();
    });
  }, []);

  // File ▸ Import Image… while the picker is showing
  useEffect(() => {
    return window.haldraw.onMenu('menu:importImage', () => {
      createBoardFromImage();
    });
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    if (Array.from(e.dataTransfer.items).some((i) => i.kind === 'file')) {
      e.preventDefault();
      setDragOver(true);
    }
  };
  const onDrop = async (e: React.DragEvent) => {
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    const boardFile = files.find((f) => /\.(haldraw|json)$/i.test(f.name));
    if (boardFile) {
      e.preventDefault();
      await importBoardText(await boardFile.text(), boardFile.name);
      return;
    }
    const file = files.find((f) => f.type.startsWith('image/'));
    if (!file) return;
    e.preventDefault();
    await createBoardFromPicked(await fileToPicked(file));
  };

  const renameBoard = async (b: Board) => {
    const name = await ask({
      kind: 'prompt',
      title: 'Rename board',
      initial: b.name,
      confirmLabel: 'Rename',
    });
    if (!name) return;
    await window.haldraw.boards.rename(b.id, name);
    if (selected) window.haldraw.boards.listByProject(selected.id).then(setBoards);
  };

  const duplicateBoard = async (b: Board) => {
    const stamp = timestampSuffix();
    const newName = `${b.name} (copy ${stamp})`;
    const copy = await window.haldraw.boards.duplicate(b.id, newName);
    if (copy && selected) {
      const list = await window.haldraw.boards.listByProject(selected.id);
      setBoards(list);
    }
  };

  const deleteBoard = async (b: Board) => {
    const ok = await confirm({
      kind: 'confirm',
      title: 'Delete board?',
      message: `"${b.name}" will be permanently deleted.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await window.haldraw.boards.remove(b.id);
    setBoards(boards.filter((x) => x.id !== b.id));
  };

  return (
    <div className="flex h-full w-full bg-canvas text-fg">
      <aside className="w-72 shrink-0 border-r border-border bg-panel flex flex-col">
        <div
          className="flex items-center justify-between h-12 border-b border-border"
          style={{ WebkitAppRegion: 'drag', paddingLeft: 78, paddingRight: 12 } as any}
        >
          <div className="text-sm font-semibold tracking-tight">
            haldraw{' '}
            <span className="text-xs text-fg-muted font-normal tabular-nums">v{APP_VERSION}</span>
          </div>
          <button
            onClick={createProject}
            className="p-1.5 rounded-md hover:bg-panel-hover text-fg-muted hover:text-fg"
            title="New project"
            style={{ WebkitAppRegion: 'no-drag' } as any}
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2">
          {projects.length === 0 ? (
            <div className="p-4 text-sm text-fg-muted">
              No projects yet. Create one to get started.
            </div>
          ) : (
            projects.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelected(p)}
                className={`group flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer ${
                  selected?.id === p.id ? 'bg-accent-soft text-fg' : 'hover:bg-panel-hover'
                }`}
              >
                <Folder size={14} className="text-fg-muted" />
                <span className="flex-1 truncate text-sm">{p.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    renameProject(p);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-panel-hover text-fg-muted"
                  title="Rename"
                >
                  <Pencil size={12} />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteProject(p);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-panel-hover text-fg-muted"
                  title="Delete"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
      <main className="flex-1 flex flex-col">
        <header
          className="h-12 border-b border-border bg-panel px-6 flex items-center justify-between"
          style={{ WebkitAppRegion: 'drag' } as any}
        >
          <div className="text-sm font-medium">{selected?.name ?? 'No project selected'}</div>
          <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
              <button
                onClick={() => setHelpOpen(true)}
                className="p-1.5 rounded-md hover:bg-panel-hover text-fg-muted hover:text-fg"
                title="Help (?)"
              >
                <Keyboard size={16} />
              </button>
              <button
                onClick={importBoardFromFile}
                className="px-3 h-8 rounded-md border border-border text-fg-muted hover:text-fg hover:border-fg-muted text-sm font-medium"
                title="Import a .haldraw board file (⌘⇧O)"
              >
                <span className="inline-flex items-center gap-1.5">
                  <FileUp size={14} /> Import…
                </span>
              </button>
              <button
                onClick={createBoardFromImage}
                className="px-3 h-8 rounded-md border border-border text-fg-muted hover:text-fg hover:border-fg-muted text-sm font-medium"
                title="Create a board with an image placed as a locked reference layer (⌘⇧I)"
              >
                <span className="inline-flex items-center gap-1.5">
                  <ImagePlus size={14} /> From image…
                </span>
              </button>
              <button
                onClick={createBoard}
                className="px-3 h-8 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90"
              >
                <span className="inline-flex items-center gap-1.5">
                  <Plus size={14} /> New board
                </span>
              </button>
          </div>
        </header>
        <section
          className={`flex-1 overflow-y-auto scrollbar-thin p-8 transition ${
            dragOver ? 'ring-2 ring-inset ring-accent bg-accent-soft/30' : ''
          }`}
          onDragOver={onDragOver}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {!selected ? (
            <div className="text-center text-fg-muted mt-24 space-y-2">
              <div>No project selected.</div>
              <div className="text-xs">
                Click <b>New board</b>, <b>From image…</b> or <b>Import…</b> above, or drop an
                image or a <code>.haldraw</code> file here — a project is created for you. Press <kbd className="px-1 rounded border border-border">?</kbd> for help.
              </div>
            </div>
          ) : boards.length === 0 ? (
            <div className="text-center text-fg-muted mt-24">
              No boards yet. Click "New board", or drop an image here to trace over it.
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
              {boards.map((b) => (
                <div
                  key={b.id}
                  onClick={() => onOpen(selected, b)}
                  className="group cursor-pointer rounded-xl border border-border bg-panel hover:border-accent hover:shadow-panel transition overflow-hidden"
                >
                  <div className="h-32 dot-grid bg-canvas flex items-center justify-center">
                    <FileText size={32} className="text-fg-muted/60" />
                  </div>
                  <div className="p-3 flex items-center gap-2">
                    <span className="flex-1 truncate text-sm font-medium">{b.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        renameBoard(b);
                      }}
                      title="Rename"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-panel-hover text-fg-muted"
                    >
                      <Pencil size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateBoard(b);
                      }}
                      title="Duplicate (timestamped copy)"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-panel-hover text-fg-muted"
                    >
                      <Copy size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.haldraw.writeClipboard(`haldraw://board/${b.id}`);
                      }}
                      title="Copy in-app link (paste into a shape's Link field)"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-panel-hover text-fg-muted"
                    >
                      <Link2 size={12} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteBoard(b);
                      }}
                      title="Delete"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-panel-hover text-fg-muted"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
      {error ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg shadow-panel text-sm border bg-red-500/90 border-red-400 text-white">
          {error}
        </div>
      ) : null}
      <PromptModal request={request} onResolve={onResolve} />
      <ShortcutHelp open={helpOpen} onClose={() => setHelpOpen(false)} variant="picker" />
    </div>
  );
}

function timestampSuffix(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd} ${hh}${mi}`;
}
