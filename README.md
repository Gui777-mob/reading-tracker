# Reading Tracker – Entrega 1 (Frontend)

Aplicação web que substitui um registro de leituras mantido em um documento Word. Permite gerenciar autores, livros e leituras (incluindo releituras e lista *Want to read*), consultar o histórico e manter os dados no navegador.

> Projeto da disciplina – Prof. Rodrigo Martins Pagliares. Interface e valores controlados em inglês americano; títulos e nomes de autores permanecem no idioma original.

## Equipe

| Nome | ID / Matrícula |
|------|----------------|
| Flávia Marcella Gonçalves Moreira | 2024.1.08.025 |
| Guilherme Oliveira Araujo | 2024.1.08.011 |
| João Pedro Carvalho Ferreira | 2024.1.08.030 |
| Larissa Rodrigues de Ávila | 2024.1.08.031 |

## Tecnologias

HTML5, CSS3, JavaScript puro (módulos ES), Fetch API, JSON e `localStorage`.
Google Fonts (Newsreader e Instrument Sans). Nenhum framework, biblioteca JS, npm ou etapa de build.

## Como executar

O `fetch` não funciona com `file://`; é preciso servir a pasta `frontend/` por HTTP. Esta entrega não usa Java nem backend: basta um navegador e um servidor de arquivos estáticos (o Java 21+ será necessário apenas na Entrega 2).

**Live Server (VS Code)**
1. Instale a extensão *Live Server*.
2. Abra a pasta `reading-tracker/` no VS Code.
3. Clique com o botão direito em `frontend/index.html` → *Open with Live Server*.

**Alternativa sem instalar nada além do Python**
1. Abra um terminal na pasta `reading-tracker/`.
2. Execute:
   ```bash
   cd frontend
   python -m http.server 8000
   ```
3. Acesse `http://localhost:8000`.

No primeiro acesso o app carrega `data/seed.json` e grava os dados no `localStorage`. Nos acessos seguintes lê somente o `localStorage`. *Settings → Reset Data* restaura o seed.

## Como usar o essencial

- **Livro + primeira leitura de uma vez (FR-03):** em *Books → Add Book*, preencha o livro e, no final do formulário, marque *Also add a first reading for this book*. A seção *First Reading* aparece (por padrão com status *Want to read*, para lista de desejos; troque para *Read* para registrar um livro já lido). Um único **Save** cria o livro e a leitura.
- **Mais leituras de um livro já existente:** botão *Add reading* na linha do livro (em *Books*), *Add Reading* ou *Re-read* no *Reading Log*.

## Estrutura

```
reading-tracker/
├── README.md
└── frontend/
    ├── index.html
    ├── css/style.css
    ├── data/seed.json          (arquivo do professor, sem alterações)
    └── js/
        ├── app.js          entrada (type="module"): rotas, estado, ligação entre módulos
        ├── store.js        ÚNICO acesso ao localStorage; funções async; erros no formato da API
        ├── authors.js      regras e consultas de autores
        ├── books.js        regras de livros, temas novos e primeira leitura
        ├── readings.js     regras de leituras, ordenação do Reading Log, estatísticas
        ├── status.js       fluxo de status (FR-04), funções puras
        ├── validation.js   todas as validações (FR-06)
        ├── render.js       telas (Dashboard, Books, Authors, Reading Log, Settings)
        ├── forms.js        formulários em modal
        ├── dialogs.js      confirmações, avisos e toasts
        ├── strings.js      todos os textos da interface (facilita tradução)
        ├── constants.js    valores controlados e configurações
        ├── errors.js       ApiError { status, message, errors:[{field,message}] }
        └── utils.js, dom.js
```

Na Entrega 2 a pasta `frontend/` será copiada para `src/main/resources/static` e o backend Spring Boot será adicionado ao repositório.

## Preparação para a Entrega 2

- Todo acesso a dados passa por `store.js`; todas as funções são `async`.
- Os formatos são os do `seed.json` (`authorIds`, `themeIds`, `countryId`, `bookId`…).
- O `store.js` lança `ApiError` com `status` (400, 404, 409), `message` e `errors: [{ field, message }]`.
- Na Entrega 2 apenas o `store.js` será reescrito para chamar a API REST.

## Decisões e pontos de atenção

- **Seed:** o app usa o `seed.json` exatamente como fornecido (27 países, 101 autores, 135 temas, 143 livros e 143 leituras).
- **Dashboard:** *Books Read*, *Currently Reading*, *Want to Read*, *Paused* e *Abandoned* contam livros distintos por status. A média considera apenas leituras com nota.
- **Ordenação do Reading Log:** valores ausentes ficam sempre por último (nos dois sentidos); o critério secundário é o ID da leitura em ordem crescente.
- **Primeira leitura no formulário de livro:** a seção só aparece ao marcar a caixa *Also add a first reading for this book* e só existe ao criar um livro novo. Se a caixa estiver desmarcada, nenhuma leitura é criada. Todas as validações (livro e leitura) rodam antes de gravar qualquer coisa; se algo falhar, nada é salvo.
- **Edição de livro:** o ano de publicação não pode ser posterior ao ano de uma leitura já registrada (mantém os dados consistentes com a regra "ano da leitura não pode ser anterior à publicação").
- **Temas novos:** criados no formulário do livro, mas só gravados ao salvar o livro; se o salvamento falhar, são desfeitos.
- **Edição de leitura:** o livro da leitura não pode ser trocado.
- **Datas de autores:** a data de falecimento deve ser estritamente posterior à de nascimento.

## Checklist de requisitos

| Requisito | Situação | Observações |
|-----------|----------|-------------|
| **FR-01** Gerenciar autores | Implemented | CRUD, nome único sem diferenciar maiúsculas, país de lista fixa, regras de datas, bloqueio de exclusão com lista dos livros vinculados |
| **FR-02** Gerenciar livros | Implemented | CRUD, autores e temas selecionados de registros existentes, tema novo criado no formulário, apenas o título é obrigatório |
| **FR-03** Gerenciar leituras | Implemented | Adicionar, editar e excluir leituras; seção opcional *First Reading* no formulário do livro (um único Save cria livro e leitura); exclusão de livro remove as leituras após confirmação com a contagem |
| **FR-04** Fluxo de status | Implemented | Ano obrigatório ao mover para *Read*; sair de *Want to read* limpa *Priority* e mantém *Recommended by* e *Notes*; confirmação antes de limpar ano/nota; releitura cria nova leitura |
| **FR-05** Reading Log | Implemented | Ordenável por título, autores, status, ano e nota; "-" para ausentes, que ficam por último; padrão: ano mais recente e depois ID |
| **FR-06** Validação | Implemented | Regras centralizadas em `validation.js`, mensagens junto ao campo, nada inválido é salvo |
| **FR-07** Seed e reset | Implemented | Seed carregado apenas no primeiro acesso, dados persistem após recarregar, *Reset Data* com confirmação |

Requisitos opcionais (FR-08 a FR-18): não implementados nesta entrega.

## Uso de IA


| Ferramenta | Usada para | Partes afetadas |
|------------|-----------|-----------------|
| Claude Code (Anthropic) | Revisão do projeto contra o enunciado da Entrega 1; correção do defeito na seção *First Reading* do formulário de livro (FR-03); revisão do README | `frontend/css/style.css`, `frontend/js/forms.js`, `README.md` |
