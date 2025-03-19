const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const axios = require('axios');
const express = require('express');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const WebSocket = require('ws');

const app = express();
app.use(express.json());

const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzzkFkvMkJ7bCGmgEuLuwHsmypjqRcebCSU1vrGYcqSu0MGkSVhMo8LXhGAFCwCydzzew/exec';
const GRUPOS_PERMITIDOS = [
  '120363403512588677@g.us', // Grupo original
  '120363415954951531@g.us' // Novo grupo
]; // ID do grupo onde o bot está vinculado
const USUARIOS_AUTORIZADOS = [
  '5521975874116@s.whatsapp.net', // N1
  '55219976919619@s.whatsapp.net' // N2
];
const OPENROUTER_API_KEY = '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'; // Substitua pela sua chave de API do OpenRout
const chartJSNodeCanvas = new ChartJSNodeCanvas({
  width: 800,
  height: 600,
  backgroundColour: 'white'
});

const wss = new WebSocket.Server({ port: 8080 });

let ultimoComandoProcessado = null;

// Depois faça o log das configurações
console.log("Grupos Autorizados:", GRUPOS_PERMITIDOS);
console.log("Usuários Autorizados:", USUARIOS_AUTORIZADOS);

// Lista de comandos para o comando "ajuda"
const LISTA_DE_COMANDOS = `
📋 *Lista de Comandos* 📋

💰 *Resumo Financeiro*
- resumo: Mostra um resumo financeiro.

💸 *Transações*
- entrada [valor]: Registra uma entrada de dinheiro.
- saída [valor] [categoria]: Registra uma saída de dinheiro em uma categoria específica.
- poupança [valor]: Adiciona um valor à poupança.

📊 *Gráficos e Estatísticas*
- média: Mostra a média de entradas.
- grafico [tipo] [dados] [periodo]: Gera um gráfico com base nos dados fornecidos.

📌 *Categorias*
- categoria adicionar [nome]: Adiciona uma nova categoria.
- listar categorias: Lista todas as categorias.

📅 *Orçamentos*
- orçamento [número]: Mostra o resumo de um orçamento específico.
- orçamento definir [categoria] [valor]: Define um orçamento para uma categoria.
- orçamento listar: Lista todos os orçamentos.
- orçamento excluir [número]: Exclui um orçamento específico.

💳 *Dívidas*
- dívida adicionar [valor] [credor] [dataVencimento]: Adiciona uma dívida.
- dívida listar: Lista todas as dívidas.

⏰ *Lembretes*
- lembrete adicionar [descrição] [data]: Adiciona um lembrete.
- lembrete listar: Lista todos os lembretes.

📜 *Histórico*
- historico [tipo] [categoria] [dataInicio] [dataFim]: Mostra o histórico de transações.

❌ *Exclusão*
- excluir [número(s)]: Exclui transações específicas.
- excluir tudo: Exclui todas as transações.
- excluir dia [data]: Exclui transações de um dia específico.
- excluir periodo [dataInicio] [dataFim]: Exclui transações de um período específico.

🔧 *Ajuda*
- ajuda: Mostra esta lista de comandos.
`;

