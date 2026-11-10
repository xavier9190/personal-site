'use server';

import { revalidatePath } from 'next/cache';
import {
  AcademicService,
  type CreateMilestoneInput,
  type CreateProjectInput,
  type UpdateMilestoneInput,
  type UpdateProjectInput,
} from './service';

export interface ActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

function run<T>(fn: (service: AcademicService) => T, fallback: string): ActionResult<T> {
  try {
    const service = new AcademicService();
    const data = fn(service);
    revalidatePath('/academico');
    revalidatePath('/calendario');
    revalidatePath('/');
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : fallback };
  }
}

export async function createProjectAction(input: CreateProjectInput) {
  return run((s) => s.createProject(input), 'ERRO AO CRIAR PROJETO');
}

export async function updateProjectAction(id: string, input: UpdateProjectInput) {
  return run((s) => s.updateProject(id, input), 'ERRO AO ATUALIZAR PROJETO');
}

export async function deleteProjectAction(id: string) {
  return run((s) => s.deleteProject(id), 'ERRO AO EXCLUIR PROJETO');
}

export async function completeProjectAction(id: string) {
  return run((s) => s.completeProject(id), 'ERRO AO CONCLUIR PROJETO');
}

export async function reopenProjectAction(id: string) {
  return run((s) => s.reopenProject(id), 'ERRO AO REABRIR PROJETO');
}

export async function addMilestoneAction(
  projectId: string,
  input: Omit<CreateMilestoneInput, 'projectId'>,
) {
  return run((s) => s.addMilestone(projectId, input), 'ERRO AO ADICIONAR MARCO');
}

export async function updateMilestoneAction(id: string, input: UpdateMilestoneInput) {
  return run((s) => s.updateMilestone(id, input), 'ERRO AO ATUALIZAR MARCO');
}

export async function toggleMilestoneAction(id: string) {
  return run((s) => s.toggleMilestone(id), 'ERRO AO ALTERAR STATUS DO MARCO');
}

export async function deleteMilestoneAction(id: string) {
  return run((s) => s.deleteMilestone(id), 'ERRO AO EXCLUIR MARCO');
}
