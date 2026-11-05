# Sistema de Infoprodutos

App web para um único operador: mineração, produção, rastreamento, páginas, criativos, análise diária e finanças. Todos os valores financeiros em R$. A receita informada já é líquida das taxas da Hotmart (nunca descontada de novo).

## Publicar no GitHub Pages
1. Crie um repositório no GitHub (pode ser público: o código não leva dados seus).
2. Extraia o zip e envie o CONTEÚDO da pasta (index.html e package.json na raiz), incluindo `.github/workflows/deploy.yml`, para a branch `main`. Pelo site do GitHub, arrastar pasta oculta pode falhar: use GitHub Desktop ou Git e confira se `.github/workflows/deploy.yml` aparece no repositório.
3. Settings > Pages > Source: **GitHub Actions**.
4. Aba Actions: aguarde ficar verde (roda os testes e o build). O link aparece em Settings > Pages.
5. Para atualizar o app: envie os arquivos novos para `main`.

## Rodar localmente
`npm install`, depois `npm run dev` (desenvolvimento), `npm test` (testes), `npm run build` (produção).

## Dados, backup e restauração
- Os dados ficam no IndexedDB deste navegador. Não sincronizam entre aparelhos. Limpar dados do navegador apaga tudo se não houver backup.
- Backups e configurações > Exportar backup. Guarde o JSON em um repositório PRIVADO. O arquivo traz versão, data, checksum e apenas texto cifrado dos tokens.
- Restaurar: Importar backup. Arquivo adulterado ou de outro sistema é recusado. A restauração substitui os dados atuais.
- O app avisa quando o último backup passou de 7 dias.

## Segurança
- O GitHub Pages é público: não existe login, e nenhuma senha de front-end restringe o acesso à interface. Nenhum dado seu está no código nem no repositório.
- Tokens Meta CAPI e UTMify são cifrados no navegador (AES-GCM, chave derivada da sua frase-senha com PBKDF2). A frase-senha fica só na memória da sessão. Se esquecer, os tokens não são recuperáveis.
- Cartões: apenas apelido. O app recusa sequências que parecem número de cartão.

## Estrutura
`src/domain` regras puras, ações e dados de exemplo. `src/storage` camada de dados isolada (interface `Repository`, hoje com Dexie/IndexedDB), backup e criptografia. `src/ui` telas.
Para trocar IndexedDB por um banco na nuvem, implemente a interface `Repository` e injete em `DataProvider`.
