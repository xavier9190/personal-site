import { z } from 'zod';
import { defineAction, type ActionCatalogEntry } from './types';

export const createProjectSchema = z.object({
  title: z.string().trim().min(1, 'TÍTULO DO PROJETO OBRIGATÓRIO'),
  description: z.string().trim().min(1).optional().default('PROJETO ACADÊMICO'),
  finalDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  groupMembers: z.array(z.string()).optional().default([]),
  links: z.array(z.object({ label: z.string(), url: z.string() })).optional().default([]),
});

export const updateProjectSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  finalDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  groupMembers: z.array(z.string()).optional(),
  links: z.array(z.object({ label: z.string(), url: z.string() })).optional(),
});

export const deleteProjectSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const completeProjectSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const reopenProjectSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const addMilestoneSchema = z.object({
  projectId: z.string().min(1, 'ID DO PROJETO OBRIGATÓRIO'),
  title: z.string().trim().min(1, 'TÍTULO DO MARCO OBRIGATÓRIO'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DATA DO MARCO INVÁLIDA'),
});

export const toggleMilestoneSchema = z.object({
  id: z.string().min(1, 'ID DO MARCO OBRIGATÓRIO'),
});

export const deleteMilestoneSchema = z.object({
  id: z.string().min(1, 'ID DO MARCO OBRIGATÓRIO'),
});

export const ACADEMIC_CATALOG: Record<string, ActionCatalogEntry> = {
  createProject: defineAction({
    name: 'createProject',
    module: 'ACADEMIC',
    displayName: 'CRIAR PROJETO ACADÊMICO',
    entityLabel: 'Projeto Acadêmico',
    operation: 'create',
    description: 'Cria um novo Projeto Acadêmico da faculdade.',
    isDestructive: false,
    schema: createProjectSchema,
    inferableDefaults: {
      description: () => 'PROJETO ACADÊMICO',
      groupMembers: () => [],
      links: () => [],
    },
    fields: {
      title: { name: 'title', label: 'TÍTULO', description: 'Nome do trabalho ou disciplina.', required: true },
      description: { name: 'description', label: 'DESCRIÇÃO', description: 'Resumo do projeto.', required: false, inferableDefault: 'PROJETO ACADÊMICO' },
      finalDeliveryDate: { name: 'finalDeliveryDate', label: 'ENTREGA FINAL', description: 'Data de entrega final (AAAA-MM-DD).', required: false },
      groupMembers: { name: 'groupMembers', label: 'INTEGRANTES', description: 'Lista de integrantes do grupo.', required: false },
      links: { name: 'links', label: 'LINKS', description: 'Links externos (label e url).', required: false },
    },
  }),

  updateProject: defineAction({
    name: 'updateProject',
    module: 'ACADEMIC',
    displayName: 'ATUALIZAR PROJETO ACADÊMICO',
    entityLabel: 'Projeto Acadêmico',
    operation: 'update',
    description: 'Atualiza dados de um Projeto Acadêmico existente pelo ID.',
    isDestructive: false,
    schema: updateProjectSchema,
    fields: {
      id: { name: 'id', label: 'ID DO PROJETO', description: 'ID do Projeto Acadêmico.', required: true },
      title: { name: 'title', label: 'TÍTULO', description: 'Novo título.', required: false },
      description: { name: 'description', label: 'DESCRIÇÃO', description: 'Nova descrição.', required: false },
      finalDeliveryDate: { name: 'finalDeliveryDate', label: 'ENTREGA FINAL', description: 'Nova data de entrega (AAAA-MM-DD).', required: false },
      groupMembers: { name: 'groupMembers', label: 'INTEGRANTES', description: 'Lista atualizada de integrantes.', required: false },
      links: { name: 'links', label: 'LINKS', description: 'Lista atualizada de links.', required: false },
    },
  }),

  deleteProject: defineAction({
    name: 'deleteProject',
    module: 'ACADEMIC',
    displayName: 'EXCLUIR PROJETO ACADÊMICO',
    entityLabel: 'Projeto Acadêmico',
    operation: 'delete',
    description: 'Exclui um Projeto Acadêmico e seus marcos (exige confirmação explícita).',
    isDestructive: true,
    schema: deleteProjectSchema,
    fields: {
      id: { name: 'id', label: 'ID DO PROJETO', description: 'ID do projeto a excluir.', required: true },
    },
  }),

  completeProject: defineAction({
    name: 'completeProject',
    module: 'ACADEMIC',
    displayName: 'CONCLUIR PROJETO ACADÊMICO',
    entityLabel: 'Projeto Acadêmico',
    operation: 'update',
    description: 'Marca um Projeto Acadêmico como concluído.',
    isDestructive: false,
    schema: completeProjectSchema,
    fields: {
      id: { name: 'id', label: 'ID DO PROJETO', description: 'ID do projeto a concluir.', required: true },
    },
  }),

  reopenProject: defineAction({
    name: 'reopenProject',
    module: 'ACADEMIC',
    displayName: 'REABRIR PROJETO ACADÊMICO',
    entityLabel: 'Projeto Acadêmico',
    operation: 'update',
    description: 'Reabre um Projeto Acadêmico concluído para em andamento.',
    isDestructive: false,
    schema: reopenProjectSchema,
    fields: {
      id: { name: 'id', label: 'ID DO PROJETO', description: 'ID do projeto a reabrir.', required: true },
    },
  }),

  addMilestone: defineAction({
    name: 'addMilestone',
    module: 'ACADEMIC',
    displayName: 'ADICIONAR MARCO DE PROJETO',
    entityLabel: 'Marco de Projeto',
    operation: 'create',
    description: 'Adiciona um Marco de Projeto datado na timeline de um Projeto Acadêmico.',
    isDestructive: false,
    schema: addMilestoneSchema,
    fields: {
      projectId: { name: 'projectId', label: 'ID DO PROJETO', description: 'ID do Projeto Acadêmico pai.', required: true },
      title: { name: 'title', label: 'TÍTULO DO MARCO', description: 'Título da entrega parcial.', required: true },
      dueDate: { name: 'dueDate', label: 'DATA DO MARCO', description: 'Data do marco (AAAA-MM-DD).', required: true },
    },
  }),

  toggleMilestone: defineAction({
    name: 'toggleMilestone',
    module: 'ACADEMIC',
    displayName: 'ALTERNAR MARCO [OK]',
    entityLabel: 'Marco de Projeto',
    operation: 'update',
    description: 'Alterna a conclusão de um Marco de Projeto com selo [OK].',
    isDestructive: false,
    schema: toggleMilestoneSchema,
    fields: {
      id: { name: 'id', label: 'ID DO MARCO', description: 'ID do Marco de Projeto.', required: true },
    },
  }),

  deleteMilestone: defineAction({
    name: 'deleteMilestone',
    module: 'ACADEMIC',
    displayName: 'EXCLUIR MARCO DE PROJETO',
    entityLabel: 'Marco de Projeto',
    operation: 'delete',
    description: 'Remove um Marco de Projeto (exige confirmação explícita).',
    isDestructive: true,
    schema: deleteMilestoneSchema,
    fields: {
      id: { name: 'id', label: 'ID DO MARCO', description: 'ID do Marco de Projeto a excluir.', required: true },
    },
  }),
};
