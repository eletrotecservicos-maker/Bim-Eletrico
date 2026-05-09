/**
 * Dashboard principal — redireciona para o editor de projeto ou exibe a tela inicial.
 */
'use client';

import { useEffect } from 'react';
import { useProjectStore } from '@/store/projectStore';
import { useUiStore } from '@/store/uiStore';
import AppShell from '@/components/layout/AppShell';
import NewProjectModal from '@/components/modals/NewProjectModal';

export default function HomePage() {
  const { loadProjects } = useProjectStore();
  const { newProjectModalOpen } = useUiStore();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return (
    <>
      <AppShell />
      {newProjectModalOpen && <NewProjectModal />}
    </>
  );
}
