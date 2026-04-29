# IPTU Extractor — Trinus

Sistema de tabulação automática de IPTUs em PDF usando Claude AI.

## Pré-requisitos

- **Node.js** v16 ou superior — https://nodejs.org
- Conexão com a internet
- API Key da Anthropic — https://console.anthropic.com

## Como usar

### 1. Instalar dependências (apenas na primeira vez)

Abra o terminal na pasta do projeto e execute:

```
npm install
```

### 2. Iniciar o servidor

```
node server.js
```

Você verá:

```
✅ IPTU Extractor rodando em: http://localhost:3131
```

### 3. Abrir no navegador

Acesse: **http://localhost:3131**

### 4. Usar o sistema

1. Cole sua API Key da Anthropic no campo indicado
2. Clique em **"Testar conexão"** para validar
3. Arraste os PDFs de IPTU ou clique para selecionar
4. Clique em **"Extrair dados"**
5. Aguarde a extração (cada PDF leva ~5–15 segundos)
6. Clique em **"Exportar Excel"** para baixar o resultado

## Campos extraídos

| Campo | Descrição |
|-------|-----------|
| Nome do Documento | Nome do arquivo PDF |
| SPE | Nome da SPE ou empresa proprietária |
| Inscrição Cadastral | Número de inscrição do imóvel |
| Endereço | Endereço completo |
| Validade | Data de vencimento |
| Valor Principal | Valor do IPTU |
| Total a Pagar | Total com juros/correções |
| DUAM | Número do documento de arrecadação |
| Código de Barras | Linha digitável completa |
| Comentário | Campo livre editável na tabela |

## Observações

- A API Key **não é armazenada** em nenhum lugar — é usada apenas durante a sessão
- O servidor roda localmente; os PDFs **não saem da sua máquina** (exceto para a API da Anthropic)
- Para parar o servidor: `Ctrl + C` no terminal

## Fluxo Git por variáveis de ambiente (clone/push)

Foi adicionado um fluxo de Git automatizado e parametrizável via ambiente:

- `npm run git:clone`
- `npm run git:push`

### Variáveis obrigatórias

- `GIT_REPO_URL`: URL do repositório remoto (HTTPS)

### Variáveis opcionais

- `GIT_BRANCH` (padrão: `main`)
- `GIT_CLONE_DIR` (padrão: `.cache/git-target`)
- `GIT_AUTH_TOKEN` (token para clone/push HTTPS autenticado)
- `GIT_AUTH_USER` (padrão: `x-access-token`)
- `GIT_COMMIT_MESSAGE` (padrão: `chore: automated update`)
- `GIT_ALLOW_EMPTY_COMMIT` (`true` ou `false`, padrão: `false`)

### Exemplo

```bash
export GIT_REPO_URL="https://github.com/org/repo.git"
export GIT_BRANCH="main"
export GIT_CLONE_DIR=".cache/git-target"
export GIT_AUTH_TOKEN="***"

npm run git:clone
# ... atualize arquivos dentro de $GIT_CLONE_DIR ...
npm run git:push
```