// Função para interpretar mensagens usando o OpenRouter
async function interpretarMensagemComOpenRouter(texto) {
  console.log("Iniciando interpretação da mensagem com OpenRouter...");
  try {
    const resposta = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'qwen/qwq-32b:free',
        messages: [
          {
            role: 'user',
            content: `Interprete a mensagem e retorne APENAS o JSON (sem explicações adicionais e sem textos enormes, sendo apenas o necessario) correspondente ao comando. 
            Comandos disponíveis:
            - resumo: Mostra um resumo financeiro.
            - poupança [valor]: Adiciona um valor à poupança.
            - entrada [valor]: Registra uma entrada de dinheiro.
            - saída [valor] [categoria]: Registra uma saída de dinheiro em uma categoria específica.
            - média: Mostra a média de entradas.
            - grafico [tipo] [dados] [periodo]: Gera um gráfico com base nos dados fornecidos.
            - categoria adicionar [nome]: Adiciona uma nova categoria.
            - listar categorias: Lista todas as categorias.
            - orçamento [número]: Mostra o resumo do orçamento com o número especificado.
            - orçamento definir [categoria] [valor]: Define um orçamento para uma categoria.
            - orçamento listar: Lista todos os orçamentos.
            - orçamento excluir [número]: Exclui um orçamento específico.
            - dívida adicionar [valor] [credor] [dataVencimento]: Adiciona uma dívida.
            - dívida listar: Lista todas as dívidas.
            - lembrete adicionar [descrição] [data]: Adiciona um lembrete.
            - lembrete listar: Lista todos os lembretes.
            - historico [tipo] [categoria] [dataInicio] [dataFim]: Mostra o histórico de transações.
            - excluir [número(s)]: Exclui transações específicas.
            - excluir tudo: Exclui todas as transações.
            - excluir dia [data]: Exclui transações de um dia específico.
            - excluir periodo [dataInicio] [dataFim]: Exclui transações de um período específico.

            1º **Instruções Especiais:**
            - Se a mensagem se referir a compras de alimentos (como verduras, legumes, frutas, carnes, etc.), a categoria deve ser sempre "Alimentação".
            - Exemplos de mensagens que devem ser categorizadas como "Alimentação":
              - "Comprei uma caixa de aipim por 60 reais"
              - "Gastei 30 reais em verduras no mercado"
              - "Paguei 50 reais em frutas e legumes"

              2º **Instruções Especiais:**
            - Se a mensagem se referir a compras de saúde (como maquiagem, desodorante, remédio, exame, etc.), a categoria deve ser sempre "Alimentação".
            - Exemplos de mensagens que devem ser categorizadas como "Saúde":
              - "Comprei uma dipirona por 3 reais"
              - "Gastei 30 reais em maquiagens na farmácia"
              - "Paguei 50 reais em shampoo e condicionador"

              3º **Instruções Especiais:**
              - Se a mensagem for uma pergunta geral, conversa ou não relacionada a finanças, retorne um JSON vazio: {}.
              - Exemplos de mensagens que devem retornar JSON vazio:
              - "Qual é a previsão do tempo?"
              - "Como você está?"
              - "100 + 10% é quanto?"
              - "Quero fazer uma viagem com 800 reais em São Paulo. Poderia me ajudar a montar uma viagem de 3 dias?"

            Sua tarefa é interpretar a seguinte mensagem e retornar o comando correspondente em formato JSON:
            {
              "comando": "nome_do_comando",
              "parametros": {
                "parametro1": "valor1",
                "parametro2": "valor2",
                "parametro3": "valor3"
              }
            }

            A mensagem pode conter 1, 2 ou 3 parâmetros. Se houver menos de 3 parâmetros, os valores ausentes devem ser preenchidos com valores padrão ou omitidos.

            **Valores padrão:**
            - Para 'grafico':
              - tipo: 'bar'
              - dados: 'ambos'
              - periodo: 'mês'

            **Retorne apenas o JSON, sem explicações adicionais.**

            Mensagem: "${texto}"`
          }
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`
        }
      }
    );

    console.log("Resposta da API OpenRouter recebida:", JSON.stringify(resposta.data, null, 2));

    // Acessa o conteúdo da mensagem
    const mensagem = resposta.data.choices[0].message.content;

    // Tenta extrair o JSON da resposta
    const jsonMatch = mensagem.match(/\{.*\}/s); // Extrai o JSON da string
    if (jsonMatch) {
      try {
        const interpretacao = JSON.parse(jsonMatch[0]);
        console.log("Interpretação da mensagem:", interpretacao);
        return interpretacao;
      } catch (erro) {
        console.error("Erro ao analisar JSON:", erro);
        return null;
      }
    } else {
      console.log("Nenhum JSON válido encontrado no campo 'content'. Usando fallback manual...");
      return interpretarMensagemManual(texto); // Fallback manual
    }
  } catch (erro) {
    console.error("Erro ao interpretar mensagem com OpenRouter:", erro);
    return null;
  }
}

// Função para gerar uma resposta de conversação usando o OpenRouter
async function gerarRespostaConversacao(texto) {
  console.log("Gerando resposta de conversação com OpenRouter...");
  try {
    const resposta = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'qwen/qwq-32b:free',
        messages: [
          {
            role: 'user',
            content: `Você é um assistente virtual que ajuda com finanças e também pode conversar sobre outros assuntos. Responda de forma amigável e útil.
            Mensagem: "${texto}"`
          }
        ],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`
        }
      }
    );

    console.log("Resposta da API OpenRouter recebida:", JSON.stringify(resposta.data, null, 2));

    // Acessa o conteúdo da mensagem
    const mensagem = resposta.data.choices[0].message.content;
    return mensagem;
  } catch (erro) {
    console.error("Erro ao gerar resposta de conversação:", erro);
    return "❌ Desculpe, não consegui processar sua mensagem. Tente novamente mais tarde.";
  }
}

