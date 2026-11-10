import { describe, expect, it } from 'vitest';
import { createDbClient } from '@/db';
import { AcademicService } from './service';

describe('AcademicService seam (Projects, Links, Milestones, Completion)', () => {
  it('creates an academic project with members and custom links, and lists it under inProgress', () => {
    const { db, close } = createDbClient(':memory:');
    const service = new AcademicService(db);

    try {
      const project = service.createProject({
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

      const details = service.getProjectDetails(project.id);
      expect(details).not.toBeNull();
      expect(details!.groupMembersList).toEqual(['XAVIER', 'LETICIA', 'CAIO']);
      expect(details!.links).toHaveLength(2);
      expect(details!.links[0].label).toBe('GITHUB');

      const overview = service.listProjectsByStatus();
      expect(overview.inProgress).toHaveLength(1);
      expect(overview.completed).toHaveLength(0);
      expect(overview.inProgress[0].id).toBe(project.id);
    } finally {
      close();
    }
  });

  it('updates project information, links, and deletes project with cascade', () => {
    const { db, close } = createDbClient(':memory:');
    const service = new AcademicService(db);

    try {
      const project = service.createProject({
        title: 'Sistemas Distribuídos',
        description: 'Trabalho de raft consensus',
        finalDeliveryDate: '2026-11-20',
        groupMembers: ['Xavier'],
        links: [{ label: 'GitHub', url: 'https://github.com/example/repo' }],
      });

      const updated = service.updateProject(project.id, {
        title: 'Sistemas Distribuídos - Prática',
        description: 'Implementação de consensus Raft em Go',
        groupMembers: ['Xavier', 'Ruan'],
        links: [
          { label: 'Figma', url: 'https://figma.com/design/123' },
          { label: 'Notion', url: 'https://notion.so/workspace/doc' },
        ],
      });

      expect(updated.title).toBe('SISTEMAS DISTRIBUÍDOS - PRÁTICA');
      const details = service.getProjectDetails(project.id);
      expect(details!.groupMembersList).toEqual(['XAVIER', 'RUAN']);
      expect(details!.links.map((l) => l.label)).toEqual(['FIGMA', 'NOTION']);

      service.deleteProject(project.id);
      expect(service.getProjectDetails(project.id)).toBeNull();
      expect(service.listProjectsByStatus().inProgress).toHaveLength(0);
    } finally {
      close();
    }
  });

  it('manages milestones timeline, toggles [OK] completion, and moves project to completed when all milestones are done', () => {
    const { db, close } = createDbClient(':memory:');
    const service = new AcademicService(db);

    try {
      const project = service.createProject({
        title: 'Compiladores',
        description: 'Analisador léxico e sintático',
        finalDeliveryDate: '2026-11-30',
        groupMembers: ['Xavier'],
      });

      const m1 = service.addMilestone(project.id, {
        title: 'Entrega da Gramática',
        dueDate: '2026-11-10',
        sortOrder: 1,
      });

      const m2 = service.addMilestone(project.id, {
        title: 'Analisador Sintático LL(1)',
        dueDate: '2026-11-20',
        sortOrder: 2,
      });

      let details = service.getProjectDetails(project.id)!;
      expect(details.milestones).toHaveLength(2);
      expect(details.milestones[0].id).toBe(m1.id);
      expect(details.milestones[0].isCompleted).toBe(false);
      expect(details.totalMilestones).toBe(2);
      expect(details.completedMilestones).toBe(0);

      // Toggle first milestone -> completes m1
      const toggled1 = service.toggleMilestone(m1.id);
      expect(toggled1.isCompleted).toBe(true);

      details = service.getProjectDetails(project.id)!;
      expect(details.completedMilestones).toBe(1);
      expect(details.status).toBe('IN_PROGRESS');

      // Toggle second milestone -> all milestones completed -> project automatically marks as COMPLETED
      const toggled2 = service.toggleMilestone(m2.id);
      expect(toggled2.isCompleted).toBe(true);

      details = service.getProjectDetails(project.id)!;
      expect(details.completedMilestones).toBe(2);
      expect(details.status).toBe('COMPLETED');

      let overview = service.listProjectsByStatus();
      expect(overview.inProgress).toHaveLength(0);
      expect(overview.completed).toHaveLength(1);

      // Reopening or toggling a milestone back to incomplete reopens project
      service.toggleMilestone(m2.id);
      details = service.getProjectDetails(project.id)!;
      expect(details.status).toBe('IN_PROGRESS');

      overview = service.listProjectsByStatus();
      expect(overview.inProgress).toHaveLength(1);
      expect(overview.completed).toHaveLength(0);
    } finally {
      close();
    }
  });

  it('allows manual project completion and reopening', () => {
    const { db, close } = createDbClient(':memory:');
    const service = new AcademicService(db);

    try {
      const project = service.createProject({
        title: 'Redes de Computadores',
        description: 'Socket TCP em Python',
        groupMembers: ['Xavier'],
      });

      expect(project.status).toBe('IN_PROGRESS');
      service.completeProject(project.id);

      let details = service.getProjectDetails(project.id)!;
      expect(details.status).toBe('COMPLETED');

      service.reopenProject(project.id);
      details = service.getProjectDetails(project.id)!;
      expect(details.status).toBe('IN_PROGRESS');
    } finally {
      close();
    }
  });
});
