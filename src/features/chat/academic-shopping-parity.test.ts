import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setDbForTesting, type AppDatabase } from '@/db';
import { createPgliteTestDb } from '@/db/pglite-test';
import { AcademicService } from '@/features/academic/service';
import { FinancesService } from '@/features/finances/service';
import { ShoppingService } from '@/features/shopping/service';
import { setAIProviderForTesting } from './ai/provider';
import type { AIProvider, GenerateTurnInput } from './ai/types';
import { ChatService } from './service';
import {
  ACADEMIC_CATALOG,
  buildGeminiFunctionDeclaration,
  SHOPPING_CATALOG,
} from './tools/catalog';
import {
  cancelPendingAction,
  confirmPendingAction,
  undoChatAction,
} from './tools/dispatcher';
import { POST as chatStreamPost } from '@/app/api/chat/stream/route';

async function readSseEvents(res: Response): Promise<Array<Record<string, any>>> {
  const reader = res.body?.getReader();
  expect(reader).toBeDefined();

  const decoder = new TextDecoder();
  let streamText = '';
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    streamText += decoder.decode(value, { stream: true });
  }

  return streamText
    .split('\n\n')
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => JSON.parse(chunk.slice(6)));
}

async function sendStreamTurn(
  threadId: string,
  message: string,
  toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }>,
  replyText: string = 'AÇÃO PROCESSADA.',
): Promise<Array<Record<string, any>>> {
  const mockProvider: AIProvider = {
    generateTurn: vi.fn(async (input: GenerateTurnInput) => {
      if (input.toolResults) {
        return { text: replyText, toolCalls: [], source: 'mock' as const };
      }
      return { text: replyText, toolCalls, source: 'mock' as const };
    }),
    async *generateStream() {
      yield replyText;
    },
  };
  setAIProviderForTesting(mockProvider);

  const req = new NextRequest('http://localhost:3000/api/chat/stream', {
    method: 'POST',
    body: JSON.stringify({ threadId, message }),
  });

  const res = await chatStreamPost(req);
  expect(res.status).toBe(200);
  const events = await readSseEvents(res);
  return events;
}

