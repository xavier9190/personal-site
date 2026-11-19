import { describe, expect, it } from 'vitest';
import { createPgliteTestDb } from '@/db/pglite-test';
import { AcademicService } from './service';

describe('AcademicService seam (Projects, Links, Milestones, Completion)', () => {
  it('creates an academic project with members and custom links, and lists it under inProgress', async () => {
    const { db, close } = await createPgliteTestDb();
    const service = new AcademicService(db);

    try {
      const project = await service.createProject({
        title: 'TCC - Inteligência Artificial na Saúde',
        description: 'Desenvolvimento de modelo preditivo hospitalar.',
        finalDeliveryDate: '2026-12-15',
        groupMembers: ['Xavier', 'Leticia', 'Caio'],
        links: [
          { label: 'GitHub', url: 'https://github.com/xavier/tcc' },
          { label: 'Drive', url: 'https://drive.google.com/folder/tcc' },
        ],
      });

      expect(project.id).toBeDefined();
      expect(project.title).toBe('TCC - INTELIGÊNCIA ARTIFICIAL NA SAÚDE');
      expect(project.status).toBe('IN_PROGRESS');

      const details = await service.getProjectDetails(project.id);
      expect(details).not.toBeNull();
      expect(details!.groupMembersList).toEqual(['XAVIER', 'LETICIA', 'CAIO']);
      expect(details!.links).toHaveLength(2);
      expect(details!.links[0].label).toBe('GITHUB');

      const overview = await service.listProjectsByStatus();
      expect(overview.inProgress).toHaveLength(1);
      expect(overview.completed).toHaveLength(0);
      expect(overview.inProgress[0].id).toBe(project.id);
    } finally {
      await close();
    }
  });

  it('updates project information, links, and deletes project with cascade', async () => {
    const { db, close } = await createPgliteTestDb();
    const service = new AcademicService(db);

    try {
      const project = await service.createProject({
        title: 'Sistemas Distribuídos',
        description: 'Trabalho de raft consensus',
        finalDeliveryDate: '2026-11-20',
        groupMembers: ['Xavier'],
        links: [{ label: 'GitHub', url: 'https://github.com/example/repo' }],
      });

      const updated = await service.updateProject(project.id, {
        title: 'Sistemas Distribuídos - Prática',
        description: 'Implementação de consensus Raft em Go',
        groupMembers: ['Xavier', 'Ruan'],
        links: [
          { label: 'Figma', url: 'https://figma.com/design/123' },
          { label: 'Notion', url: 'https://notion.so/workspace/doc' },
        ],
      });

      expect(updated.title).toBe('SISTEMAS DISTRIBUÍDOS - PRÁTICA');
      const details = await service.getProjectDetails(project.id);
      expect(details!.groupMembersList).toEqual(['XAVIER', 'RUAN']);
      expect(details!.links.map((l) => l.label)).toEqual(['FIGMA', 'NOTION']);

      await service.deleteProject(project.id);
      expect(await service.getProjectDetails(project.id)).toBeNull();
      expect((await service.listProjectsByStatus()).inProgress).toHaveLength(0);
    } finally {
      await close();
    }
  });

  it('manages milestones timeline, toggles [OK] completion, and moves project to completed when all milestones are done', async () => {
    const { db, close } = await createPgliteTestDb();
    const service = new AcademicService(db);

    try {
      const project = await service.createProject({
        title: 'Compiladores',
        description: 'Analisador léxico e sintático',
        finalDeliveryDate: '2026-11-30',
        groupMembers: ['Xavier'],
      });

      const m1 = await service.addMilestone(project.id, {
        title: 'Entrega da Gramática',
        dueDate: '2026-11-10',
        sortOrder: 1,
      });

      const m2 = await service.addMilestone(project.id, {
        title: 'Analisador Sintático LL(1)',
        dueDate: '2026-11-20',
        sortOrder: 2,
      });

      let details = (await service.getProjectDetails(project.id))!;
      expect(details.milestones).toHaveLength(2);
      expect(details.milestones[0].id).toBe(m1.id);
      expect(details.milestones[0].isCompleted).toBe(false);
      expect(details.totalMilestones).toBe(2);
      expect(details.completedMilestones).toBe(0);

      // Toggle first milestone -> completes m1
      const toggled1 = await service.toggleMilestone(m1.id);
      expect(toggled1.isCompleted).toBe(true);

      details = (await service.getProjectDetails(project.id))!;
      expect(details.completedMilestones).toBe(1);
      expect(details.status).toBe('IN_PROGRESS');

      // Toggle second milestone -> all milestones completed -> project automatically marks as COMPLETED
      const toggled2 = await service.toggleMilestone(m2.id);
      expect(toggled2.isCompleted).toBe(true);

      details = (await service.getProjectDetails(project.id))!;
      expect(details.completedMilestones).toBe(2);
      expect(details.status).toBe('COMPLETED');

      let overview = await service.listProjectsByStatus();
      expect(overview.inProgress).toHaveLength(0);
      expect(overview.completed).toHaveLength(1);

      // Reopening or toggling a milestone back to incomplete reopens project
      await service.toggleMilestone(m2.id);
      details = (await service.getProjectDetails(project.id))!;
      expect(details.status).toBe('IN_PROGRESS');

      overview = await service.listProjectsByStatus();
      expect(overview.inProgress).toHaveLength(1);
      expect(overview.completed).toHaveLength(0);
    } finally {
      await close();
    }
  });

  it('allows manual project completion and reopening', async () => {
    const { db, close } = await createPgliteTestDb();
    const service = new AcademicService(db);

    try {
      const project = await service.createProject({
        title: 'Redes de Computadores',
        description: 'Socket TCP em Python',
        groupMembers: ['Xavier'],
      });

      expect(project.status).toBe('IN_PROGRESS');
      await service.completeProject(project.id);

      let details = (await service.getProjectDetails(project.id))!;
      expect(details.status).toBe('COMPLETED');

      await service.reopenProject(project.id);
      details = (await service.getProjectDetails(project.id))!;
      expect(details.status).toBe('IN_PROGRESS');
    } finally {
      await close();
    }
  });

  it('creates a planned ("quero fazer") project and lists it under planned', async () => {
    const { db, close } = await createPgliteTestDb();
    const service = new AcademicService(db);

    try {
      const project = await service.createProject({
        title: 'App de Controle de Hábitos',
        description: 'Ideia de projeto pessoal com React Native',
        status: 'PLANNED',
        links: [{ label: 'Referência', url: 'https://example.com/ref' }],
      });

      expect(project.status).toBe('PLANNED');

      const overview = await service.listProjectsByStatus();
      expect(overview.planned).toHaveLength(1);
      expect(overview.planned[0].id).toBe(project.id);
      expect(overview.inProgress).toHaveLength(0);
      expect(overview.completed).toHaveLength(0);
    } finally {
      await close();
    }
  });

  it('starts a planned project via startProject, moving it from planned to inProgress', async () => {
    const { db, close } = await createPgliteTestDb();
    const service = new AcademicService(db);

    try {
      const project = await service.createProject({
        title: 'CLI em Rust',
        description: 'Ferramenta de linha de comando para produtividade',
        status: 'PLANNED',
      });

      expect((await service.listProjectsByStatus()).planned).toHaveLength(1);

      await service.startProject(project.id);

      const details = (await service.getProjectDetails(project.id))!;
      expect(details.status).toBe('IN_PROGRESS');

      const overview = await service.listProjectsByStatus();
      expect(overview.planned).toHaveLength(0);
      expect(overview.inProgress).toHaveLength(1);
      expect(overview.inProgress[0].id).toBe(project.id);

      await expect(service.startProject('nao-existe')).rejects.toThrow(/PROJETO NÃO ENCONTRADO/);
    } finally {
      await close();
    }
  });

  it('edits and deletes a planned project while preserving or updating its status', async () => {
    const { db, close } = await createPgliteTestDb();
    const service = new AcademicService(db);

    try {
      const project = await service.createProject({
        title: 'Blog Pessoal',
        description: 'Ideia de blog com MDX',
        status: 'PLANNED',
      });

      const updated = await service.updateProject(project.id, {
        title: 'Blog Pessoal v2',
        description: 'Ideia atualizada com Astro',
      });
      expect(updated.title).toBe('BLOG PESSOAL V2');
      expect(updated.status).toBe('PLANNED');

      const movedToInProgress = await service.updateProject(project.id, {
        status: 'IN_PROGRESS',
      });
      expect(movedToInProgress.status).toBe('IN_PROGRESS');

      const movedBackToPlanned = await service.updateProject(project.id, {
        status: 'PLANNED',
      });
      expect(movedBackToPlanned.status).toBe('PLANNED');

      await service.deleteProject(project.id);
      expect(await service.getProjectDetails(project.id)).toBeNull();
      expect((await service.listProjectsByStatus()).planned).toHaveLength(0);
    } finally {
      await close();
    }
  });
});
