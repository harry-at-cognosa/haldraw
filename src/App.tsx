import { useCallback, useEffect, useState } from 'react';
import type { Board, Project } from '@shared/types';
import ProjectPicker from './panels/ProjectPicker';
import BoardEditor from './canvas/BoardEditor';

export default function App() {
  const [board, setBoard] = useState<{ project: Project; board: Board } | null>(null);

  useEffect(() => {
    window.haldraw.theme.get().then((theme) => {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.classList.toggle('light', theme === 'light');
    });
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

  if (!board) {
    return <ProjectPicker onOpen={(project, board) => setBoard({ project, board })} />;
  }
  return (
    <BoardEditor
      key={board.board.id}
      project={board.project}
      board={board.board}
      onBack={() => setBoard(null)}
      openBoardById={openBoardById}
    />
  );
}
