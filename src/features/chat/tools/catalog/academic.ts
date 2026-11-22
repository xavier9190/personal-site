import { z } from 'zod';
import {
  createMilestoneSchema as canonicalCreateMilestoneSchema,
  createProjectLinkSchema as canonicalCreateProjectLinkSchema,
  createProjectSchema as canonicalCreateProjectSchema,
  updateMilestoneSchema as canonicalUpdateMilestoneSchema,
  updateProjectLinkSchema as canonicalUpdateProjectLinkSchema,
  updateProjectSchema as canonicalUpdateProjectSchema,
} from '@/features/academic/types';
import { defineAction, type ActionCatalogEntry, type ActionDefaultsContext } from './types';

export function applyCreateProjectDefaults(
  rawArgs: Record<string, unknown>,
  _ctx?: ActionDefaultsContext,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...rawArgs };

  if (typeof out.description !== 'string' || !out.description.trim()) {
    out.description = 'PROJETO ACADÊMICO';
  }
  if (out.finalDeliveryDate === '') {
    out.finalDeliveryDate = undefined;
  }
  if (out.groupMembers === undefined || out.groupMembers === null) {
    out.groupMembers = [];
  }
  if (out.links === undefined || out.links === null) {
    out.links = [];
  }
  if (out.status === undefined || out.status === null || out.status === '') {
    out.status = 'IN_PROGRESS';
  }

  return out;
}

export const createProjectSchema = canonicalCreateProjectSchema;

export const updateProjectSchema = z
  .object({
    id: z.string().min(1, 'ID OBRIGATÓRIO'),
  })
  .extend(canonicalUpdateProjectSchema.shape);

export const deleteProjectSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const startProjectSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const completeProjectSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const reopenProjectSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const addMilestoneSchema = canonicalCreateMilestoneSchema;

export const updateMilestoneSchema = z
  .object({
    id: z.string().min(1, 'ID DO MARCO OBRIGATÓRIO'),
  })
  .extend(canonicalUpdateMilestoneSchema.shape);

export const toggleMilestoneSchema = z.object({
  id: z.string().min(1, 'ID DO MARCO OBRIGATÓRIO'),
});

export const deleteMilestoneSchema = z.object({
  id: z.string().min(1, 'ID DO MARCO OBRIGATÓRIO'),
});

export const addProjectLinkSchema = canonicalCreateProjectLinkSchema;

export const updateProjectLinkSchema = z
  .object({
    id: z.string().min(1, 'ID DO LINK OBRIGATÓRIO'),
  })
  .extend(canonicalUpdateProjectLinkSchema.shape);

export const deleteProjectLinkSchema = z.object({
  id: z.string().min(1, 'ID DO LINK OBRIGATÓRIO'),
});

