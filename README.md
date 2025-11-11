# Biblioteca-Simples - Sistema de Controle de Empréstimos

Este é um simples sistema de controle de biblioteca em Node.js para gerenciar livros alugados, devolvidos e ativos. O sistema permite registrar, consultar, alugar e devolver livros, além de gerar um resumo diário das transações realizadas.

## Funcionalidades

* **Alugar Livro**: Registra o aluguel de um livro, salvando informações como ID, título, CPF do cliente e o preço diário de aluguel.
* **Devolver Livro**: Registra a devolução de um livro, calculando automaticamente o preço final com base nos dias de aluguel.
* **Consultar Livro por ID**: Permite consultar o status de um livro (se está alugado ou já foi devolvido).
* **Listar Livros Alugados**: Exibe todos os livros que estão atualmente alugados.

## Estrutura de Arquivos

O sistema utiliza arquivos CSV para armazenar informações sobre livros alugados, devolvidos e ativos, além de gerar um resumo diário das transações.

* **alugados.csv**: Contém registros de livros alugados.
* **ativos.csv**: Contém os livros que estão atualmente alugados.
* **devolvidos.csv**: Contém registros dos livros que já foram devolvidos.
* **resumo\_diario.txt**: Gera um resumo diário de todas as ações realizadas no sistema.

## Como Executar

1. Clone este repositório para sua máquina:

   git clone https://github.com/Ahfoganu/Biblioteca-Simples-

2. Navegue até o diretório do projeto:

   cd biblioteca

3. Instale as dependências do Node.js:
   npm install

4. Execute o sistema:

   node biblioteca.js

5. Siga as instruções no terminal para interagir com o sistema.

## Autoria

Este projeto foi desenvolvido por **Christian Dower Simões**, aluno da **Faculdade UniAnchieta**.

* **RA**: 2501871

## Tecnologias Usadas

* **Node.js**: Para desenvolvimento do backend e manipulação de arquivos.
* **TypeScript**: Para tipagem estática e maior segurança no desenvolvimento.
