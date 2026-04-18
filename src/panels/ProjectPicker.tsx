import { useEffect, useState } from 'react';
import type { Board, Project } from '@shared/types';
import { Plus, Folder, FileText, Trash2, Pencil, Copy, Link2 } from 'lucide-react';
import PromptModal from './PromptModal';
import { useDialogs } from '@/hooks/useDialogs';
import { APP_VERSION } from '@/util/version';

export default function ProjectPicker({
  onOpen,
}: {
  onOpen: (project: Project, board: Board) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Project | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const { request, ask, confirm, onResolve } = useDialogs();

  const refreshProjects = async () => {
    const p = await window.haldraw.projects.list();
    setProjects(p);
    if (!selected && p.length) setSelected(p[0]);
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
    if (!selected) return;
    const name = await ask({
      kind: 'prompt',
      title: 'New board',
      placeholder: 'Board name',
      initial: 'Untitled board',
      confirmLabel: 'Create',
    });
    if (!name) return;
    const b = await window.haldraw.boards.create(selected.id, name);
    setBoards([b, ...boards]);
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
          className="flex items-center justify-between px-4 h-12 border-b border-border"
          style={{ WebkitAppRegion: 'drag' } as any}
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
          <div className="text-sm font-medium">{selected?.name ?? 'Select a project'}</div>
          {selected ? (
            <button
              onClick={createBoard}
              className="px-3 h-8 rounded-md bg-accent text-white text-sm font-medium hover:opacity-90"
              style={{ WebkitAppRegion: 'no-drag' } as any}
            >
              <span className="inline-flex items-center gap-1.5">
                <Plus size={14} /> New board
              </span>
            </button>
          ) : null}
        </header>
        <section className="flex-1 overflow-y-auto scrollbar-thin p-8">
          {!selected ? (
            <div className="text-center text-fg-muted mt-24">
              Create a project on the left to begin.
            </div>
          ) : boards.length === 0 ? (
            <div className="text-center text-fg-muted mt-24">
              No boards yet. Click "New board" to create one.
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
      <PromptModal request={request} onResolve={onResolve} />
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