export const ACADEMIC_CATALOG: Record<string, ActionCatalogEntry> = {
  createProject: defineAction({
    name: 'createProject',
    module: 'ACADEMIC',
    displayName: 'CRIAR PROJETO ACADÊMICO',
    entityLabel: 'Projeto Acadêmico',
    operation: 'create',
    description: 'Cria um novo Projeto Acadêmico da faculdade ou projeto planejado (Quero Fazer).',
    isDestructive: false,
    schema: createProjectSchema,
    inferableDefaults: {
      description: () => 'PROJETO ACADÊMICO',
      groupMembers: () => [],
      links: () => [],
      status: () => 'IN_PROGRESS',
    },
    applyDefaults: applyCreateProjectDefaults,
    fields: {
      title: { name: 'title', label: 'TÍTULO', description: 'Nome do trabalho ou disciplina.', required: true },
      description: {
        name: 'description',
        label: 'DESCRIÇÃO',
        description: 'Resumo do projeto.',
        required: false,
        inferableDefault: 'PROJETO ACADÊMICO',
      },
      finalDeliveryDate: {
        name: 'finalDeliveryDate',
        label: 'ENTREGA FINAL',
        description: 'Data de entrega final (AAAA-MM-DD).',
        required: false,
      },
      groupMembers: {
        name: 'groupMembers',
        label: 'INTEGRANTES',
        description: 'Lista de integrantes do grupo.',
        required: false,
        inferableDefault: '[]',
      },
      links: {
        name: 'links',
        label: 'LINKS',
        description: 'Links externos (label e url válida).',
        required: false,
        inferableDefault: '[]',
      },
      status: {
        name: 'status',
        label: 'STATUS',
        description: 'Status inicial: PLANNED (Quero Fazer), IN_PROGRESS (Em Andamento) ou COMPLETED.',
        required: false,
        inferableDefault: 'IN_PROGRESS',
      },
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
      finalDeliveryDate: {
        name: 'finalDeliveryDate',
        label: 'ENTREGA FINAL',
        description: 'Nova data de entrega (AAAA-MM-DD ou null para limpar).',
        required: false,
      },
      groupMembers: {
        name: 'groupMembers',
        label: 'INTEGRANTES',
        description: 'Lista atualizada de integrantes.',
        required: false,
      },
      links: {
        name: 'links',
        label: 'LINKS',
        description: 'Lista completa atualizada de links (use addProjectLink/updateProjectLink para edições pontuais).',
        required: false,
      },
      status: {
        name: 'status',
        label: 'STATUS',
        description: 'Novo status: PLANNED, IN_PROGRESS ou COMPLETED.',
        required: false,
      },
    },
  }),

  deleteProject: defineAction({
    name: 'deleteProject',
    module: 'ACADEMIC',
    displayName: 'EXCLUIR PROJETO ACADÊMICO',
    entityLabel: 'Projeto Acadêmico',
    operation: 'delete',
    description: 'Exclui um Projeto Acadêmico e seus marcos/links (exige confirmação explícita).',
    isDestructive: true,
    schema: deleteProjectSchema,
    fields: {
      id: { name: 'id', label: 'ID DO PROJETO', description: 'ID do projeto a excluir.', required: true },
    },
  }),

  startProject: defineAction({
    name: 'startProject',
    module: 'ACADEMIC',
    displayName: 'INICIAR PROJETO ACADÊMICO',
    entityLabel: 'Projeto Acadêmico',
    operation: 'update',
    description: 'Move um Projeto Acadêmico planejado (Quero Fazer) para Em Andamento.',
    isDestructive: false,
    schema: startProjectSchema,
    fields: {
      id: { name: 'id', label: 'ID DO PROJETO', description: 'ID do projeto a iniciar.', required: true },
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
    inferableDefaults: {
      sortOrder: () => 0,
    },
    fields: {
      projectId: { name: 'projectId', label: 'ID DO PROJETO', description: 'ID do Projeto Acadêmico pai.', required: true },
      title: { name: 'title', label: 'TÍTULO DO MARCO', description: 'Título da entrega parcial.', required: true },
      dueDate: { name: 'dueDate', label: 'DATA DO MARCO', description: 'Data do marco (AAAA-MM-DD).', required: true },
      sortOrder: {
        name: 'sortOrder',
        label: 'ORDEM',
        description: 'Posição de ordenação na linha do tempo.',
        required: false,
        inferableDefault: '0',
      },
    },
  }),

  updateMilestone: defineAction({
    name: 'updateMilestone',
    module: 'ACADEMIC',
    displayName: 'ATUALIZAR MARCO DE PROJETO',
    entityLabel: 'Marco de Projeto',
    operation: 'update',
    description: 'Atualiza título, data, status ou ordem de um Marco de Projeto existente.',
    isDestructive: false,
    schema: updateMilestoneSchema,
    fields: {
      id: { name: 'id', label: 'ID DO MARCO', description: 'ID do Marco de Projeto.', required: true },
      title: { name: 'title', label: 'TÍTULO DO MARCO', description: 'Novo título do marco.', required: false },
      dueDate: { name: 'dueDate', label: 'DATA DO MARCO', description: 'Nova data (AAAA-MM-DD).', required: false },
      isCompleted: { name: 'isCompleted', label: 'CONCLUÍDO [OK]', description: 'true se concluído, false se pendente.', required: false },
      sortOrder: { name: 'sortOrder', label: 'ORDEM', description: 'Nova posição na timeline.', required: false },
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

  addProjectLink: defineAction({
    name: 'addProjectLink',
    module: 'ACADEMIC',
    displayName: 'ADICIONAR LINK AO PROJETO',
    entityLabel: 'Link de Projeto',
    operation: 'create',
    description: 'Adiciona um link externo (GitHub, Drive, Figma, etc.) a um Projeto Acadêmico existente sem sobrescrever outros links.',
    isDestructive: false,
    schema: addProjectLinkSchema,
    fields: {
      projectId: { name: 'projectId', label: 'ID DO PROJETO', description: 'ID do Projeto Acadêmico pai.', required: true },
      label: { name: 'label', label: 'RÓTULO DO LINK', description: 'Nome/plataforma do link (ex.: GITHUB, DRIVE, FIGMA).', required: true },
      url: { name: 'url', label: 'URL', description: 'Endereço URL válido do recurso.', required: true },
    },
  }),

  updateProjectLink: defineAction({
    name: 'updateProjectLink',
    module: 'ACADEMIC',
    displayName: 'ATUALIZAR LINK DE PROJETO',
    entityLabel: 'Link de Projeto',
    operation: 'update',
    description: 'Atualiza o rótulo ou URL de um link específico de um Projeto Acadêmico.',
    isDestructive: false,
    schema: updateProjectLinkSchema,
    fields: {
      id: { name: 'id', label: 'ID DO LINK', description: 'ID do Link de Projeto.', required: true },
      label: { name: 'label', label: 'RÓTULO DO LINK', description: 'Novo rótulo do link.', required: false },
      url: { name: 'url', label: 'URL', description: 'Nova URL válida.', required: false },
    },
  }),

  deleteProjectLink: defineAction({
    name: 'deleteProjectLink',
    module: 'ACADEMIC',
    displayName: 'EXCLUIR LINK DE PROJETO',
    entityLabel: 'Link de Projeto',
    operation: 'delete',
    description: 'Remove um link de um Projeto Acadêmico (exige confirmação explícita).',
    isDestructive: true,
    schema: deleteProjectLinkSchema,
    fields: {
      id: { name: 'id', label: 'ID DO LINK', description: 'ID do Link de Projeto a excluir.', required: true },
    },
  }),
};