function interpretarMensagemManual(texto) {
  console.log("Usando fallback manual para interpretar a mensagem...");
  const palavras = texto.toLowerCase().split(' ');
  const valorMatch = texto.match(/\d+/);
  const valor = valorMatch ? parseFloat(valorMatch[0]) : null;
 
    // Mapeamento de palavras-chave para categorias
  const categorias = {
    // Alimentação
    arroz: 'Alimentação',
    alho: 'Alimentação',
    feijão: 'Alimentação',
    carne: 'Alimentação',
    frango: 'Alimentação',
    peixe: 'Alimentação',
    leite: 'Alimentação',
    pão: 'Alimentação',
    macarrão: 'Alimentação',
    óleo: 'Alimentação',
    açúcar: 'Alimentação',
    café: 'Alimentação',
    refrigerante: 'Alimentação',
    suco: 'Alimentação',
    fruta: 'Alimentação',
    verdura: 'Alimentação',
    legume: 'Alimentação',
    comida: 'Alimentação',
    restaurante: 'Alimentação',
    lanche: 'Alimentação',
    mercado: 'Alimentação',
    supermercado: 'Alimentação',

    // Transporte
    táxi: 'Transporte',
    uber: 'Transporte',
    ônibus: 'Transporte',
    gasolina: 'Transporte',
    combustível: 'Transporte',
    estacionamento: 'Transporte',
    metro: 'Transporte',
    bilhete: 'Transporte',
    passagem: 'Transporte',

    // Lazer
    cinema: 'Lazer',
    Netflix: 'Lazer',
    Spotify: 'Lazer',
    parque: 'Lazer',
    viagem: 'Lazer',
    jogo: 'Lazer',
    festa: 'Lazer',
    bar: 'Lazer',
    show: 'Lazer',
    teatro: 'Lazer',
    museu: 'Lazer',
    passeio: 'Lazer',

    // Moradia
    aluguel: 'Moradia',
    condomínio: 'Moradia',
    luz: 'Moradia',
    água: 'Moradia',
    internet: 'Moradia',
    telefone: 'Moradia',
    gás: 'Moradia',
    reforma: 'Moradia',
    móveis: 'Moradia',
    decoração: 'Moradia',

    // Saúde
    médico: 'Saúde',
    remédio: 'Saúde',
    farmácia: 'Saúde',
    hospital: 'Saúde',
    plano: 'Saúde',
    dentista: 'Saúde',
    consulta: 'Saúde',
    exame: 'Saúde',
    óculos: 'Saúde',
    fisioterapia: 'Saúde',

    // Educação
    escola: 'Educação',
    curso: 'Educação',
    faculdade: 'Educação',
    livro: 'Educação',
    material: 'Educação',
    mensalidade: 'Educação',
    matrícula: 'Educação',
    aula: 'Educação',
    workshop: 'Educação',
    seminário: 'Educação',

    // Vestuário
    roupa: 'Vestuário',
    camiseta: 'Vestuário',
    calça: 'Vestuário',
    sapato: 'Vestuário',
    tênis: 'Vestuário',
    blusa: 'Vestuário',
    jaqueta: 'Vestuário',
    bolsa: 'Vestuário',
    acessório: 'Vestuário',
    óculos: 'Vestuário',
    lingerie: 'Vestuário',

    // Assinaturas
    Netflix: 'Assinaturas',
    Spotify: 'Assinaturas',
    Amazon: 'Assinaturas',
    Disney: 'Assinaturas',
    HBO: 'Assinaturas',
    revista: 'Assinaturas',
    jornal: 'Assinaturas',
    software: 'Assinaturas',
    app: 'Assinaturas',

    // Presentes
    presente: 'Presentes',
    aniversário: 'Presentes',
    natal: 'Presentes',
    casamento: 'Presentes',
    flores: 'Presentes',
    cartão: 'Presentes',
    lembrancinha: 'Presentes',

    // Animais de Estimação
    pet: 'Animais de Estimação',
    ração: 'Animais de Estimação',
    veterinário: 'Animais de Estimação',
    banho: 'Animais de Estimação',
    tosa: 'Animais de Estimação',
    brinquedo: 'Animais de Estimação',
    coleira: 'Animais de Estimação',

    // Outros
    doação: 'Outros',
    caridade: 'Outros',
    multa: 'Outros',
    imposto: 'Outros',
    taxa: 'Outros',
    seguro: 'Outros',
    conserto: 'Outros',
    manutenção: 'Outros',
    reparo: 'Outros'
  };

  let categoria = 'Outros'; // Categoria padrão caso não encontre uma correspondência
  for (const [palavra, cat] of Object.entries(categorias)) {
    if (palavras.includes(palavra)) {
      categoria = cat;
      break;
    }
  }

  // Determina o tipo de transação
  const tipo = palavras.includes('usei') || palavras.includes('gastei') || palavras.includes('paguei') || palavras.includes('comprei') ? 'Saída' : 'Entrada';

  if (!valor) {
    return null; // Não foi possível extrair um valor
  }

  return { valor, categoria, tipo };
}

