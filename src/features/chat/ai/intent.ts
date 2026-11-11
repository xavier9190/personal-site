import { toRecifeDateString } from '@/lib/dates';
import { parseBRLToCents } from '@/lib/currency';
import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import { CalendarService } from '@/features/calendar/service';
import { FinancesService } from '@/features/finances/service';
import { AcademicService } from '@/features/academic/service';
import { ShoppingService } from '@/features/shopping/service';

export interface ChatAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
  textContent?: string;
}

export interface DetectedToolIntent {
  toolName: string;
  args: Record<string, unknown>;
  confidence: number;
  explanation: string;
}

export function detectToolIntent(
  userPrompt: string,
  attachments: ChatAttachment[] = [],
  db: AppDatabase = getDb(),
): DetectedToolIntent | null {
  const text = userPrompt.trim().toLowerCase();
  const todayRecife = toRecifeDateString();

  const calendar = new CalendarService(db);
  const finances = new FinancesService(db);
  const academic = new AcademicService(db);
  const shopping = new ShoppingService(db);

  // -------------------------------------------------------------
  // 1. ATTACHMENT EXTRACTION
  // -------------------------------------------------------------
  if (attachments.length > 0) {
    for (const att of attachments) {
      const lowerName = att.name.toLowerCase();

      // CSV processing (Extrato bancário / transações)
      if (att.type.includes('csv') || lowerName.endsWith('.csv') || att.textContent?.includes(',')) {
        if (att.textContent) {
          const lines = att.textContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
          for (const line of lines) {
            // Ignore headers
            if (line.toLowerCase().includes('data') || line.toLowerCase().includes('valor')) continue;
            const parts = line.split(/[,;]/);
            if (parts.length >= 2) {
              const desc = parts[1]?.trim() || parts[0]?.trim();
              const valStr = parts[2]?.trim() || parts[1]?.trim();
              const amountCents = parseBRLToCents(valStr);
              if (amountCents > 0) {
                return {
                  toolName: 'createTransaction',
                  args: {
                    type: line.toLowerCase().includes('rec') ? 'INCOME' : 'EXPENSE',
                    description: desc.toUpperCase(),
                    category: 'OUTROS',
                    amountCents,
                    occurredAt: todayRecife,
                  },
                  confidence: 0.95,
                  explanation: `EXTRAÇÃO DE CSV: TRANSAÇÃO "${desc.toUpperCase()}"`,
                };
              }
            }
          }
        }
      }

      // Receipt / Comprovante (Pix / Boleto / Nota)
      if (
        lowerName.includes('comprovante') ||
        lowerName.includes('recibo') ||
        lowerName.includes('pix') ||
        lowerName.includes('nota') ||
        text.includes('comprovante') ||
        text.includes('nota')
      ) {
        // Try extracting amount from prompt if mentioned, e.g. "lança esse comprovante de 50 reais"
        const moneyMatch = text.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:reais|rs|r\$)/i) ||
          text.match(/r\$\s*(\d+(?:[.,]\d{1,2})?)/i);
        const amountCents = moneyMatch ? parseBRLToCents(moneyMatch[1]) : 5000;
        const descMatch = text.match(/(?:de|em)\s+([a-zA-Zá-úÁ-Ú0-9\s]+)/i);
        const desc = descMatch ? descMatch[1].trim() : 'COMPROVANTE ANEXO';

        return {
          toolName: 'createTransaction',
          args: {
            type: 'EXPENSE',
            description: desc.toUpperCase(),
            category: 'OUTROS',
            amountCents,
            occurredAt: todayRecife,
          },
          confidence: 0.9,
          explanation: `EXTRAÇÃO DE COMPROVANTE: ${desc.toUpperCase()} (R$ ${(amountCents / 100).toFixed(2)})`,
        };
      }

      // PDF (Cronograma / Projeto Acadêmico)
      if (
        att.type.includes('pdf') ||
        lowerName.endsWith('.pdf') ||
        text.includes('pdf') ||
        text.includes('cronograma')
      ) {
        if (text.includes('projeto') || text.includes('disciplina') || lowerName.includes('cronograma')) {
          const projName = lowerName.replace(/\.pdf$/i, '').replace(/[-_]/g, ' ').toUpperCase();
          return {
            toolName: 'createProject',
            args: {
              title: projName || 'NOVO PROJETO (VIA PDF)',
              description: `CRIADO A PARTIR DO ANEXO ${att.name}`,
              finalDeliveryDate: todayRecife,
            },
            confidence: 0.9,
            explanation: `EXTRAÇÃO DE PDF: NOVO PROJETO ACADÊMICO A PARTIR DE ${att.name}`,
          };
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 2. DELETION INTENTS (GUARDRAIL - REQUIRES CONFIRMATION)
  // -------------------------------------------------------------
  const isDeleteIntent =
    text.includes('apaga') ||
    text.includes('apagar') ||
    text.includes('deleta') ||
    text.includes('deletar') ||
    text.includes('exclui') ||
    text.includes('excluir') ||
    text.includes('remover');

  if (isDeleteIntent) {
    // Academic Project Delete
    if (text.includes('projeto') || text.includes('trabalho')) {
      const allProjects = academic.listProjectsByStatus();
      const list = [...allProjects.inProgress, ...allProjects.completed];
      // Search matching by title
      const found = list.find((p) => text.includes(p.title.toLowerCase())) || list[0];
      if (found) {
        return {
          toolName: 'deleteProject',
          args: { id: found.id },
          confidence: 0.95,
          explanation: `PEDIDO DE EXCLUSÃO DE PROJETO: ${found.title}`,
        };
      }
    }

    // Milestone Delete
    if (text.includes('marco')) {
      const allProjects = academic.listProjectsByStatus();
      for (const p of [...allProjects.inProgress, ...allProjects.completed]) {
        for (const m of p.milestones) {
          if (text.includes(m.title.toLowerCase()) || text.includes(m.id)) {
            return {
              toolName: 'deleteMilestone',
              args: { id: m.id },
              confidence: 0.95,
              explanation: `PEDIDO DE EXCLUSÃO DE MARCO: ${m.title}`,
            };
          }
        }
      }
    }

    // Calendar Event Delete
    if (text.includes('evento') || text.includes('agenda') || text.includes('reunião') || text.includes('reuniao')) {
      const events = calendar.listEvents();
      const found = events.find((e) => text.includes(e.title.toLowerCase())) || events[0];
      if (found) {
        return {
          toolName: 'deleteCalendarEvent',
          args: { id: found.id },
          confidence: 0.95,
          explanation: `PEDIDO DE EXCLUSÃO DE EVENTO: ${found.title}`,
        };
      }
    }

    // Transaction Delete
    if (text.includes('transação') || text.includes('transacao') || text.includes('gasto') || text.includes('almoço') || text.includes('uber')) {
      const txs = finances.listTransactions();
      const found = txs.find((t) => text.includes(t.description.toLowerCase())) || txs[0];
      if (found) {
        return {
          toolName: 'deleteTransaction',
          args: { id: found.id },
          confidence: 0.95,
          explanation: `PEDIDO DE EXCLUSÃO DE TRANSAÇÃO: ${found.description}`,
        };
      }
    }

    // Payable Bill Delete
    if (text.includes('conta')) {
      const bills = finances.listPayableBills();
      const found = bills.find((b) => text.includes(b.title.toLowerCase())) || bills[0];
      if (found) {
        return {
          toolName: 'deletePayableBill',
          args: { id: found.id },
          confidence: 0.95,
          explanation: `PEDIDO DE EXCLUSÃO DE CONTA: ${found.title}`,
        };
      }
    }

    // Installment Plan Delete
    if (text.includes('parcelamento') || text.includes('parcela')) {
      const plans = finances.listInstallmentPlans();
      const found = plans.find((p) => text.includes(p.description.toLowerCase())) || plans[0];
      if (found) {
        return {
          toolName: 'deleteInstallmentPlan',
          args: { id: found.id },
          confidence: 0.95,
          explanation: `PEDIDO DE EXCLUSÃO DE PARCELAMENTO: ${found.description}`,
        };
      }
    }

    // Shopping Item Delete
    if (text.includes('item') || text.includes('wishlist') || text.includes('compras') || text.includes('teclado') || text.includes('monitor')) {
      const items = shopping.listItemsBySection();
      const all = [...items.wishlist, ...items.inTransit, ...items.delivered];
      const found = all.find((i) => text.includes(i.name.toLowerCase())) || all[0];
      if (found) {
        return {
          toolName: 'deleteWishlistItem',
          args: { id: found.id },
          confidence: 0.95,
          explanation: `PEDIDO DE EXCLUSÃO DE ITEM: ${found.name}`,
        };
      }
    }
  }

  // -------------------------------------------------------------
  // 3. MUTATION INTENTS (CALENDAR)
  // -------------------------------------------------------------
  if (
    text.includes('marca reunião') ||
    text.includes('marcar reunião') ||
    text.includes('marca reuniao') ||
    text.includes('agendar') ||
    text.includes('marca evento') ||
    text.includes('novo evento') ||
    (text.includes('reunião') && (text.includes('amanhã') || text.includes('às') || text.includes('as ')))
  ) {
    const timeMatch = text.match(/(\d{1,2})h(?:(\d{2}))?/) || text.match(/(\d{1,2}):(\d{2})/);
    const hour = timeMatch ? timeMatch[1].padStart(2, '0') : '10';
    const min = timeMatch && timeMatch[2] ? timeMatch[2].padStart(2, '0') : '00';
    const startTime = `${hour}:${min}`;
    const endHour = String(Math.min(23, Number(hour) + 1)).padStart(2, '0');
    const endTime = `${endHour}:${min}`;

    let date = todayRecife;
    if (text.includes('amanhã') || text.includes('amanha')) {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      date = toRecifeDateString(tomorrow);
    }

    const title = text.includes('reunião') || text.includes('reuniao') ? 'REUNIÃO' : 'COMPROMISSO';

    return {
      toolName: 'createCalendarEvent',
      args: {
        title,
        date,
        startTime,
        endTime,
        allDay: false,
        color: '#b2f2bb',
      },
      confidence: 0.9,
      explanation: `CRIAÇÃO DE EVENTO NO CALENDÁRIO: ${title} (${date} às ${startTime})`,
    };
  }

  // -------------------------------------------------------------
  // 4. MUTATION INTENTS (FINANCES)
  // -------------------------------------------------------------
  // Transaction: Gastei / Recebi / Lançar transação
  if (
    text.includes('gastei') ||
    text.includes('gasto') ||
    text.includes('paguei') ||
    text.includes('comprei almoço') ||
    text.includes('uber') ||
    text.includes('lançar despesa') ||
    text.includes('recebi') ||
    text.includes('salário') ||
    text.includes('salario')
  ) {
    const isIncome = text.includes('recebi') || text.includes('salário') || text.includes('salario');
    const moneyMatch = text.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:reais|rs|r\$)/i) ||
      text.match(/r\$\s*(\d+(?:[.,]\d{1,2})?)/i) ||
      text.match(/(?:de|gastei|recebi|paguei)\s+(\d+(?:[.,]\d{1,2})?)/i);
    const amountCents = moneyMatch ? parseBRLToCents(moneyMatch[1]) : 4500;

    let desc = isIncome ? 'RECEITA' : 'DESPESA';
    if (text.includes('uber')) desc = 'UBER';
    else if (text.includes('almoço') || text.includes('almoco')) desc = 'ALMOÇO';
    else if (text.includes('mercado')) desc = 'MERCADO';
    else if (text.includes('lanche')) desc = 'LANCHE';
    else if (text.includes('salário') || text.includes('salario')) desc = 'SALÁRIO';

    return {
      toolName: 'createTransaction',
      args: {
        type: isIncome ? 'INCOME' : 'EXPENSE',
        description: desc,
        category: isIncome ? 'SALÁRIO' : (text.includes('uber') ? 'TRANSPORTE' : 'ALIMENTAÇÃO'),
        amountCents,
        occurredAt: todayRecife,
        status: 'PAID',
      },
      confidence: 0.9,
      explanation: `CRIAÇÃO DE TRANSAÇÃO: ${desc} (R$ ${(amountCents / 100).toFixed(2)})`,
    };
  }

  // Payable bill: Conta de luz / aluguel / internet
  if (
    (text.includes('conta') || text.includes('boleto')) &&
    (text.includes('vencendo') || text.includes('fixa') || text.includes('cadastrar conta') || text.includes('cria conta'))
  ) {
    const moneyMatch = text.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:reais|rs|r\$)/i) ||
      text.match(/r\$\s*(\d+(?:[.,]\d{1,2})?)/i) ||
      text.match(/de\s+(\d+(?:[.,]\d{1,2})?)/i);
    const amountCents = moneyMatch ? parseBRLToCents(moneyMatch[1]) : 10000;

    let title = 'CONTA';
    if (text.includes('luz') || text.includes('energia')) title = 'CONTA DE LUZ';
    else if (text.includes('internet') || text.includes('wifi')) title = 'INTERNET';
    else if (text.includes('aluguel')) title = 'ALUGUEL';

    return {
      toolName: 'createPayableBill',
      args: {
        title,
        billType: 'FIXED',
        category: 'MORADIA',
        amountCents,
        dueDate: todayRecife,
      },
      confidence: 0.9,
      explanation: `CADASTRO DE CONTA A PAGAR: ${title} (R$ ${(amountCents / 100).toFixed(2)})`,
    };
  }

  // Toggle bill status: marcar como paga
  if (
    (text.includes('marca') || text.includes('marcar') || text.includes('pagar') || text.includes('paga')) &&
    text.includes('conta')
  ) {
    const bills = finances.listPayableBills();
    const found = bills.find((b) => text.includes(b.title.toLowerCase())) || bills[0];
    if (found) {
      return {
        toolName: 'togglePayableBillStatus',
        args: { id: found.id, paid: true },
        confidence: 0.9,
        explanation: `MARCAR CONTA COMO PAGA: ${found.title}`,
      };
    }
  }

  // Installment plan
  if (text.includes('parcelamento') || text.includes('parcela') || text.includes('parcelas')) {
    const partsMatch = text.match(/(\d+)x\s*(?:de\s*)?(\d+(?:[.,]\d{1,2})?)/i);
    const totalInstallments = partsMatch ? Number(partsMatch[1]) : 4;
    const amountCents = partsMatch ? parseBRLToCents(partsMatch[2]) : 15000;
    const descMatch = text.match(/(?:do|da|de)\s+([a-zA-Zá-úÁ-Ú0-9\s]+?)(?:\s+\d+x|$)/i);
    const description = descMatch ? descMatch[1].trim().toUpperCase() : 'COMPRA PARCELADA';

    return {
      toolName: 'createInstallmentPlan',
      args: {
        description,
        category: 'OUTROS',
        totalInstallments,
        paidInstallments: 0,
        installmentAmountCents: amountCents,
        startMonth: todayRecife.slice(0, 7),
      },
      confidence: 0.9,
      explanation: `CRIAÇÃO DE PARCELAMENTO: ${description} (${totalInstallments}X DE R$ ${(amountCents / 100).toFixed(2)})`,
    };
  }

  // -------------------------------------------------------------
  // 5. MUTATION INTENTS (ACADEMIC)
  // -------------------------------------------------------------
  // Complete / Reopen Project
  if (text.includes('concluir projeto') || text.includes('finalizar projeto')) {
    const projects = academic.listProjectsByStatus().inProgress;
    const found = projects.find((p) => text.includes(p.title.toLowerCase())) || projects[0];
    if (found) {
      return {
        toolName: 'completeProject',
        args: { id: found.id },
        confidence: 0.95,
        explanation: `CONCLUIR PROJETO: ${found.title}`,
      };
    }
  }

  if (text.includes('reabrir projeto')) {
    const projects = academic.listProjectsByStatus().completed;
    const found = projects.find((p) => text.includes(p.title.toLowerCase())) || projects[0];
    if (found) {
      return {
        toolName: 'reopenProject',
        args: { id: found.id },
        confidence: 0.95,
        explanation: `REABRIR PROJETO: ${found.title}`,
      };
    }
  }

  // Add Milestone
  if (text.includes('adicionar marco') || text.includes('adiciona marco') || text.includes('novo marco')) {
    const projects = academic.listProjectsByStatus().inProgress;
    const found = projects.find((p) => text.includes(p.title.toLowerCase())) || projects[0];
    if (found) {
      const titleMatch = text.match(/marco\s+([a-zA-Zá-úÁ-Ú0-9\s]+?)(?:\s+dia|$)/i);
      const title = titleMatch ? titleMatch[1].trim().toUpperCase() : 'MARCO IMPORTANTE';
      return {
        toolName: 'addMilestone',
        args: {
          projectId: found.id,
          title,
          dueDate: todayRecife,
        },
        confidence: 0.9,
        explanation: `ADICIONAR MARCO AO PROJETO ${found.title}: ${title}`,
      };
    }
  }

  // Toggle Milestone [OK]
  if (
    (text.includes('marca') || text.includes('marcar')) &&
    text.includes('marco') &&
    (text.includes('ok') || text.includes('concluído') || text.includes('concluido'))
  ) {
    const projects = academic.listProjectsByStatus();
    for (const p of [...projects.inProgress, ...projects.completed]) {
      for (const m of p.milestones) {
        if (text.includes(m.title.toLowerCase()) || text.includes('1') || text.includes(m.id)) {
          return {
            toolName: 'toggleMilestone',
            args: { id: m.id },
            confidence: 0.95,
            explanation: `MARCAR MARCO ${m.title} COMO [OK]`,
          };
        }
      }
    }
  }

  // Create Project
  if (
    text.includes('cria projeto') ||
    text.includes('criar projeto') ||
    text.includes('novo projeto') ||
    text.includes('projeto acadêmico') ||
    text.includes('projeto academico')
  ) {
    const match = text.match(/(?:projeto|trabalho)(?:\s+acadêmico|\s+academico)?\s+([a-zA-Zá-úÁ-Ú0-9\s]+)/i);
    const title = match ? match[1].trim().toUpperCase() : 'NOVO PROJETO';
    return {
      toolName: 'createProject',
      args: {
        title,
        description: 'PROJETO CRIADO PELO ASSISTENTE',
        finalDeliveryDate: todayRecife,
      },
      confidence: 0.9,
      explanation: `CRIAÇÃO DE PROJETO ACADÊMICO: ${title}`,
    };
  }

  // -------------------------------------------------------------
  // 6. MUTATION INTENTS (SHOPPING)
  // -------------------------------------------------------------
  // Wishlist item
  if (
    text.includes('wishlist') ||
    text.includes('quero comprar') ||
    (text.includes('adiciona') && (text.includes('teclado') || text.includes('monitor') || text.includes('fone')))
  ) {
    const moneyMatch = text.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:reais|rs|r\$)/i) ||
      text.match(/r\$\s*(\d+(?:[.,]\d{1,2})?)/i) ||
      text.match(/de\s+(\d+(?:[.,]\d{1,2})?)/i);
    const priceCents = moneyMatch ? parseBRLToCents(moneyMatch[1]) : 30000;

    let name = 'PRODUTO WISHLIST';
    if (text.includes('teclado')) name = 'TECLADO MECÂNICO';
    else if (text.includes('monitor')) name = 'MONITOR 144HZ';
    else if (text.includes('fone')) name = 'FONE BLUETOOTH';

    return {
      toolName: 'addWishlistItem',
      args: {
        name,
        priceCents,
      },
      confidence: 0.9,
      explanation: `ADICIONAR À WISHLIST: ${name} (R$ ${(priceCents / 100).toFixed(2)})`,
    };
  }

  // Mark Purchased
  if (text.includes('comprei') && (text.includes('mercado livre') || text.includes('shopee') || text.includes('aliexpress') || text.includes('entrega'))) {
    const items = shopping.listItemsBySection().wishlist;
    const found = items.find((i) => text.includes(i.name.toLowerCase())) || items[0];
    if (found) {
      let store = 'MERCADO LIVRE';
      if (text.includes('shopee')) store = 'SHOPEE';
      else if (text.includes('aliexpress')) store = 'ALIEXPRESS';
      else if (text.includes('amazon')) store = 'AMAZON';

      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const estDate = toRecifeDateString(futureDate);

      return {
        toolName: 'markPurchased',
        args: {
          id: found.id,
          storeApp: store,
          estimatedDeliveryDate: estDate,
          alreadyLoggedInFinances: true,
        },
        confidence: 0.9,
        explanation: `COMPRA DE ITEM DA WISHLIST: ${found.name} (${store})`,
      };
    }
  }

  // Mark Delivered (Chegou!)
  if (text.includes('chegou') || text.includes('entregue') || text.includes('recebi a encomenda')) {
    const inTransit = shopping.listItemsBySection().inTransit;
    const found = inTransit.find((i) => text.includes(i.name.toLowerCase())) || inTransit[0];
    if (found) {
      return {
        toolName: 'markDelivered',
        args: { id: found.id, deliveredAt: todayRecife },
        confidence: 0.95,
        explanation: `CONFIRMAR ENTREGA: ${found.name}`,
      };
    }
  }

  // Revert Delivered
  if (text.includes('reverter entrega') || text.includes('não chegou')) {
    const delivered = shopping.listItemsBySection().delivered;
    const found = delivered.find((i) => text.includes(i.name.toLowerCase())) || delivered[0];
    if (found) {
      return {
        toolName: 'revertDelivered',
        args: { id: found.id },
        confidence: 0.95,
        explanation: `REVERTER ENTREGA: ${found.name}`,
      };
    }
  }

  return null;
}
