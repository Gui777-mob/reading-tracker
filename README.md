# Reading Tracker – Entrega 1 (Frontend)

Aplicação web que substitui um registro de leituras mantido em um documento Word. Permite gerenciar autores, livros e leituras (incluindo releituras e lista *Want to read*), consultar o histórico e manter os dados no navegador.

> Projeto da disciplina – Prof. Rodrigo Martins Pagliares. Interface e valores controlados em inglês americano; títulos e nomes de autores permanecem no idioma original.

## Equipe

| Nome | ID / Matrícula |
|------|----------------|
| Flávia Marcella Gonçalves Moreira| 2024.1.08.025 |
| Guilherme Oliveira Araujo | 2024.1.08.011|
|João Pedro Carvalho Ferreira | 2024.1.08.030|
|Larissa Rodrigues de Ávila  | 2024.1 08.031|

## Tecnologias

HTML5, CSS3, JavaScript puro (módulos ES), Fetch API, JSON e `localStorage`.
Google Fonts (Newsreader e Instrument Sans). Nenhum framework, biblioteca JS, npm ou etapa de build.

## Como executar

O `fetch` não funciona com `file://`; é preciso servir a pasta por HTTP.

**Live Server (VS Code)**
1. Instale a extensão *Live Server*.
2. Abra a pasta `reading-tracker/` no VS Code.
3. Clique com o botão direito em `index.html` → *Open with Live Server*.

**Alternativa sem instalar nada além do Python:** `python -m http.server 8000` dentro da pasta e acesse `http://localhost:8000`.

No primeiro acesso o app carrega `data/seed.json` e grava os dados no `localStorage`. Nos acessos seguintes lê somente o `localStorage`. *Settings → Reset Data* restaura o seed.

## Estrutura

```
reading-tracker/
├──Backend
├──Docs
├──frontend
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
        ├── utils.js, dom.js
    ```

## Preparação para a Entrega 2

- Todo acesso a dados passa por `store.js`; todas as funções são `async`.
- Os formatos são os do `seed.json` (`authorIds`, `themeIds`, `countryId`, `bookId`…).
- O `store.js` lança `ApiError` com `status` (400, 404, 409), `message` e `errors: [{ field, message }]`.
- Na Entrega 2 apenas o `store.js` será reescrito para chamar a API REST.

## Decisões e pontos de atenção

- **Contagens do seed:** o arquivo possui 135 themes (o enunciado cita 132). O app usa o arquivo como está.
- **Dashboard:** *Books Read*, *Currently Reading*, *Want to Read*, *Paused* e *Abandoned* contam livros distintos por status. A média considera apenas leituras com nota.
- **Ordenação do Reading Log:** valores ausentes ficam sempre por último (nos dois sentidos); o critério secundário é o ID da leitura em ordem crescente.
- **Edição de livro:** o ano de publicação não pode ser posterior ao ano de uma leitura já registrada (mantém os dados consistentes com a regra "ano da leitura não pode ser anterior à publicação").
- **Temas novos:** criados no formulário do livro, mas só gravados ao salvar o livro; se o salvamento falhar, são desfeitos.
- **Edição de leitura:** o livro da leitura não pode ser trocado.
- **Datas de autores:** a data de falecimento deve ser estritamente posterior à de nascimento.

## Checklist de requisitos

- [x] **FR-01** Gerenciar autores (CRUD, nome único sem diferenciar maiúsculas, país de lista fixa, regras de datas, bloqueio de exclusão com lista dos livros vinculados)
- [x] **FR-02** Gerenciar livros (CRUD, autores e temas selecionados, tema novo no formulário, apenas o título é obrigatório)
- [x] **FR-03** Gerenciar leituras (adicionar, editar, excluir; seção opcional *First Reading*; exclusão de livro remove as leituras após confirmação com a contagem)
- [x] **FR-04** Fluxo de status (ano obrigatório ao mover para *Read*; sair de *Want to read* limpa *Priority* e mantém *Recommended by* e *Notes*; confirmação antes de limpar ano/nota; releitura cria nova leitura)
- [x] **FR-05** Reading Log (ordenável por coluna, "-" para ausentes, ausentes por último, padrão: ano mais recente e depois ID)
- [x] **FR-06** Validações centralizadas em `validation.js`, mensagens junto ao campo, nada inválido é salvo
- [x] **FR-07** Seed carregado apenas no primeiro acesso, dados persistem, *Reset Data* com confirmação


