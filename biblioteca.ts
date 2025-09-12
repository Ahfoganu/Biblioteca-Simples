import * as fs from "fs";
import * as path from "path";
import * as readline from 'readline';

const filePath = path.join(__dirname, "registro.txt");

interface Livro {
    id: number;
    titulo: string;
    autor: string;
    emEstoque: boolean;
}

interface LivroAlugado {
    id: number;
    titulo: string;
    alugadoISO: string;
    preco: number;
    CPFcliente: string;
}

interface LivroDevolvido extends LivroAlugado {
    devolvidoISO: string;
    dias: number;
    precoReal: number;
}

const ROOT = path.resolve('.');
const DIR = {
  ts: path.join(ROOT, 'ts'),
  js: path.join(ROOT, 'js'),
  csv: path.join(ROOT, 'csv'),
  json: path.join(ROOT, 'json'),
};

const ARQ = {
  alugados: path.join(DIR.csv, 'alugados.csv'),
  ativos:   path.join(DIR.csv, 'ativos.csv'),
  devolvidos:   path.join(DIR.csv, 'devolvidos.csv'),
  resumo:   path.join(DIR.csv, 'resumo_diario.txt'),
};

const CAB = {
  alugado: 'alugadoISO,id,titulo,preco,CPFcliente\n',
  ativos:  'alugadoISO,id,titulo,preco,CPFcliente\n',
  devolvidos:  'alugadoISO,devolvidoISO,id,titulo,preco,CPFcliente,dias,precoReal\n',
};

async function preparaAmbiente(): Promise<void> {
  await fs.mkdir(DIR.ts,   { recursive: true });
  await fs.mkdir(DIR.js,   { recursive: true });
  await fs.mkdir(DIR.csv,  { recursive: true });
  await fs.mkdir(DIR.json, { recursive: true });

  await criaSeNaoExiste(ARQ.alugados, CAB.alugado);
  await criaSeNaoExiste(ARQ.ativos,   CAB.ativos);
  await criaSeNaoExiste(ARQ.devolvidos,   CAB.devolvidos);
  await criaSeNaoExiste(ARQ.resumo,   'RESUMO DIÁRIO DA BIBLIOTECA\n');
}

async function criaSeNaoExiste(caminho: string, conteudo: string): Promise<void> {
  try { await fs.promises.access(caminho); }
  catch { await fs.promises.writeFile(caminho, conteudo, 'utf8'); }
}

function csvSafe(s: string): string {
  return (/,|"|\n/.test(s)) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function ativoToCsv(v: LivroAlugado): string {
  return [v.alugadoISO, String(v.id), v.titulo, String(v.preco), v.CPFcliente]
    .map(csvSafe).join(',') + '\n';
}

function saidaToCsv(s: LivroDevolvido): string {
  return [
    s.alugadoISO,
    s.devolvidoISO,
    String(s.id),
    s.titulo,
    String(s.preco),
    s.CPFcliente,
    String(s.dias),
    String(s.precoReal)
  ].map(csvSafe).join(',') + '\n';
}

function splitCsv(line: string): string[] {
  const out: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else { q = false; } }
      else { cur += ch; }
    } else {
      if (ch === '"') q = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
  }
  out.push(cur);
  return out;
}

async function lerAtivos(): Promise<LivroAlugado[]> {
  const raw: string = await fs.promises.readFile(ARQ.ativos, 'utf8');
  const linhas: string[] = raw.split(/\r?\n/).filter(Boolean).slice(1);
  return linhas.map((l: string) => {
    const [alugadoISO, id, titulo, preco, CPFcliente] = splitCsv(l);
    return { alugadoISO, id: Number(id), titulo, CPFcliente, preco: Number(preco) } as LivroAlugado;
  });
}

async function escreverAtivos(lista: LivroAlugado[]): Promise<void> {
  const corpo: string = lista.map(ativoToCsv).join('');
  await fs.promises.writeFile(ARQ.ativos, CAB.ativos + corpo, 'utf8');
}

async function registrarAlugados(dados: {
  id: number; titulo: string; CPFcliente: string; preco: number;
}): Promise<LivroAlugado> {
  const reg: LivroAlugado = {
    alugadoISO: new Date().toISOString(),
    id: dados.id,
    titulo: dados.titulo.trim(),
    CPFcliente: dados.CPFcliente.trim(),
    preco: dados.preco,
  };
  await fs.promises.appendFile(ARQ.alugados, ativoToCsv(reg), 'utf8');
  await fs.promises.appendFile(ARQ.ativos,   ativoToCsv(reg), 'utf8');
  await fs.promises.appendFile(ARQ.resumo, `Alugado ${reg.titulo} para ${reg.CPFcliente} às ${reg.alugadoISO}\n`, 'utf8');
  return reg;
}

async function registrarDevolvidos(id: number): Promise<LivroDevolvido | null> {
  const ativos: LivroAlugado[] = await lerAtivos();
  const idx: number = ativos.findIndex((v: LivroAlugado) => v.id === id);
  if (idx === -1) return null;

  const base: LivroAlugado = ativos[idx];
  const devolvidoISO: string = new Date().toISOString();

  const ms: number = Date.parse(devolvidoISO) - Date.parse(base.alugadoISO);
  const dias: number = Math.max(1, Math.ceil(ms / 86_400_000));
  const precoReal: number = Number((dias * base.preco).toFixed(2));

  const devolvidos: LivroDevolvido = { ...base, devolvidoISO, dias, precoReal };

  await escreverAtivos(ativos.filter((_, i: number) => i !== idx));
  await fs.promises.appendFile(ARQ.devolvidos, saidaToCsv(devolvidos), 'utf8');
  await fs.promises.appendFile(
    ARQ.resumo,
    `Devolvido o livro de título ${devolvidos.titulo} do cliente ${devolvidos.CPFcliente} às ${devolvidos.devolvidoISO} | ${devolvidos.dias}d x ${base.preco} = ${devolvidos.precoReal}\n`,
    'utf8'
  );
  return devolvidos;
}

