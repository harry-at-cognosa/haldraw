import { useEffect, useState } from 'react';
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

  if (!board) {
    return <ProjectPicker onOpen={(project, board) => setBoard({ project, board })} />;
  }
  return (
    <BoardEditor
      project={board.project}
      board={board.board}
      onBack={() => setBoard(null)}
    />
  );
}