// Função para gerar gráficos
async function gerarGrafico(tipo, dados) {
  console.log("Gerando gráfico...");
  const configuration = {
    type: tipo, // 'bar' é o tipo de gráfico válido
    data: {
      labels: dados.labels, // Rótulos do eixo X
      datasets: dados.datasets // Conjuntos de dados
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: dados.titulo, font: { size: 18 } }, // Título do gráfico
        legend: { position: 'top' } // Legenda no topo
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (value) => 'R$ ' + value.toFixed(2).replace(".", ",") } // Formata os valores do eixo Y
        }
      }
    }
  };
  return chartJSNodeCanvas.renderToBuffer(configuration);
}

// Função para verificar se a mensagem parece ser um comando financeiro
function pareceSerComandoFinanceiro(texto) {
  const palavrasChaveFinanceiras = [
    "resumo", "poupança", "entrada", "saída", "média", "gráfico", "categoria", 
    "orçamento", "dívida", "lembrete", "histórico", "excluir", "comprei", "gastei", 
    "paguei", "transferir", "saldo", "meta", "valor", "reais", "R$"
  ];

  // Verifica se a mensagem contém alguma palavra-chave financeira
  return palavrasChaveFinanceiras.some(palavra => 
    texto.toLowerCase().includes(palavra.toLowerCase())
  );
}