describe('Acadêmico & Compras Catalog Parity & Canonical Schema Binding', () => {
  it('registers every Acadêmico & Compras tool and builds valid Gemini FunctionDeclarations', () => {
    expect(Object.keys(ACADEMIC_CATALOG)).toEqual(
      expect.arrayContaining([
        'createProject',
        'updateProject',
        'deleteProject',
        'startProject',
        'completeProject',
        'reopenProject',
        'addMilestone',
        'updateMilestone',
        'toggleMilestone',
        'deleteMilestone',
        'addProjectLink',
        'updateProjectLink',
        'deleteProjectLink',
      ]),
    );

    expect(Object.keys(SHOPPING_CATALOG)).toEqual(
      expect.arrayContaining([
        'addWishlistItem',
        'updateWishlistItem',
        'deleteWishlistItem',
        'addPurchasedItem',
        'updateInTransitItem',
        'markPurchased',
        'markDelivered',
        'revertDelivered',
        'revertToWishlist',
      ]),
    );

    const allEntries = [...Object.values(ACADEMIC_CATALOG), ...Object.values(SHOPPING_CATALOG)];
    for (const entry of allEntries) {
      const decl = buildGeminiFunctionDeclaration(entry);
      expect(decl.name).toBe(entry.name);
      expect(decl.description).toBeTruthy();

      const params = decl.parametersJsonSchema as Record<string, unknown>;
      expect(params).toBeDefined();
      expect(params.$schema).toBeUndefined();
      expect(params.type).toBe('object');

      if (entry.operation === 'create' || entry.operation === 'update') {
        expect(params.required).toBeUndefined();
      } else if (entry.operation === 'delete') {
        expect(params.required).toContain('id');
      }

      const props = (params.properties ?? {}) as Record<string, Record<string, unknown>>;
      for (const fieldName of Object.keys(entry.fields)) {
        expect(props[fieldName], `${entry.name}.${fieldName} missing from JSON Schema`).toBeDefined();
        expect(props[fieldName].description).toBeTruthy();
      }
    }

    expect(ACADEMIC_CATALOG.deleteProjectLink.isDestructive).toBe(true);
    expect(ACADEMIC_CATALOG.deleteProject.isDestructive).toBe(true);
    expect(ACADEMIC_CATALOG.deleteMilestone.isDestructive).toBe(true);
    expect(SHOPPING_CATALOG.deleteWishlistItem.isDestructive).toBe(true);
  });

  it('binds Acadêmico and Compras catalog schemas to canonical domain rules and inferable defaults', () => {
    const createProj = ACADEMIC_CATALOG.createProject;
    const preparedProj = createProj.applyDefaults!(
      { title: 'IA APLICADA', status: 'PLANNED' },
      { currentDateRecife: '2026-11-20' },
    );
    const parsedProj = createProj.schema.parse(preparedProj) as Record<string, unknown>;
    expect(parsedProj.description).toBe('PROJETO ACADÊMICO');
    expect(parsedProj.status).toBe('PLANNED');

    expect(() =>
      createProj.schema.parse({
        title: 'IA APLICADA',
        description: 'TESTE',
        finalDeliveryDate: '2026-02-30',
      }),
    ).toThrow();

    expect(() =>
      createProj.schema.parse({
        title: 'IA APLICADA',
        description: 'TESTE',
        links: [{ label: 'GitHub', url: 'url-invalida' }],
      }),
    ).toThrow();

    expect(() =>
      ACADEMIC_CATALOG.addMilestone.schema.parse({
        projectId: 'p1',
        title: 'MARCO 1',
        dueDate: '2026-02-30',
      }),
    ).toThrow();

    const addPurchased = SHOPPING_CATALOG.addPurchasedItem;
    const preparedPurchase = addPurchased.applyDefaults!(
      {
        name: 'FONE BLUETOOTH',
        priceCents: 25000,
        storeApp: 'AMAZON',
        estimatedDeliveryDate: '2026-12-01',
        alreadyLoggedInFinances: false,
        payment: { mode: 'CASH' },
      },
      { currentDateRecife: '2026-11-20' },
    );
    const parsedPurchase = addPurchased.schema.parse(preparedPurchase) as Record<string, unknown>;
    expect(parsedPurchase.purchasedAt).toBe('2026-11-20');

    expect(() =>
      addPurchased.schema.parse({
        name: 'FONE',
        priceCents: 25000,
        storeApp: 'AMAZON',
        estimatedDeliveryDate: '2026-12-01',
        alreadyLoggedInFinances: false,
      }),
    ).toThrow(/FORMA DE PAGAMENTO/);

    expect(() =>
      addPurchased.schema.parse({
        name: 'FONE',
        priceCents: 25000,
        storeApp: 'AMAZON',
        estimatedDeliveryDate: '2026-02-30',
        alreadyLoggedInFinances: true,
      }),
    ).toThrow();

    expect(() =>
      SHOPPING_CATALOG.updateInTransitItem.schema.parse({
        id: 'item-1',
        estimatedDeliveryDate: '2026-12-10',
      }),
    ).not.toThrow();
  });
});