async function consultarID(id: number): Promise<
  | { status: 'ATIVO'; registro: LivroAlugado }
  | { status: 'DEVOLVIDO';  registro: LivroDevolvido }
  | { status: 'NAO_ENCONTRADO' }
> {
  const ativos: LivroAlugado[] = await lerAtivos();
  const a = ativos.find((v: LivroAlugado) => v.id === id);
  if (a) return { status: 'ATIVO', registro: a };

  const raw: string = await fs.promises.readFile(ARQ.devolvidos, 'utf8');
  const linhas: string[] = raw.split(/\r?\n/).filter(Boolean).slice(1);

  const saidas: LivroDevolvido[] = linhas
    .map((l: string) => {
      const [alugadoISO, devolvidoISO, id, titulo, preco, CPFcliente, dias, precoReal] = splitCsv(l);
      return {
        alugadoISO,
        devolvidoISO,
        id: Number(id),
        titulo,
        CPFcliente,
        preco: Number(preco),
        dias: Number(dias),
        precoReal: Number(precoReal)
      } as LivroDevolvido;
    })
    .filter((s: LivroDevolvido) => s.id === id)
    .sort((x: LivroDevolvido, y: LivroDevolvido) => x.devolvidoISO.localeCompare(y.devolvidoISO));

  const ultima: LivroDevolvido | undefined = saidas.pop();
  if (ultima) return { status: 'DEVOLVIDO', registro: ultima };

  return { status: 'NAO_ENCONTRADO' };
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(q: string): Promise<string> {
  return new Promise<string>((resolve) => rl.question(q, resolve));
}

function imprimeAtivo(v: LivroAlugado): void {
  console.log(`  ID:        ${v.id}`);
  console.log(`  Título:       ${v.titulo}`);
  console.log(`  CPF do Cliente:          ${v.CPFcliente}`);
  console.log(`  Alugado:      ${v.alugadoISO}`);
  console.log(`  Preço por Dia:   R$ ${v.preco.toFixed(2)}`);
}

function imprimeDevolucao(s: LivroDevolvido): void {
  imprimeAtivo(s);
  console.log(`  Devolvido:        ${s.devolvidoISO}`);
  console.log(`  Dias:        ${s.dias}`);
  console.log(`  Preço a pagar: R$ ${s.precoReal.toFixed(2)}`);
}

async function main(): Promise<void> {
  await preparaAmbiente();

  const livrosDisponiveis: Livro[] = [
    { id: 1, titulo: "One Punch Man VOL1", autor: "ONE", emEstoque: true },
    { id: 2, titulo: "Naruto VOL1", autor: "Masashi Kishimoto", emEstoque: true },
    { id: 3, titulo: "Attack on Titan VOL1", autor: "Hajime Isayama", emEstoque: false },
  ];

  console.log('===============================');
  console.log('      Biblioteca (SIMPLES)     ');
  console.log('===============================');

  let loop = true;
  while (loop) {
    console.log('\nMenu:');
    console.log('1) Alugar');
    console.log('2) Devolver');
    console.log('3) Consultar Status do Livro');
    console.log('4) Sair');

    const op: string = (await ask('Escolha: ')).trim();

    try {
      if (op === '1') {
        console.log('Livros Disponíveis:');
        livrosDisponiveis.forEach((livro) => {
          if (livro.emEstoque) {
            console.log(`ID: ${livro.id} - Título: ${livro.titulo}`);
          }
        });

        const idStr  = await ask('Escolha o ID do livro para alugar: ');
        const idNum = Number(idStr);
        const livroSelecionado = livrosDisponiveis.find(l => l.id === idNum);

        if (livroSelecionado && livroSelecionado.emEstoque) {
          const CPFcliente = await ask('CPF do Cliente: ');
          const precoStr = (await ask('Valor do dia (ex: 6.5): ')).replace(',', '.');
          const preco = Number(precoStr);

          const reg = await registrarAlugados({ id: idNum, titulo: livroSelecionado.titulo, CPFcliente, preco });
          livroSelecionado.emEstoque = false;
          console.log('\n>> ALUGAR REGISTRADO');
          imprimeAtivo(reg);
        } else {
          console.log('Livro não disponível ou ID inválido.');
        }

      } else if (op === '2') {
        const idStr = await ask('ID para devolução: ');
        const idNum = Number(idStr);
        if (!idNum) {
          console.log('ID inválido.');
        } else {
          const s = await registrarDevolvidos(idNum);
          if (!s) console.log('Livro não encontrado nos ATIVOS.');
          else { console.log('\n>> DEVOLUçÃO REGISTRADA'); imprimeDevolucao(s); }
        }

      } else if (op === '3') {
        const idStr = await ask('ID para consulta: ');
        const idNum = Number(idStr);
        if (!idNum) {
          console.log('ID inválido.');
        } else {
          const r = await consultarID(idNum);
          if (r.status === 'ATIVO')      { console.log('Status: ALUGADO'); imprimeAtivo(r.registro); }
          else if (r.status === 'DEVOLVIDO')  { console.log('Status: DEVOLVIDO (último)'); imprimeDevolucao(r.registro); }
          else                           { console.log('Livro não encontrado.'); }
        }

      } else if (op === '4') {
        loop = false;

      } else {
        console.log('Opção inválida.');
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      console.error('Erro:', e?.message ?? err);
    }
  }

  rl.close();
  console.log('Encerrado.');
}

main();
