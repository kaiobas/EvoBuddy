import { driver } from "driver.js";
import "driver.js/dist/driver.css";

export const TOUR_DONE_KEY = "evobuddy_tour_done";

export function createTour(onDone?: () => void) {
  return driver({
    showProgress: true,
    progressText: "{{current}} de {{total}}",
    nextBtnText: "Próximo →",
    prevBtnText: "← Anterior",
    doneBtnText: "Concluir",
    onDestroyed: () => {
      localStorage.setItem(TOUR_DONE_KEY, "true");
      onDone?.();
    },
    steps: [
      {
        element: "[data-tour='logo']",
        popover: {
          title: "Bem-vindo ao EvoBuddy 👋",
          description: "Seu assistente de produtividade pessoal. Vamos te mostrar o que está disponível.",
          side: "right",
        },
      },
      {
        element: "[data-tour='nav-dashboard']",
        popover: {
          title: "Dashboard",
          description: "Veja um resumo de tudo: tarefas pendentes, eventos do dia e saldo financeiro.",
          side: "right",
        },
      },
      {
        element: "[data-tour='nav-notes']",
        popover: {
          title: "Notas",
          description: "Crie e organize anotações rápidas com suporte a Markdown.",
          side: "right",
        },
      },
      {
        element: "[data-tour='nav-tasks']",
        popover: {
          title: "Tarefas",
          description: "Gerencie suas tarefas com prioridade e data de vencimento.",
          side: "right",
        },
      },
      {
        element: "[data-tour='nav-calendar']",
        popover: {
          title: "Calendário",
          description: "Visualize e crie eventos nas visões mês, semana ou dia.",
          side: "right",
        },
      },
      {
        element: "[data-tour='nav-finance']",
        popover: {
          title: "Finanças",
          description: "Controle receitas, despesas, contas bancárias e metas financeiras.",
          side: "right",
        },
      },
      {
        element: "[data-tour='theme-toggle']",
        popover: {
          title: "Tema",
          description: "Alterne entre tema claro, escuro ou automático (segue o sistema).",
          side: "top",
        },
      },
      {
        element: "[data-tour='nav-settings']",
        popover: {
          title: "Configurações",
          description: "Acesse perfil, preferências e este tour a qualquer momento.",
          side: "right",
        },
      },
    ],
  });
}