describe('End-to-End Acadêmico & Compras Parity via /api/chat/stream (PGlite + Mock AIProvider)', () => {
  let testDb: AppDatabase;
  let closeTestDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const { db, close } = await createPgliteTestDb();
    testDb = db;
    setDbForTesting(db);
    closeTestDb = close;
  });

  afterAll(async () => {
    setAIProviderForTesting(null);
    setDbForTesting(null);
    if (closeTestDb) {
      await closeTestDb();
      closeTestDb = null;
    }
  });

  afterEach(() => {
    setAIProviderForTesting(null);
  });

  it('executes Acadêmico startProject, updateProject, updateMilestone, and Project Link CRUD with undo and delete confirmation', async () => {
    const chat = new ChatService(testDb);
    const academic = new AcademicService(testDb);
    const thread = await chat.createThread('ACADEMIC PARITY E2E');

    // 1. Create a PLANNED project with initial group member and link
    const createEvents = await sendStreamTurn(thread.id, 'cria ideia de projeto de banco de dados', [
      {
        id: 'tc-proj-create',
        name: 'createProject',
        args: {
          title: 'BANCO DE DADOS',
          status: 'PLANNED',
          groupMembers: ['XAVIER', 'LETÍCIA'],
          links: [{ label: 'GitHub', url: 'https://github.com/xavier/bd' }],
        },
      },
    ]);
    const createDone = createEvents.find((e) => e.type === 'done');
    expect(createDone?.toolCalls[0].status).toBe('CONFIRMED');

    const plannedList = (await academic.listProjectsByStatus()).planned;
    const project = plannedList.find((p) => p.title === 'BANCO DE DADOS')!;
    expect(project).toBeDefined();
    expect(project.status).toBe('PLANNED');
    expect(project.links).toHaveLength(1);

    // 2. Start planned project via startProject & undo back to PLANNED
    const startEvents = await sendStreamTurn(thread.id, 'comecei a fazer banco de dados', [
      { id: 'tc-proj-start', name: 'startProject', args: { id: project.id } },
    ]);
    const startDone = startEvents.find((e) => e.type === 'done');
    expect(startDone?.toolCalls[0].status).toBe('CONFIRMED');
    expect((await academic.getProjectDetails(project.id))?.status).toBe('IN_PROGRESS');

    await undoChatAction(startDone!.toolCalls[0].actionId, testDb);
    expect((await academic.getProjectDetails(project.id))?.status).toBe('PLANNED');

    // Start again so project is IN_PROGRESS
    await sendStreamTurn(thread.id, 'inicia o projeto banco de dados', [
      { id: 'tc-proj-start-2', name: 'startProject', args: { id: project.id } },
    ]);

    // 3. Update project title and undo (must preserve groupMembers & links)
    const updateProjEvents = await sendStreamTurn(thread.id, 'renomeia o projeto para BD II', [
      {
        id: 'tc-proj-update',
        name: 'updateProject',
        args: { id: project.id, title: 'BANCO DE DADOS II' },
      },
    ]);
    const updateProjDone = updateProjEvents.find((e) => e.type === 'done');
    expect((await academic.getProjectDetails(project.id))?.title).toBe('BANCO DE DADOS II');

    await undoChatAction(updateProjDone!.toolCalls[0].actionId, testDb);
    const afterProjUndo = (await academic.getProjectDetails(project.id))!;
    expect(afterProjUndo.title).toBe('BANCO DE DADOS');
    expect(afterProjUndo.groupMembersList).toEqual(['XAVIER', 'LETÍCIA']);
    expect(afterProjUndo.links).toHaveLength(1);

    // 4. Add milestone, updateMilestone, and undo updateMilestone
    const addMsEvents = await sendStreamTurn(thread.id, 'adiciona marco modelagem dia 2026-12-01', [
      {
        id: 'tc-ms-add',
        name: 'addMilestone',
        args: {
          projectId: project.id,
          title: 'MODELAGEM ER',
          dueDate: '2026-12-01',
          sortOrder: 1,
        },
      },
    ]);
    const msId = addMsEvents.find((e) => e.type === 'done')!.toolCalls[0].data.id;

    const updateMsEvents = await sendStreamTurn(
      thread.id,
      'muda a entrega da modelagem para 2026-12-05 e marca como concluído',
      [
        {
          id: 'tc-ms-update',
          name: 'updateMilestone',
          args: {
            id: msId,
            title: 'MODELAGEM RELACIONAL',
            dueDate: '2026-12-05',
            isCompleted: true,
          },
        },
      ],
    );
    const updateMsDone = updateMsEvents.find((e) => e.type === 'done')!;
    expect(updateMsDone.toolCalls[0].status).toBe('CONFIRMED');
    let reloadedMs = (await academic.getMilestoneById(msId))!;
    expect(reloadedMs.title).toBe('MODELAGEM RELACIONAL');
    expect(reloadedMs.dueDate).toBe('2026-12-05');
    expect(reloadedMs.isCompleted).toBe(true);

    await undoChatAction(updateMsDone.toolCalls[0].actionId, testDb);
    reloadedMs = (await academic.getMilestoneById(msId))!;
    expect(reloadedMs.title).toBe('MODELAGEM ER');
    expect(reloadedMs.dueDate).toBe('2026-12-01');
    expect(reloadedMs.isCompleted).toBe(false);

    // 5. Add Project Link (preserving GitHub link), updateProjectLink + undo, deleteProjectLink guardrail
    const addLinkEvents = await sendStreamTurn(
      thread.id,
      'bota esse link do Figma no projeto de Banco de Dados',
      [
        {
          id: 'tc-link-add',
          name: 'addProjectLink',
          args: {
            projectId: project.id,
            label: 'Figma',
            url: 'https://figma.com/file/bd-schema',
          },
        },
      ],
    );
    const addLinkDone = addLinkEvents.find((e) => e.type === 'done')!;
    expect(addLinkDone.toolCalls[0].status).toBe('CONFIRMED');
    const newLinkId = addLinkDone.toolCalls[0].data.id;

    let details = (await academic.getProjectDetails(project.id))!;
    expect(details.links.map((l) => l.label)).toEqual(['GITHUB', 'FIGMA']);

    const updateLinkEvents = await sendStreamTurn(thread.id, 'atualiza o link do Figma', [
      {
        id: 'tc-link-upd',
        name: 'updateProjectLink',
        args: {
          id: newLinkId,
          label: 'DIAGRAMA FIGMA',
          url: 'https://figma.com/file/bd-schema-v2',
        },
      },
    ]);
    const updateLinkDone = updateLinkEvents.find((e) => e.type === 'done')!;
    expect(updateLinkDone.toolCalls[0].status).toBe('CONFIRMED');
    expect((await academic.getProjectLinkById(newLinkId))?.label).toBe('DIAGRAMA FIGMA');

    await undoChatAction(updateLinkDone.toolCalls[0].actionId, testDb);
    expect((await academic.getProjectLinkById(newLinkId))?.label).toBe('FIGMA');
    expect((await academic.getProjectLinkById(newLinkId))?.url).toBe(
      'https://figma.com/file/bd-schema',
    );

    // Delete link stops at PENDING_CONFIRMATION
    const delLinkEvents = await sendStreamTurn(thread.id, 'apaga o link do Figma', [
      { id: 'tc-link-del', name: 'deleteProjectLink', args: { id: newLinkId } },
    ]);
    const delLinkDone = delLinkEvents.find((e) => e.type === 'done')!;
    expect(delLinkDone.toolCalls[0].status).toBe('PENDING_CONFIRMATION');
    expect(delLinkDone.toolCalls[0].isDestructive).toBe(true);
    expect((await academic.getProjectDetails(project.id))!.links).toHaveLength(2);

    // Cancel keeps the link
    await cancelPendingAction(delLinkDone.toolCalls[0].actionId, testDb);
    expect((await academic.getProjectDetails(project.id))!.links).toHaveLength(2);

    // Re-stage and confirm deletes ONLY that link
    const delLinkEvents2 = await sendStreamTurn(thread.id, 'apaga mesmo o link do Figma', [
      { id: 'tc-link-del-2', name: 'deleteProjectLink', args: { id: newLinkId } },
    ]);
    const delLinkActionId2 = delLinkEvents2.find((e) => e.type === 'done')!.toolCalls[0].actionId;
    await confirmPendingAction(delLinkActionId2, testDb);

    details = (await academic.getProjectDetails(project.id))!;
    expect(details.links).toHaveLength(1);
    expect(details.links[0].label).toBe('GITHUB');
  });

  it('executes Compras addPurchasedItem (CASH & INSTALLMENTS + Finanças sync & undo rollback) and updateInTransitItem via /api/chat/stream', async () => {
    const chat = new ChatService(testDb);
    const shopping = new ShoppingService(testDb);
    const finances = new FinancesService(testDb);
    const thread = await chat.createThread('SHOPPING PARITY E2E');

    // 1. addPurchasedItem with CASH payment -> creates in-transit item + Finanças transaction
    const cashEvents = await sendStreamTurn(
      thread.id,
      'comprei um fone sony por 320 reais na amazon à vista, chega dia 2026-12-08',
      [
        {
          id: 'tc-buy-cash',
          name: 'addPurchasedItem',
          args: {
            name: 'FONE SONY WH-1000XM5',
            priceCents: 32000,
            productUrl: 'https://amazon.com.br/fone',
            storeApp: 'Amazon',
            estimatedDeliveryDate: '2026-12-08',
            alreadyLoggedInFinances: false,
            payment: { mode: 'CASH' },
          },
        },
      ],
    );
    const cashDone = cashEvents.find((e) => e.type === 'done')!;
    expect(cashDone.toolCalls[0].status).toBe('CONFIRMED');
    const cashItemId = cashDone.toolCalls[0].data.id;

    expect((await shopping.listItemsBySection()).inTransit.some((i) => i.id === cashItemId)).toBe(true);
    expect((await finances.listTransactions()).some((t) => t.shoppingItemId === cashItemId)).toBe(true);

    // Undo CASH addPurchasedItem -> removes BOTH Finanças transaction and shopping item
    await undoChatAction(cashDone.toolCalls[0].actionId, testDb);
    expect((await shopping.listItemsBySection()).inTransit.some((i) => i.id === cashItemId)).toBe(false);
    expect((await finances.listTransactions()).some((t) => t.shoppingItemId === cashItemId)).toBe(false);

    // 2. addPurchasedItem with INSTALLMENTS -> creates in-transit item + Finanças installment plan
    const instEvents = await sendStreamTurn(
      thread.id,
      'comprei monitor lg de 1200 reais em 4x no mercado livre começando em 2026-12',
      [
        {
          id: 'tc-buy-inst',
          name: 'addPurchasedItem',
          args: {
            name: 'MONITOR LG 27',
            priceCents: 120000,
            storeApp: 'Mercado Livre',
            estimatedDeliveryDate: '2026-12-12',
            alreadyLoggedInFinances: false,
            payment: {
              mode: 'INSTALLMENTS',
              totalInstallments: 4,
              startMonth: '2026-12',
            },
          },
        },
      ],
    );
    const instDone = instEvents.find((e) => e.type === 'done')!;
    expect(instDone.toolCalls[0].status).toBe('CONFIRMED');
    const instItemId = instDone.toolCalls[0].data.id;

    expect((await finances.listInstallmentPlans()).some((p) => p.shoppingItemId === instItemId)).toBe(
      true,
    );

    // Undo INSTALLMENTS addPurchasedItem -> removes BOTH installment plan and shopping item
    await undoChatAction(instDone.toolCalls[0].actionId, testDb);
    expect((await shopping.listItemsBySection()).inTransit.some((i) => i.id === instItemId)).toBe(false);
    expect((await finances.listInstallmentPlans()).some((p) => p.shoppingItemId === instItemId)).toBe(
      false,
    );

    // 3. addPurchasedItem already logged in finances + updateInTransitItem + undo + delete guardrail
    const loggedEvents = await sendStreamTurn(
      thread.id,
      'comprei webcam logitech por 450 na shopee já lancei em finanças',
      [
        {
          id: 'tc-buy-logged',
          name: 'addPurchasedItem',
          args: {
            name: 'WEBCAM LOGITECH',
            priceCents: 45000,
            productUrl: 'https://shopee.com.br/webcam',
            storeApp: 'Shopee',
            estimatedDeliveryDate: '2026-12-10',
            alreadyLoggedInFinances: true,
          },
        },
      ],
    );
    const loggedDone = loggedEvents.find((e) => e.type === 'done')!;
    const webcamId = loggedDone.toolCalls[0].data.id;
    expect(await finances.listTransactions()).toHaveLength(0);
    expect(await finances.listInstallmentPlans()).toHaveLength(0);

    // Update in-transit item partially
    const updateTransitEvents = await sendStreamTurn(
      thread.id,
      'muda a entrega da webcam para amazon dia 2026-12-15',
      [
        {
          id: 'tc-transit-upd',
          name: 'updateInTransitItem',
          args: {
            id: webcamId,
            storeApp: 'Amazon',
            estimatedDeliveryDate: '2026-12-15',
          },
        },
      ],
    );
    const updateTransitDone = updateTransitEvents.find((e) => e.type === 'done')!;
    expect(updateTransitDone.toolCalls[0].status).toBe('CONFIRMED');

    let reloaded = (await shopping.listItemsBySection()).inTransit.find((i) => i.id === webcamId)!;
    expect(reloaded.name).toBe('WEBCAM LOGITECH');
    expect(reloaded.priceCents).toBe(45000);
    expect(reloaded.storeApp).toBe('AMAZON');
    expect(reloaded.estimatedDeliveryDate).toBe('2026-12-15');

    // Undo updateInTransitItem
    await undoChatAction(updateTransitDone.toolCalls[0].actionId, testDb);
    reloaded = (await shopping.listItemsBySection()).inTransit.find((i) => i.id === webcamId)!;
    expect(reloaded.storeApp).toBe('SHOPEE');
    expect(reloaded.estimatedDeliveryDate).toBe('2026-12-10');

    // Delete in-transit item stops at PENDING_CONFIRMATION guardrail
    const delTransitEvents = await sendStreamTurn(thread.id, 'apaga a entrega da webcam', [
      { id: 'tc-transit-del', name: 'deleteWishlistItem', args: { id: webcamId } },
    ]);
    const delTransitDone = delTransitEvents.find((e) => e.type === 'done')!;
    expect(delTransitDone.toolCalls[0].status).toBe('PENDING_CONFIRMATION');
    expect(delTransitDone.toolCalls[0].isDestructive).toBe(true);
    expect((await shopping.listItemsBySection()).inTransit).toHaveLength(1);

    await confirmPendingAction(delTransitDone.toolCalls[0].actionId, testDb);
    expect((await shopping.listItemsBySection()).inTransit).toHaveLength(0);
  });

  it('surfaces canonical Zod errors from /api/chat/stream when addPurchasedItem or addProjectLink receives invalid fields', async () => {
    const chat = new ChatService(testDb);
    const academic = new AcademicService(testDb);
    const shopping = new ShoppingService(testDb);
    const thread = await chat.createThread('PARITY VALIDATION E2E');

    const project = await academic.createProject({
      title: 'COMPILADORES',
      description: 'ANALISADOR SINTÁTICO',
    });

    const mockProvider: AIProvider = {
      generateTurn: vi.fn(async (input: GenerateTurnInput) => {
        if (!input.toolResults) {
          return {
            text: '',
            toolCalls: [
              {
                id: 'tc-bad-link',
                name: 'addProjectLink',
                args: { projectId: project.id, label: 'GitHub', url: 'nao-e-url' },
              },
              {
                id: 'tc-bad-purchase',
                name: 'addPurchasedItem',
                args: {
                  name: 'CADEIRA',
                  priceCents: 90000,
                  storeApp: 'Amazon',
                  estimatedDeliveryDate: '2026-02-30',
                  alreadyLoggedInFinances: true,
                },
              },
            ],
            source: 'mock' as const,
          };
        }

        const errors = input.toolResults.map((r) => r.error).join(' | ');
        return {
          text: `ERROS: ${errors}`,
          toolCalls: [],
          source: 'mock' as const,
        };
      }),
      async *generateStream() {
        yield 'UNUSED';
      },
    };
    setAIProviderForTesting(mockProvider);

    const req = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({
        threadId: thread.id,
        message: 'adiciona link inválido e compra sem pagamento',
      }),
    });

    const res = await chatStreamPost(req);
    expect(res.status).toBe(200);
    const events = await readSseEvents(res);
    const done = events.find((e) => e.type === 'done')!;

    expect(done.toolCalls).toHaveLength(0);
    expect(done.assistantMessage.content).toContain('URL INVÁLIDA');
    expect(done.assistantMessage.content).toContain('DATA INVÁLIDA');
    expect((await academic.getProjectDetails(project.id))?.links).toHaveLength(0);
    expect((await shopping.listItemsBySection()).inTransit).toHaveLength(0);
  });
});