// Função principal do bot
async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({ auth: state });
  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, qr } = update;
    if (qr) {
      const qrLink = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qr)}`;
      console.log('QR Code:', qrLink);
      wss.clients.forEach(client => client.send(JSON.stringify({ qr: qrLink })));
    }
    if (connection === 'open') console.log('Bot conectado!');
    if (connection === 'close') setTimeout(iniciarBot, 5000);
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];

    // Verificação completa da estrutura da mensagem
    if (
      !msg?.message || 
      !msg.key?.remoteJid || 
      typeof msg.message.conversation !== 'string'
  ) {
      console.log("Mensagem ignorada (formato inválido).");
      return;
  }

  // Declaração única da variável 'texto'
  const texto = msg.message.conversation?.trim() || "";

  // Comando !id (funciona em qualquer grupo)
  if (texto.toLowerCase() === "!id") {
    const grupoId = msg.key.remoteJid;
    await sock.sendMessage(grupoId, { 
      text: `🔑 ID deste grupo: *${grupoId}*` 
    });
    return;
  }

  // --- Verificações de grupo e usuário ---
  console.log("Grupo Remetente:", msg.key.remoteJid);
  
  // Verifica grupo permitido
  if (!GRUPOS_PERMITIDOS.includes(msg.key.remoteJid)) {
    console.log("Mensagem ignorada (grupo não autorizado). IDs válidos:", GRUPOS_PERMITIDOS);
    return;
  }

  // Verifica usuário autorizado
  const remetenteId = msg.key.participant || msg.key.remoteJid;
  if (!USUARIOS_AUTORIZADOS.includes(remetenteId)) {
    console.log("Usuário não autorizado:", remetenteId);
    return;
  }

    // Ignora apenas mensagens que começam com "❌" (respostas automáticas do bot)
    if (msg.message.conversation?.startsWith("❌")) {
      console.log("Mensagem ignorada (resposta automática do bot).");
      return;
    }

    // Verifica se a mensagem é do tipo 'conversation' (texto)
    if (!msg.message.conversation) {
      console.log("Mensagem ignorada (não é uma mensagem de texto).");
      return;
    }

    // Verifica se a mensagem é antiga (mais de 60 segundos)
    const mensagemTimestamp = msg.messageTimestamp;
    const agora = Math.floor(Date.now() / 1000);
    if (agora - mensagemTimestamp > 60) {
      console.log("Mensagem ignorada (é uma mensagem antiga).");
      return;
    }

    console.log("Mensagem recebida:", JSON.stringify(msg, null, 2));

  // Nome do remetente (apenas para exibição)
  const remetenteNome = msg.pushName || "Usuário"; // Nome exibido no WhatsApp
// Comando para obter o ID do grupo
if (texto.toLowerCase() === "!id") {
  const grupoId = msg.key.remoteJid;
  await sock.sendMessage(grupoId, { 
    text: `📌 ID deste grupo: *${grupoId}*` 
  });
  return;
}
  if (ultimoComandoProcessado === texto) return;
  ultimoComandoProcessado = texto;

  console.log("Texto da mensagem:", texto);

    // --- VERIFICAÇÃO DO COMANDO "AJUDA" ---
  if (texto.toLowerCase() === "ajuda") {
    await sock.sendMessage(msg.key.remoteJid, { text: LISTA_DE_COMANDOS });
    return; // Encerra o processamento aqui
  }

    try {
      if (pareceSerComandoFinanceiro(texto)) {
        console.log("Tentando interpretar a mensagem como um comando financeiro...");
        const interpretacao = await interpretarMensagemComOpenRouter(texto);
  
        // Se o OpenRouter retornou um comando válido
        if (interpretacao?.comando) {
          const { comando, parametros } = interpretacao;
          console.log("Comando interpretado:", comando);
          console.log("Parâmetros interpretados:", parametros);

      // Processa o comando financeiro
      switch (comando) {
        // CASO 'resumo'
        case 'resumo': { // <--- Adicione chaves aqui
          console.log("Processando comando 'resumo'...");
          const resumoFinanceiro = await axios.get(`${WEB_APP_URL}?action=resumo`); // Renomeei para resumoFinanceiro
          await sock.sendMessage(msg.key.remoteJid, { text: resumoFinanceiro.data });
          break;
        }

        case 'poupança':
  console.log("Processando comando 'poupança'...");
  const valorPoupanca = parametros.valor;
  // Alterado: remetente → remetenteNome
  await axios.get(`${WEB_APP_URL}?action=adicionarPoupanca&valor=${valorPoupanca}&remetente=${remetenteNome}`);
  await sock.sendMessage(msg.key.remoteJid, { text: `✅ R$ ${valorPoupanca} transferidos para a poupança.` });
  break;

          case 'entrada':
            console.log("Processando comando 'entrada'...");
            const valorEntrada = parametros.valor;
            // Alterado: remetente → remetenteNome
            await axios.get(`${WEB_APP_URL}?action=entrada&valor=${valorEntrada}&remetente=${remetenteNome}`);
            await sock.sendMessage(msg.key.remoteJid, { text: `✅ Entrada de R$ ${valorEntrada} registrada por ${remetenteNome}.` });
            break;

          case 'saída':
            console.log("Processando comando 'saída'...");
            const valorSaida = parametros.valor;
            const categoriaSaida = parametros.categoria;
            const responseSaida = await axios.get(
              `${WEB_APP_URL}?action=saída&valor=${valorSaida}&categoria=${categoriaSaida}&remetente=${remetenteNome}` // ✅ Corrigido
            );
            await sock.sendMessage(msg.key.remoteJid, { text: responseSaida.data });
            break;

        case 'média':
          console.log("Processando comando 'média'...");
          const media = await axios.get(`${WEB_APP_URL}?action=mediaEntradas`);
          await sock.sendMessage(msg.key.remoteJid, { text: media.data });
          break;

        case 'grafico':
          console.log("Processando comando 'grafico'...");
          const tipoGrafico = 'bar'; // Força o tipo de gráfico para 'bar'
          const tipoDados = parametros.dados || 'ambos';
          const periodo = parametros.periodo || 'todos';

          // Obtém os dados da API
          const response = await axios.get(`${WEB_APP_URL}?action=getDadosGrafico&tipo=${tipoDados}&periodo=${periodo}`);
          const dados = response.data;

          // Verifica se os dados estão no formato correto
          if (!dados.labels || !dados.datasets || !dados.titulo) {
            console.error("Dados do gráfico inválidos:", dados);
            await sock.sendMessage(msg.key.remoteJid, { text: "❌ Erro: Dados do gráfico inválidos." });
            return;
          }

          // Gera o gráfico
          try {
            const image = await gerarGrafico(tipoGrafico, dados);
            await sock.sendMessage(msg.key.remoteJid, { image: image, caption: `📊 ${dados.titulo}` });
          } catch (error) {
            console.error("Erro ao gerar o gráfico:", error);
            await sock.sendMessage(msg.key.remoteJid, { text: `❌ Erro ao gerar o gráfico: ${error.message}` });
          }
          break;

        case 'categoria adicionar':
          console.log("Processando comando 'categoria adicionar'...");
          const nomeCategoria = parametros.nome;
          await axios.get(`${WEB_APP_URL}?action=adicionarCategoria&categoria=${nomeCategoria}`);
          await sock.sendMessage(msg.key.remoteJid, { text: `📌 Categoria "${nomeCategoria}" adicionada com sucesso.` });
          break;

        case 'listar categorias':
          console.log("Processando comando 'listar categorias'...");
          const responseCategorias = await axios.get(`${WEB_APP_URL}?action=listarCategorias`);
          const categorias = responseCategorias.data.categorias;
          if (categorias.length === 0) {
            await sock.sendMessage(msg.key.remoteJid, { text: "📌 Nenhuma categoria cadastrada." });
          } else {
            const listaCategorias = categorias.map((cat, index) => `${index + 1}. ${cat}`).join('\n');
            await sock.sendMessage(msg.key.remoteJid, { text: `📌 Categorias cadastradas:\n${listaCategorias}` });
          }
          break;

        case 'dívida adicionar':
          console.log("Processando comando 'dívida adicionar'...");
          const valorDivida = parametros.valor;
          const credor = parametros.credor;
          const dataVencimento = parametros.dataVencimento;
          await axios.get(`${WEB_APP_URL}?action=adicionarDivida&valor=${valorDivida}&credor=${credor}&dataVencimento=${dataVencimento}`);
          await sock.sendMessage(msg.key.remoteJid, { text: `✅ Dívida de R$ ${valorDivida} adicionada com ${credor}, vencendo em ${dataVencimento}.` });
          break;

        case 'dívida listar':
          console.log("Processando comando 'dívida listar'...");
          const responseDividas = await axios.get(`${WEB_APP_URL}?action=listarDividas`);
          const dividas = responseDividas.data.dividas;
          if (dividas.length === 0) {
            await sock.sendMessage(msg.key.remoteJid, { text: "📌 Nenhuma dívida cadastrada." });
          } else {
            const listaDividas = dividas.map(d => `${d.id}. ${d.credor}: R$ ${d.valor} (Vencimento: ${d.vencimento})`).join('\n');
            await sock.sendMessage(msg.key.remoteJid, { text: `📌 Dívidas:\n${listaDividas}` });
          }
          break;

        case 'lembrete adicionar':
          console.log("Processando comando 'lembrete adicionar'...");
          const descricaoLembrete = parametros.descricao;
          const dataLembrete = parametros.data;
          await axios.get(`${WEB_APP_URL}?action=adicionarLembrete&descricao=${descricaoLembrete}&data=${dataLembrete}`);
          await sock.sendMessage(msg.key.remoteJid, { text: `✅ Lembrete "${descricaoLembrete}" adicionado para ${dataLembrete}.` });
          break;

        case 'lembrete listar':
          console.log("Processando comando 'lembrete listar'...");
          const responseLembretes = await axios.get(`${WEB_APP_URL}?action=listarLembretes`);
          const lembretes = responseLembretes.data.lembretes;
          if (lembretes.length === 0) {
            await sock.sendMessage(msg.key.remoteJid, { text: "📌 Nenhum lembrete cadastrado." });
          } else {
            const listaLembretes = lembretes.map(l => `${l.id}. ${l.descricao} (${l.data})`).join('\n');
            await sock.sendMessage(msg.key.remoteJid, { text: `📌 Lembretes:\n${listaLembretes}` });
          }
          break;

        case 'orçamento definir':
          console.log("Processando comando 'orçamento definir'...");
          const categoria = parametros.categoria;
          const valor = parametros.valor;
          await axios.get(`${WEB_APP_URL}?action=definirOrcamento&categoria=${categoria}&valor=${valor}`);
          await sock.sendMessage(msg.key.remoteJid, { text: `✅ Orçamento de R$ ${valor} definido para a categoria "${categoria}".` });
          break;

        case 'orçamento listar':
          console.log("Processando comando 'orçamento listar'...");
          const responseOrcamentos = await axios.get(`${WEB_APP_URL}?action=listarOrcamentos`);
          await sock.sendMessage(msg.key.remoteJid, { text: responseOrcamentos.data });
          break;

          case 'orçamento excluir': {
            console.log("Processando comando 'orçamento excluir'...");
            const numeroOrcamentoExcluir = parametros['número']; // Acessa o parâmetro corretamente
            const responseExcluirOrcamento = await axios.get(`${WEB_APP_URL}?action=excluirOrcamento&numero=${numeroOrcamentoExcluir}`);
            await sock.sendMessage(msg.key.remoteJid, { text: responseExcluirOrcamento.data });
            break;
          }

          case 'orçamento': { // <--- Adicione chaves aqui
            console.log("Processando comando 'orçamento'...");
            const numeroOrcamentoConsulta = parseInt(parametros.numero);
        
            // Obtém a lista de orçamentos
            const responseOrcamentosLista = await axios.get(`${WEB_APP_URL}?action=listarOrcamentos`);
            const orcamentos = responseOrcamentosLista.data.split('\n').slice(1).filter(line => line.trim() !== '');
        
            // Verifica se o número é válido
            if (numeroOrcamentoConsulta < 1 || numeroOrcamentoConsulta > orcamentos.length) {
              await sock.sendMessage(msg.key.remoteJid, { text: "❌ Número de orçamento inválido." });
              break;
            }
        
            const orcamentoSelecionado = orcamentos[numeroOrcamentoConsulta - 1];
        
            // Valida o formato da linha
            if (!orcamentoSelecionado.includes(':')) {
              await sock.sendMessage(msg.key.remoteJid, { text: "❌ Formato de orçamento inválido." });
              break;
            }
        
            // Extrai a categoria
            const [indiceCategoria, valorOrcamento] = orcamentoSelecionado.split(':');
            const partesIndice = indiceCategoria.split('. ');
            
            if (partesIndice.length < 2) {
              await sock.sendMessage(msg.key.remoteJid, { text: "❌ Formato de categoria inválido." });
              break;
            }
        
            const categoriaOrcamento = partesIndice[1].trim();
        
            // Obtém o resumo do orçamento
            const responseResumo = await axios.get(`${WEB_APP_URL}?action=resumoOrcamento&categoria=${categoriaOrcamento}`);
            const dadosResumo = responseResumo.data; // Renomeei para dadosResumo
        
            // Formata a mensagem
            const mensagemResumo = 
`📊 Orçamento de ${dadosResumo.categoria}:
💰 Total Gasto: R$ ${dadosResumo.totalGasto}
📉 Porcentagem Utilizada: ${dadosResumo.porcentagemUtilizada}%
📈 Valor Restante: R$ ${dadosResumo.valorRestante}`;
            await sock.sendMessage(msg.key.remoteJid, { text: mensagemResumo });
            break;
          }

        case 'excluir':
          console.log("Processando comando 'excluir'...");
          const numeros = Object.values(parametros).join(",");
          const responseExcluir = await axios.get(`${WEB_APP_URL}?action=excluirTransacao&parametro=${encodeURIComponent(numeros)}`);
          await sock.sendMessage(msg.key.remoteJid, { text: responseExcluir.data });
          break;

          default:
            console.log("Comando não reconhecido.");
            await sock.sendMessage(msg.key.remoteJid, { text: "❌ Comando não reconhecido. Use 'ajuda' para ver a lista de comandos." });
        }
      } else {
        // Se o OpenRouter retornou JSON vazio ou inválido, entra na conversação
        console.log("Gerando resposta de conversação...");
        const respostaConversacao = await gerarRespostaConversacao(texto);
        await sock.sendMessage(msg.key.remoteJid, { text: respostaConversacao });
      }
    } else {
      // Se a mensagem não parece ser um comando, entra na conversação
      console.log("Gerando resposta de conversação...");
      const respostaConversacao = await gerarRespostaConversacao(texto);
      await sock.sendMessage(msg.key.remoteJid, { text: respostaConversacao });
    }
  } catch (error) {
    console.error("Erro ao processar a mensagem:", error);
    await sock.sendMessage(msg.key.remoteJid, { text: `❌ Erro: ${error.message}` });
  }
});
}

app.listen(3000, () => console.log("Servidor rodando!"));
iniciarBot();
