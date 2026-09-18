import { useCallback, useEffect, useState } from 'react';
import type { Board, PickedImageFile, Project } from '@shared/types';
import ProjectPicker from './panels/ProjectPicker';
import BoardEditor from './canvas/BoardEditor';
import CommandPalette from './panels/CommandPalette';
import { useCanvas } from './store/canvasStore';

export default function App() {
  const [board, setBoard] = useState<{
    project: Project;
    board: Board;
    pendingImport?: PickedImageFile | null;
  } | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  /** Project the library should show selected when it next mounts (⌘K → project). */
  const [pickerProject, setPickerProject] = useState<string | null>(null);

  // ⌘K anywhere: the application menu sends it too, so a focused text field
  // cannot swallow it; the window listener covers the picker's dev preview.
  useEffect(() => window.haldraw.onMenu('menu:palette', () => setPaletteOpen(true)), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    window.haldraw.theme.get().then((theme) => {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.classList.toggle('light', theme === 'light');
    });
    window.haldraw.settings.get().then((s) => useCanvas.getState().setPalette(s.palette));
  }, []);

  const openBoardById = useCallback(async (boardId: string): Promise<boolean> => {
    const snapshot = await window.haldraw.boards.load(boardId);
    if (!snapshot) return false;
    const projects = await window.haldraw.projects.list();
    const project = projects.find((p) => p.id === snapshot.board.projectId);
    if (!project) return false;
    setBoard({ project, board: snapshot.board });
    return true;
  }, []);

  const palette = (
    <CommandPalette
      open={paletteOpen}
      onClose={() => setPaletteOpen(false)}
      onOpenBoard={(b, project) => {
        if (board?.board.id === b.id) return;
        setBoard({ project, board: b });
      }}
      onOpenProject={(project) => {
        setPickerProject(project.id);
        setBoard(null);
      }}
    />
  );
  if (!board) {
    return (
      <>
        <ProjectPicker
          key={pickerProject ?? 'library'}
          initialProjectId={pickerProject}
          onOpen={(project, board, pendingImport) => setBoard({ project, board, pendingImport })}
        />
        {palette}
      </>
    );
  }
  return (
    <>
      <BoardEditor
        key={board.board.id}
        project={board.project}
        board={board.board}
        onBack={() => setBoard(null)}
        openBoardById={openBoardById}
        pendingImport={board.pendingImport}
      />
      {palette}
    </>
  );
}
