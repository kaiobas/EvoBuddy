# Design: Tour de Onboarding + Tela de Configurações

**Data:** 2026-06-23  
**Status:** Aprovado

---

## Visão Geral

Duas funcionalidades interdependentes:

1. **Tour de onboarding** — tour interativo com `driver.js` que aparece automaticamente no primeiro login e pode ser revisitado pelas configurações
2. **Tela de Configurações** — rota `/settings` completa com perfil, aparência, notificações, tour e gerenciamento de conta

---

## 1. Tour de Onboarding

### Biblioteca

`driver.js` v1.x — ~5kb, sem dependências, customizável via CSS.

### Gatilho

- **Automático:** ao montar o `Layout`, verificar `localStorage.getItem('evobuddy_tour_done')`. Se ausente, iniciar o tour após 500ms (aguarda render da UI).
- **Manual:** botão "Refazer tour" na tela de Configurações → reseta a key e inicia o tour.

### Passos (8 steps)

| # | Elemento alvo (seletor) | Título | Descrição |
|---|------------------------|--------|-----------|
| 1 | `[data-tour="logo"]` | Bem-vindo ao EvoBuddy | Seu assistente de produtividade pessoal. Vamos te mostrar o que está disponível. |
| 2 | `[data-tour="nav-dashboard"]` | Dashboard | Veja um resumo de tudo: tarefas pendentes, eventos do dia e saldo financeiro. |
| 3 | `[data-tour="nav-notes"]` | Notas | Crie e organize anotações rápidas com suporte a Markdown. |
| 4 | `[data-tour="nav-tasks"]` | Tarefas | Gerencie suas tarefas com prioridade e data de vencimento. |
| 5 | `[data-tour="nav-calendar"]` | Calendário | Visualize e crie eventos nas visões mês, semana ou dia. |
| 6 | `[data-tour="nav-finance"]` | Finanças | Controle receitas, despesas, contas bancárias e metas financeiras. |
| 7 | `[data-tour="theme-toggle"]` | Tema | Alterne entre tema claro, escuro ou automático (segue o sistema). |
| 8 | `[data-tour="nav-settings"]` | Configurações | Acesse perfil, preferências e este tour a qualquer momento. |

### Estado

- Key: `evobuddy_tour_done` em `localStorage`
- Ao finalizar ou pular: setar `'true'`
- Ao clicar "Refazer tour": remover a key e iniciar imediatamente

### Customização Visual

Override de CSS para alinhar ao design system:
- Cor de highlight: `#7C6FCD` (brand-500)
- Border-radius das popups: `16px` (rounded-2xl)
- Fonte: Inter (herda do body)
- Botão "Próximo": estilo `bg-brand-500 text-white`
- Botão "Pular": estilo `text-neutral-500`

### Arquivo

`apps/web/src/lib/tour.ts` — configura e exporta a instância do driver.js com os steps e CSS overrides.

`apps/web/src/hooks/useTour.ts` — hook que expõe `startTour()` e `resetTour()`.

---

## 2. Tela de Configurações

### Rota

`/settings` — nova rota adicionada em `App.tsx` dentro do bloco `AuthGuard > Layout`.

### Arquivo

`apps/web/src/routes/settings.tsx`

### Navegação

Ícone `Settings` (lucide-react) adicionado no rodapé da sidebar (desktop e drawer mobile), **acima** do bloco de usuário/tema/logout, em `Layout.tsx`.

### Layout

Página com header "Configurações" e seções em cards `rounded-2xl border bg-white dark:bg-card-dark shadow-sm`, espaçadas por `space-y-6`, padding padrão `p-6`.

### Seções

#### 1. Perfil

- Avatar circular com inicial do email (mesmo estilo do sidebar)
- Campo **Nome de exibição**: input editável, salva em `profiles.display_name` no Supabase
- Campo **Email**: somente leitura
- Botão "Salvar alterações": chama `supabase.from('profiles').upsert()`

> **Nota:** tabela `profiles` pode precisar ser criada no Supabase se não existir ainda (`id uuid references auth.users, display_name text`).

#### 2. Aparência

- Três botões exclusivos: `Claro` / `Escuro` / `Sistema`
- Substitui visualmente o comportamento do `cycleTheme` atual (mantém a mesma lógica, só muda para seleção explícita)
- Usa `useTheme()` do `ThemeContext`

#### 3. Notificações

- Toggle "Lembretes de tarefas" — **desabilitado**, badge "Em breve"
- Toggle "Alertas de metas" — **desabilitado**, badge "Em breve"
- Seção marcada com nota visual "Funcionalidade em desenvolvimento"

#### 4. Tour & Ajuda

- Botão "Refazer tour de introdução" → chama `resetTour()` do `useTour`
- Descrição: "Revisita o tutorial guiado do EvoBuddy"

#### 5. Conta

- **Alterar senha:** botão → chama `supabase.auth.resetPasswordForEmail(user.email)` → toast "Email de redefinição enviado"
- **Excluir conta:** botão vermelho → abre `DeleteAccountModal`
  - Modal com texto de aviso e input de confirmação (usuário digita `"excluir"`)
  - Botão de confirmação habilitado apenas quando input === `"excluir"`
  - Chama `supabase.auth.admin.deleteUser()` via API backend (não diretamente no cliente por segurança)
  - Após deleção: `signOut()` e redireciona para `/login`

---

## 3. Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `apps/web/src/App.tsx` | Adicionar rota `/settings` |
| `apps/web/src/components/layout/Layout.tsx` | Adicionar `data-tour` attrs, link para `/settings`, ícone Settings no rodapé |
| `apps/web/src/lib/tour.ts` | Novo — configuração driver.js |
| `apps/web/src/hooks/useTour.ts` | Novo — hook useTour |
| `apps/web/src/routes/settings.tsx` | Novo — página de configurações |
| `packages/api/src/routes/` | Novo endpoint `DELETE /users/me` para deleção de conta |
| `apps/web/src/components/features/settings/DeleteAccountModal.tsx` | Novo — modal de confirmação de exclusão |

---

## 4. Fora de Escopo

- Upload de foto de perfil (campo desabilitado, "Em breve")
- Notificações push (seção visual only, "Em breve")
- Internacionalização / troca de idioma
- OAuth unlinking (desvincular Google/GitHub)
