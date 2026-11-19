'use server';

import { revalidatePath } from 'next/cache';
import { requireSessionAuth } from '@/lib/session-auth';
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
  await requireSessionAuth();
  return run((s) => s.createProject(input), 'ERRO AO CRIAR PROJETO');
}

export async function updateProjectAction(id: string, input: UpdateProjectInput) {
  await requireSessionAuth();
  return run((s) => s.updateProject(id, input), 'ERRO AO ATUALIZAR PROJETO');
}

export async function deleteProjectAction(id: string) {
  await requireSessionAuth();
  return run((s) => s.deleteProject(id), 'ERRO AO EXCLUIR PROJETO');
}

export async function startProjectAction(id: string) {
  await requireSessionAuth();
  return run((s) => s.startProject(id), 'ERRO AO INICIAR PROJETO');
}

export async function completeProjectAction(id: string) {
  await requireSessionAuth();
  return run((s) => s.completeProject(id), 'ERRO AO CONCLUIR PROJETO');
}

export async function reopenProjectAction(id: string) {
  await requireSessionAuth();
  return run((s) => s.reopenProject(id), 'ERRO AO REABRIR PROJETO');
}

export async function addMilestoneAction(
  projectId: string,
  input: Omit<CreateMilestoneInput, 'projectId'>,
) {
  await requireSessionAuth();
  return run((s) => s.addMilestone(projectId, input), 'ERRO AO ADICIONAR MARCO');
}

export async function updateMilestoneAction(id: string, input: UpdateMilestoneInput) {
  await requireSessionAuth();
  return run((s) => s.updateMilestone(id, input), 'ERRO AO ATUALIZAR MARCO');
}

export async function toggleMilestoneAction(id: string) {
  await requireSessionAuth();
  return run((s) => s.toggleMilestone(id), 'ERRO AO ALTERAR STATUS DO MARCO');
}

export async function deleteMilestoneAction(id: string) {
  await requireSessionAuth();
  return run((s) => s.deleteMilestone(id), 'ERRO AO EXCLUIR MARCO');
}
