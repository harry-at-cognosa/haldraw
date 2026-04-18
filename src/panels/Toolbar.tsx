import {
  MousePointer2,
  Square,
  Circle,
  Diamond,
  Minus,
  MoveRight,
  Type,
  Link2,
  Sparkles,
  Undo2,
  Redo2,
  Grid3x3,
  Magnet,
  Sun,
  Moon,
  Keyboard,
} from 'lucide-react';
import { useCanvas, type Tool } from '@/store/canvasStore';
import ExportMenu, { type ExportFormat } from './ExportMenu';
import { APP_VERSION } from '@/util/version';

type ToolDef = { id: Tool; icon: React.ComponentType<any>; label: string; shortcut: string };

const TOOLS: ToolDef[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { id: 'rect', icon: Square, label: 'Rectangle', shortcut: 'R' },
  { id: 'square', icon: Square, label: 'Square (locked ratio)', shortcut: 'S' },
  { id: 'ellipse', icon: Circle, label: 'Ellipse / Circle', shortcut: 'O' },
  { id: 'diamond', icon: Diamond, label: 'Diamond (decision)', shortcut: 'D' },
  { id: 'line', icon: Minus, label: 'Line', shortcut: 'L' },
  { id: 'arrow', icon: MoveRight, label: 'Arrow', shortcut: 'A' },
  { id: 'text', icon: Type, label: 'Text', shortcut: 'T' },
  { id: 'connector', icon: Link2, label: 'Connector (snaps to shapes)', shortcut: 'C' },
  { id: 'icon', icon: Sparkles, label: 'Icon library', shortcut: 'I' },
];

export default function Toolbar({
  onExport,
  onOpenIcons,
  onBack,
  onShortcuts,
  theme,
  onToggleTheme,
  title,
}: {
  onExport: (format: ExportFormat) => void;
  onOpenIcons: () => void;
  onBack: () => void;
  onShortcuts: () => void;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  title: string;
}) {
  const tool = useCanvas((s) => s.tool);
  const setTool = useCanvas((s) => s.setTool);
  const undo = useCanvas((s) => s.undo);
  const redo = useCanvas((s) => s.redo);
  const toggleGrid = useCanvas((s) => s.toggleGrid);
  const toggleSnap = useCanvas((s) => s.toggleSnap);
  const showGrid = useCanvas((s) => s.showGrid);
  const snapToGrid = useCanvas((s) => s.snapToGrid);
  const hasUndo = useCanvas((s) => s.history.length > 0);
  const hasRedo = useCanvas((s) => s.future.length > 0);
  const viewport = useCanvas((s) => s.viewport);
  const setViewport = useCanvas((s) => s.setViewport);

  return (
    <div
      className="h-12 shrink-0 border-b border-border bg-panel flex items-center px-2 gap-1 text-sm"
      style={{ WebkitAppRegion: 'drag' } as any}
    >
      <button
        onClick={onBack}
        className="px-3 h-8 rounded-md hover:bg-panel-hover text-fg-muted hover:text-fg font-medium"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        ← Library
      </button>
      <div className="w-px h-5 bg-border mx-1" />
      <div
        className="flex items-center gap-0.5 bg-canvas/40 rounded-md px-1"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {TOOLS.map((t) => {
          if (t.id === 'icon') {
            return (
              <ToolButton
                key={t.id}
                icon={t.icon}
                label={t.label}
                shortcut={t.shortcut}
                active={false}
                onClick={onOpenIcons}
              />
            );
          }
          return (
            <ToolButton
              key={t.id}
              icon={t.icon}
              label={t.label}
              shortcut={t.shortcut}
              active={tool === t.id}
              onClick={() => setTool(t.id)}
            />
          );
        })}
      </div>

      <div className="flex-1 text-center truncate px-4 text-fg font-semibold">
        {title}
        <span className="ml-2 text-xs text-fg-muted font-normal tabular-nums">v{APP_VERSION}</span>
      </div>

      <div className="flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <IconButton icon={Undo2} onClick={undo} disabled={!hasUndo} label="Undo (⌘Z)" />
        <IconButton icon={Redo2} onClick={redo} disabled={!hasRedo} label="Redo (⌘⇧Z)" />
        <div className="w-px h-5 bg-border mx-1" />
        <IconButton icon={Grid3x3} onClick={toggleGrid} active={showGrid} label="Toggle grid" />
        <IconButton icon={Magnet} onClick={toggleSnap} active={snapToGrid} label="Snap to grid" />
        <div className="w-px h-5 bg-border mx-1" />
        <button
          onClick={() => setViewport({ ...viewport, zoom: 1 })}
          className="px-2 h-8 rounded-md hover:bg-panel-hover text-fg-muted text-xs tabular-nums"
          title="Reset zoom (⌘0)"
        >
          {Math.round(viewport.zoom * 100)}%
        </button>
        <IconButton icon={theme === 'dark' ? Sun : Moon} onClick={onToggleTheme} label="Toggle theme" />
        <IconButton icon={Keyboard} onClick={onShortcuts} label="Shortcuts (?)" />
        <div className="w-px h-5 bg-border mx-1" />
        <ExportMenu onExport={onExport} />
      </div>
    </div>
  );
}

function ToolButton({
  icon: Icon,
  label,
  shortcut,
  active,
  onClick,
}: {
  icon: React.ComponentType<any>;
  label: string;
  shortcut: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={`${label} (${shortcut})`}
      className={`p-1.5 rounded-md transition relative ${
        active ? 'bg-accent text-white' : 'text-fg-muted hover:bg-panel-hover hover:text-fg'
      }`}
    >
      <Icon size={16} />
    </button>
  );
}

function IconButton({
  icon: Icon,
  label,
  onClick,
  active,
  disabled,
}: {
  icon: React.ComponentType<any>;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`p-1.5 rounded-md transition ${
        active
          ? 'bg-accent-soft text-accent'
          : 'text-fg-muted hover:bg-panel-hover hover:text-fg disabled:opacity-30 disabled:hover:bg-transparent'
      }`}
    >
      <Icon size={16} />
    </button>
  );
}
