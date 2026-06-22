# Fase 3 — UI/UX Refinamento Visual

**Data:** 2026-06-22  
**Status:** Aprovado  
**Escopo:** `apps/web` — refinamento visual completo, sem mudanças de backend

---

## 1. Direção Visual

**Personalidade:** Amigável/leve — cantos arredondados, cores suaves, sensação de app pessoal e acolhedor.  
**Animações:** Expressivas — entradas de cards, micro-interações em checkboxes, feedback em create/delete.  
**Dark mode:** Segue `prefers-color-scheme` por padrão; toggle manual persiste em `localStorage`.

---

## 2. Tokens de Design

### 2.1 Paleta de Cores

| Token | Hex | Uso |
|-------|-----|-----|
| `violet-brand` | `#7C6FCD` | Primary — botões, nav ativo, brand |
| `violet-light` | `#EEE9FF` | Hover, active nav bg, tints |
| `peach` | `#F4845F` | Pendente, atenção, badge |
| `peach-light` | `#FEF0EB` | Background tint quente |
| `surface` | `#FAFAFA` | Background geral (light mode) |
| `ink` | `#1E1B2E` | Texto principal (preto com toque violeta) |

**Dark mode base:** `#16131F` (violeta-escuro, não cinza neutro puro).  
Cards dark: `#201C2E`. Bordas dark: `#2E2840`.

O `brand.*` atual no `tailwind.config.js` (indigo) será substituído por essa paleta violeta.

### 2.2 Tipografia

| Papel | Família | Peso | Uso |
|-------|---------|------|-----|
| Display | Plus Jakarta Sans | 700, 800 | Logo, headings, títulos de card |
| Body | Inter | 400, 500 | Corpo, labels, inputs |

Carregadas via `@fontsource` (pacote npm) para evitar dependência de rede em produção.

---

## 3. Layout

- **Cards:** `rounded-2xl`, `shadow-sm` padrão → `shadow-md` + `translate-y-[-2px]` no hover
- **Nav items:** `rounded-xl`, estado ativo com gradiente `violet-light → transparent` (esquerda para direita)
- **Sidebar desktop:** 260px, borda-direita suave
- **Drawer mobile:** `rounded-r-2xl`, overlay escuro ao abrir
- **Dark mode toggle:** ícone sol/lua no rodapé da sidebar (desktop) e no header mobile

---

## 4. Sistema de Animações

### 4.1 Entradas de lista (cards)
- `opacity: 0 → 1` + `translateY: 8px → 0`
- Duração: 250ms, easing: `ease-out`
- Stagger: 50ms por item (máx. 8 items animados; o restante aparece direto)
- Implementação: CSS `@keyframes` + variável CSS `--delay` por index

### 4.2 Criar item
- Pop-in: `scale: 0.95 → 1` + `opacity: 0 → 1`
- Duração: 200ms, easing: `ease-out`

### 4.3 Deletar item
- Slide-out: `translateX: 0 → 40px` + `opacity: 1 → 0`
- Duração: 200ms, easing: `ease-in`
- Item é removido do DOM após a animação (`onAnimationEnd`)

### 4.4 Troca de página
- Fade: `opacity: 0 → 1`
- Duração: 150ms via React Router `location.key`

### 4.5 Dark mode toggle
- `transition: background-color 200ms, color 200ms` no `html`
- Classe `dark` adicionada/removida no `document.documentElement`

### 4.6 Reduced motion
- Todas as animações respeitam `prefers-reduced-motion: reduce` via `@media`

---

## 5. Elemento Signature — Checkbox Spring-Bounce

Ao completar uma tarefa:

1. Checkbox escala `1 → 1.3 → 0.95 → 1` em 300ms (spring easing via `cubic-bezier(0.34, 1.56, 0.64, 1)`)
2. Fundo muda para `violet-brand`, borda desaparece
3. Checkmark SVG se "desenha" via `stroke-dashoffset: 20 → 0` em 200ms
4. Texto da tarefa ganha `text-decoration: line-through` com transição de largura (`clip-path` wipe esquerda→direita, 300ms)

Ao desmarcar: animação reversa (sem bounce, transição linear simples).

---

## 6. Toast Notifications

**Posição:** bottom-right desktop / bottom-center mobile  
**Entrada:** slide de baixo (`translateY: 100% → 0`) + fade  
**Saída:** fade out (`opacity: 1 → 0`)  
**Auto-dismiss:** 4 segundos; pausado quando mouse hover ou foco

| Tipo | Cor | Ícone |
|------|-----|-------|
| Sucesso | `violet-brand` | CheckCircle (Lucide) |
| Erro | `#EF4444` | XCircle (Lucide) |
| Atenção | `peach` | AlertCircle (Lucide) |

**Implementação:** contexto React (`ToastContext`) + `useToast()` hook. Sem biblioteca externa.

---

## 7. Ícones

Substituir todos os SVGs inline por **Lucide React** (`lucide-react`).

Mapeamento:
| Atual (inline) | Lucide |
|----------------|--------|
| `HouseIcon` | `LayoutDashboard` |
| `NoteIcon` | `FileText` |
| `TaskIcon` | `CheckSquare` |
| `MenuIcon` | `Menu` |
| `XIcon` | `X` |
| `LogoutIcon` | `LogOut` |

---

## 8. Dark Mode — Implementação

1. Checar `localStorage.getItem('theme')` no carregamento
2. Se não existir, checar `window.matchMedia('prefers-color-scheme: dark')`
3. Aplicar classe `dark` no `document.documentElement`
4. `ThemeProvider` React mantém estado e persiste em `localStorage`
5. Toggle button alterna entre `'light'`, `'dark'` e `'system'`

---

## 9. Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `apps/web/tailwind.config.js` | Substituir paleta `brand` por violeta; adicionar `darkMode: 'class'` |
| `apps/web/src/styles/globals.css` | Importar fontes, variáveis CSS de animação |
| `apps/web/src/components/layout/Layout.tsx` | Dark mode toggle, ícones Lucide |
| `apps/web/src/routes/dashboard.tsx` | Animações de entrada, nova paleta |
| `apps/web/src/routes/notes.tsx` | Animações create/delete, nova paleta |
| `apps/web/src/routes/tasks.tsx` | Checkbox spring-bounce, animações, nova paleta |
| `apps/web/src/components/ui/Toast.tsx` | Novo componente (criar) |
| `apps/web/src/contexts/ThemeContext.tsx` | Novo contexto (criar) |
| `apps/web/src/App.tsx` | Envolver com `ThemeProvider` e `ToastProvider` |
| `apps/web/package.json` | Adicionar `lucide-react`, `@fontsource/inter`, `@fontsource/plus-jakarta-sans` |

---

## 10. Fora de Escopo

- Mudanças de backend ou API
- Drag-and-drop (Fase 2 opcional)
- Busca/filtros (Fase 4)
- PWA / service worker
