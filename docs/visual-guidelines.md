# Diretrizes Visuais — IPTU Extractor (MAR-27)

## Direção da identidade

A interface passa a usar uma linguagem de **eficiência institucional**:

- Base clara e quente para reduzir fadiga visual em uso prolongado.
- Verde petróleo como cor primária de ação e confiança.
- Âmbar para ação secundária de saída/exportação.
- Estados semânticos explícitos para sucesso, erro e progresso.

## Paleta oficial

### Neutros

- `--bg`: `#f6f4ef`
- `--surface`: `#fffdf8`
- `--surface-strong`: `#f2eee5`
- `--surface-alt`: `#ebe4d6`
- `--border`: `#d2c8b5`
- `--text`: `#1f2933`
- `--text-soft`: `#5f6b76`

### Primárias e destaque

- `--accent`: `#0f766e`
- `--accent-strong`: `#115e59`
- `--accent-soft`: `#d9f2ee`
- `--highlight`: `#b45309`

### Estados

- `--success`: `#2f855a`
- `--success-soft`: `#e7f6ec`
- `--error`: `#c53030`
- `--error-soft`: `#fdecec`
- `--info`: `#0f766e`
- `--info-soft`: `#e4f3f2`

## Regras de aplicação

- Botão primário (`.btn-primary`): usar `--accent` e hover `--accent-strong`.
- Botão exportar (`.btn-export`): usar `--highlight`.
- Mensagens de status (`.api-status-*`): sempre em par forte/soft do estado correspondente.
- Tabela: cabeçalho em `--surface-strong`, hover de linha com `--accent` translúcido.
- Indicadores numéricos: `Total` em `--accent`, `Extraídos` em `--success`, `Erros` em `--error`.

## Tipografia

- Primária: `Plus Jakarta Sans`.
- Técnica/dados: `IBM Plex Mono`.
- Legendas e rótulos devem manter caixa alta e tracking (já aplicado em `card-title`, `stat-l`, `thead th`).

## Acessibilidade

- Não usar texto com `--text-soft` abaixo de 11px em superfícies de baixo contraste.
- Mensagens críticas não devem depender só de cor; manter ícone/rotulagem textual (ex.: "ERRO").
- Em futuros componentes interativos, preservar foco visível com `box-shadow` semântico (base `rgba(15, 118, 110, 0.16)`).

## Escopo implementado nesta entrega

- Tokenização e aplicação da nova paleta em `app/globals.css`.
- Remoção de cores inline em componentes de estatística e consumo de tokens.
- Harmonização de hero, cards, botões, tabela, sidebar e estados de feedback.
