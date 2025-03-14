require('dotenv').config();
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const axios = require('axios');
const express = require('express');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const simpleGit = require('simple-git');
const git = simpleGit();

const app = express();
app.use(express.json());

// Configurações
const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxJA7HQ04Kd2X7oSTO6W32bXfxbjhORGUM0qVg1RIIl5WddsiqW5Ye3FnOT3GN2pqYiUQ/exec';
const GRUPO_ID = '120363403512588677@g.us';
const NUMEROS_PERMITIDOS = [
  '5521975874116@s.whatsapp.net', // Celular principal (Caio)
  '5521976919619@s.whatsapp.net'  // Celular secundário (Eduarda)
];
const OPENROUTER_API_KEY = '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';

// Configurações do Chart.js
const chartJSNodeCanvas = new ChartJSNodeCanvas({
  width: 800,
  height: 600,
  backgroundColour: 'white'
});

// Servidor WebSocket para QR Code
const wss = new WebSocket.Server({ port: 8080 });
let ultimoComandoProcessado = null;

// Lista de comandos para o comando "ajuda"
const LISTA_DE_COMANDOS = `
ðŸ“‹ *Lista de Comandos* ðŸ“‹
ðŸ’° *Resumo Financeiro*
- resumo: Mostra um resumo financeiro.
ðŸ’¸ *Transações*
- entrada [valor]: Registra uma entrada de dinheiro.
- saída [valor] [categoria]: Registra uma saída de dinheiro em uma categoria específica.
- poupança [valor]: Adiciona um valor à poupança.
ðŸ“Š *Gráficos e Estatísticas*
- média: Mostra a média de entradas.
- grafico [tipo] [dados] [periodo]: Gera um gráfico com base nos dados fornecidos.
ðŸ“Œ *Categorias*
- categoria adicionar [nome]: Adiciona uma nova categoria.
- listar categorias: Lista todas as categorias.
ðŸ“… *Orçamentos*
- orçamento definir [categoria] [valor]: Define um orçamento para uma categoria.
- orçamento listar: Lista todos os orçamentos.
ðŸ’³ *Dívidas*
- dívida adicionar [valor] [credor] [dataVencimento]: Adiciona uma dívida.
- dívida listar: Lista todas as dívidas.
â° *Lembretes*
- lembrete adicionar [descrição] [data]: Adiciona um lembrete.
- lembrete listar: Lista todos os lembretes.
ðŸ“œ *Histórico*
- historico [tipo] [categoria] [dataInicio] [dataFim]: Mostra o histórico de transações.
âŒ *Exclusão*
- excluir [número(s)]: Exclui transações específicas.
- excluir tudo: Exclui todas as transações.
- excluir dia [data]: Exclui transações de um dia específico.
- excluir periodo [dataInicio] [dataFim]: Exclui transações de um período específico.
ðŸ”§ *Ajuda*
- ajuda: Mostra esta lista de comandos.
`;

// Caminho do arquivo de log
const LOG_FILE_PATH = path.join(__dirname, 'conversas.log');

// Função para registrar mensagens no log
async function registrarLog(mensagem) {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${mensagem}\n`;

  // Adiciona a mensagem ao arquivo de log
  fs.appendFileSync(LOG_FILE_PATH, logEntry, 'utf8');

  // Faz commit automático no GitHub
  try {
    await git.add(LOG_FILE_PATH);
    await git.commit(`Registro de conversa: ${timestamp}`);
    await git.push();
    console.log('Log registrado e commitado no GitHub.');
  } catch (error) {
    console.error('Erro ao fazer commit no GitHub:', error);
  }
}

// Função para obter nome do grupo
async function getGroupName(sock, jid) {
  try {
    const metadata = await sock.groupMetadata(jid);
    return metadata.subject;
  } catch (error) {
    return 'Grupo';
  }
}

// Função para obter nome do contato
async function getContactName(sock, jid) {
  try {
    const contact = await sock.fetchUserInfo([jid]);
    return contact[jid]?.name || 'Contato';
  } catch (error) {
    return 'Contato';
  }
}

// Função para interpretar mensagens usando o OpenRouter
async function interpretarMensagemComOpenRouter(texto) {
  console.log("Iniciando interpretação da mensagem com OpenRouter...");
  try {
    const resposta = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'deepseek/deepseek-r1:free',
        messages: [
          {
            role: 'user',
            content: `Você é um assistente que ajuda a interpretar mensagens para um bot de controle financeiro e a interpretação é rápida sem muita explicação. 
            O bot tem os seguintes comandos disponíveis:
            - resumo: Mostra um resumo financeiro.
            - poupança [valor]: Adiciona um valor à poupança.
            - entrada [valor]: Registra uma entrada de dinheiro.
            - saída [valor] [categoria]: Registra uma saída de dinheiro em uma categoria específica.
            - média: Mostra a média de entradas.
            - grafico [tipo] [dados] [periodo]: Gera um gráfico com base nos dados fornecidos.
            - categoria adicionar [nome]: Adiciona uma nova categoria.
            - listar categorias: Lista todas as categorias.
            - orçamento definir [categoria] [valor]: Define um orçamento para uma categoria.
            - orçamento listar: Lista todos os orçamentos.
            - dívida adicionar [valor] [credor] [dataVencimento]: Adiciona uma dívida.
            - dívida listar: Lista todas as dívidas.
            - lembrete adicionar [descrição] [data]: Adiciona um lembrete.
            - lembrete listar: Lista todos os lembretes.
            - historico [tipo] [categoria] [dataInicio] [dataFim]: Mostra o histórico de transações.
            - excluir [número(s)]: Exclui transações específicas.
            - excluir tudo: Exclui todas as transações.
            - excluir dia [data]: Exclui transações de um dia específico.
            - excluir periodo [dataInicio] [dataFim]: Exclui transações de um período específico.
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
        ]
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

// Função fallback para interpretação manual
function interpretarMensagemManual(texto) {
  console.log("Usando fallback manual para interpretar a mensagem...");
  const palavras = texto.toLowerCase().split(' ');
  const valorMatch = texto.match(/\d+/);
  const valor = valorMatch ? parseFloat(valorMatch[0]) : null;
  // Mapeamento de palavras-chave para categorias
  const categorias = {
    táxi: 'Transporte',
    uber: 'Transporte',
    comida: 'Alimentação',
    restaurante: 'Alimentação',
    salário: 'Salário',
    netflix: 'Assinaturas',
    spotify: 'Assinaturas',
    mercado: 'Compras',
    supermercado: 'Compras',
    transporte: 'Transporte',
    alimentação: 'Alimentação',
    compras: 'Compras',
    assinatura: 'Assinaturas',
    blusa: 'Vestuário',
    roupa: 'Vestuário',
    camiseta: 'Vestuário',
    calça: 'Vestuário',
    sapato: 'Vestuário'
  };
  let categoria = 'Outros';
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
    // Log completo da mensagem para depuração
    console.log("Mensagem recebida (detalhes):", JSON.stringify(msg, null, 2));

    // Verifica se a mensagem é de origem permitida
  const isGrupoPermitido = msg.key.remoteJid === GRUPO_ID;
  const isConversaPermitida = NUMEROS_PERMITIDOS.includes(msg.key.remoteJid);

  if (!isGrupoPermitido && !isConversaPermitida) {
    console.log("Mensagem ignorada (origem não permitida)");
    return;
  }

    // Obtém informações de nome e direção
  let origem = '';
  let direcao = '';
  let destinatario = '';

  if (msg.key.remoteJid.endsWith('@g.us')) {
    // Mensagem de grupo
    origem = await getGroupName(sock, msg.key.remoteJid);
    direcao = msg.key.fromMe ? 'enviada' : 'recebida';
    destinatario = msg.key.fromMe ? origem : 'Você';
  } else {
    // Mensagem privada
    origem = await getContactName(sock, msg.key.remoteJid);
    direcao = msg.key.fromMe ? 'enviada para' : 'recebida de';
    destinatario = msg.key.fromMe ? await getContactName(sock, msg.key.remoteJid) : 'Você';
  }

   // Captura o texto da mensagem
   let texto = '';
   if (msg.message?.conversation) {
     // Mensagem de texto simples
     texto = msg.message.conversation;
   } else if (msg.message?.extendedTextMessage?.text) {
     // Mensagem de texto estendida
     texto = msg.message.extendedTextMessage.text;
   } else {
     // Outros tipos de mensagem (mídia, etc.)
     texto = "Sem texto";
   }

   // Converte o texto para minúsculas e remove espaços em branco
  texto = texto.toLowerCase().trim();
  
    // Formata o log
  console.log(`
    --------------------------------------------------
    Mensagem ${direcao}: ${origem}
    ${msg.key.fromMe ? 'Para' : 'De'}: ${destinatario}
    Remetente: ${msg.pushName || "Usuário"}
    Timestamp: ${msg.messageTimestamp}
    Mensagem: ${texto}
    --------------------------------------------------`);
    
      // Ignora apenas mensagens que começam com "⌫" (respostas automáticas do bot)
  if (texto.startsWith("⌫")) {
    console.log("Mensagem ignorada (resposta automática do bot).");
    return;
  }

    // Ignora apenas mensagens que começam com "⌫" (respostas automáticas do bot)
    if (msg.message?.conversation?.startsWith("⌫")) {
      console.log("Mensagem ignorada (resposta automática do bot).");
      return;
    }

    // Verifica se a mensagem é do tipo 'conversation' (texto)
    if (!msg.message?.conversation) {
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

  const remetente = msg.pushName || "Usuário";

  if (ultimoComandoProcessado === texto) return;
  ultimoComandoProcessado = texto;

  console.log("Texto da mensagem:", texto);

    // Verifica se a mensagem é "ajuda"
    if (texto === "ajuda") {
      await sock.sendMessage(GRUPO_ID, { text: LISTA_DE_COMANDOS });
      return; // Encerra o processamento da mensagem
    }

    // Registra a mensagem no log se for de um número permitido
  if (isConversaPermitida) {
    const logMessage = `${direcao}: De ${remetente} para ${destinatario} - "${texto}"`;
    await registrarLog(logMessage);
  }

    try {
      // Interpreta a mensagem usando o OpenRouter
      console.log("Iniciando interpretação da mensagem...");
      const interpretacao = await interpretarMensagemComOpenRouter(texto);
      
      if (!interpretacao) {
        console.log("Não foi possível interpretar a mensagem.");
        await sock.sendMessage(GRUPO_ID, { text: "⌫ Não entendi a mensagem. Use 'ajuda' para ver a lista de comandos." });
        return;
      }

      const { comando, parametros } = interpretacao;
      console.log("Comando interpretado:", comando);
      console.log("Parâmetros interpretados:", parametros);

      // Processa o comando
      switch (comando) {
        case 'resumo':
          console.log("Processando comando 'resumo'...");
          const resumo = await axios.get(`${WEB_APP_URL}?action=resumo`);
          await sock.sendMessage(GRUPO_ID, { text: resumo.data });
          break;
        case 'poupança':
          console.log("Processando comando 'poupança'...");
          const valorPoupanca = parametros.valor;
          await axios.get(`${WEB_APP_URL}?action=adicionarPoupanca&valor=${valorPoupanca}&remetente=${remetente}`);
          await sock.sendMessage(GRUPO_ID, { text: `✓ R$ ${valorPoupanca} transferidos para a poupança.` });
          break;
        case 'entrada':
          console.log("Processando comando 'entrada'...");
          const valorEntrada = parametros.valor;
          await axios.get(`${WEB_APP_URL}?action=entrada&valor=${valorEntrada}&remetente=${remetente}`);
          await sock.sendMessage(GRUPO_ID, { text: `✓ Entrada de R$ ${valorEntrada} registrada por ${remetente}.` });
          break;
        case 'saída':
          console.log("Processando comando 'saída'...");
          const valorSaida = parametros.valor;
          const categoriaSaida = parametros.categoria;
          await axios.get(`${WEB_APP_URL}?action=saída&valor=${valorSaida}&categoria=${categoriaSaida}&remetente=${remetente}`);
          await sock.sendMessage(GRUPO_ID, { text: `✓ Saída de R$ ${valorSaida} registrada na categoria "${categoriaSaida}" por ${remetente}.` });
          break;
        case 'média':
          console.log("Processando comando 'média'...");
          const media = await axios.get(`${WEB_APP_URL}?action=mediaEntradas`);
          await sock.sendMessage(GRUPO_ID, { text: media.data });
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
            await sock.sendMessage(GRUPO_ID, { text: "⌫ Erro: Dados do gráfico inválidos." });
            return;
          }
          // Gera o gráfico
          try {
            const image = await gerarGrafico(tipoGrafico, dados);
            await sock.sendMessage(GRUPO_ID, { image: image, caption: `📊 ${dados.titulo}` });
          } catch (error) {
            console.error("Erro ao gerar o gráfico:", error);
            await sock.sendMessage(GRUPO_ID, { text: `⌫ Erro ao gerar o gráfico: ${error.message}` });
          }
          break;
        case 'categoria adicionar':
          console.log("Processando comando 'categoria adicionar'...");
          const nomeCategoria = parametros.nome;
          await axios.get(`${WEB_APP_URL}?action=adicionarCategoria&categoria=${nomeCategoria}`);
          await sock.sendMessage(GRUPO_ID, { text: `✅ Categoria "${nomeCategoria}" adicionada com sucesso.` });
          break;
        case 'listar categorias':
          console.log("Processando comando 'listar categorias'...");
          const responseCategorias = await axios.get(`${WEB_APP_URL}?action=listarCategorias`);
          const categorias = responseCategorias.data.categorias;
          if (categorias.length === 0) {
            await sock.sendMessage(GRUPO_ID, { text: "📝 Nenhuma categoria cadastrada." });
          } else {
            const listaCategorias = categorias.map((cat, index) => `${index + 1}. ${cat}`).join('\n');
            await sock.sendMessage(GRUPO_ID, { text: `📝 Categorias cadastradas:\n${listaCategorias}` });
          }
          break;
        case 'dívida adicionar':
          console.log("Processando comando 'dívida adicionar'...");
          const valorDivida = parametros.valor;
          const credor = parametros.credor;
          const dataVencimento = parametros.dataVencimento;
          await axios.get(`${WEB_APP_URL}?action=adicionarDivida&valor=${valorDivida}&credor=${credor}&dataVencimento=${dataVencimento}`);
          await sock.sendMessage(GRUPO_ID, { text: `✓ Dívida de R$ ${valorDivida} adicionada com ${credor}, vencendo em ${dataVencimento}.` });
          break;
        case 'dívida listar':
          console.log("Processando comando 'dívida listar'...");
          const responseDividas = await axios.get(`${WEB_APP_URL}?action=listarDividas`);
          const dividas = responseDividas.data.dividas;
          if (dividas.length === 0) {
            await sock.sendMessage(GRUPO_ID, { text: "📝 Nenhuma dívida cadastrada." });
          } else {
            const listaDividas = dividas.map(d => `${d.id}. ${d.credor}: R$ ${d.valor} (Vencimento: ${d.vencimento})`).join('\n');
            await sock.sendMessage(GRUPO_ID, { text: `📝 Dívidas:\n${listaDividas}` });
          }
          break;
        case 'lembrete adicionar':
          console.log("Processando comando 'lembrete adicionar'...");
          const descricaoLembrete = parametros.descricao;
          const dataLembrete = parametros.data;
          await axios.get(`${WEB_APP_URL}?action=adicionarLembrete&descricao=${descricaoLembrete}&data=${dataLembrete}`);
          await sock.sendMessage(GRUPO_ID, { text: `✓ Lembrete "${descricaoLembrete}" adicionado para ${dataLembrete}.` });
          break;
        case 'lembrete listar':
          console.log("Processando comando 'lembrete listar'...");
          const responseLembretes = await axios.get(`${WEB_APP_URL}?action=listarLembretes`);
          const lembretes = responseLembretes.data.lembretes;
          if (lembretes.length === 0) {
            await sock.sendMessage(GRUPO_ID, { text: "📝 Nenhum lembrete cadastrado." });
          } else {
            const listaLembretes = lembretes.map(l => `${l.id}. ${l.descricao} (${l.data})`).join('\n');
            await sock.sendMessage(GRUPO_ID, { text: `📝 Lembretes:\n${listaLembretes}` });
          }
          break;
        case 'orçamento definir':
          console.log("Processando comando 'orçamento definir'...");
          const categoriaOrcamento = parametros.categoria;
          const valorOrcamento = parametros.valor;
          await axios.get(`${WEB_APP_URL}?action=definirOrcamento&categoria=${categoriaOrcamento}&valor=${valorOrcamento}`);
          await sock.sendMessage(GRUPO_ID, { text: `✓ Orçamento de R$ ${valorOrcamento} definido para a categoria "${categoriaOrcamento}".` });
          break;
        case 'orçamento listar':
          console.log("Processando comando 'orçamento listar'...");
          const responseOrcamentos = await axios.get(`${WEB_APP_URL}?action=listarOrcamentos`);
          await sock.sendMessage(GRUPO_ID, { text: responseOrcamentos.data });
          break;
        case 'historico':
          console.log("Processando comando 'historico'...");
          const tipoFiltro = parametros.tipo || "todos";
          const categoriaFiltro = parametros.categoria || "";
          const dataInicio = parametros.dataInicio || "";
          const dataFim = parametros.dataFim || "";
          const responseHistorico = await axios.get(`${WEB_APP_URL}?action=historico&tipo=${tipoFiltro}&categoria=${categoriaFiltro}&dataInicio=${dataInicio}&dataFim=${dataFim}`);
          const historico = responseHistorico.data.historico;
          if (historico.length === 0) {
            await sock.sendMessage(GRUPO_ID, { text: "📊 Nenhuma transação encontrada com os filtros aplicados." });
          } else {
            let mensagem = "📊 Histórico de transações:\n";
            historico.forEach(transacao => {
              const emoji = transacao.tipo.toLowerCase() === "entrada" ? "✓" : "⌫";
              mensagem += `${transacao.id} - ${emoji} ${transacao.data} - ${transacao.tipo}: ${transacao.categoria} - R$ ${transacao.valor}\n`;
            });
            await sock.sendMessage(GRUPO_ID, { text: mensagem });
          }
          break;
        case 'excluir':
          console.log("Processando comando 'excluir'...");
          // Ajusta o parâmetro para o formato esperado pelo Google Apps Script
          const parametroExcluir = parametros.números ? parametros.números.join(",") : parametros.parametro;
          const responseExcluir = await axios.get(`${WEB_APP_URL}?action=excluirTransacao&parametro=${encodeURIComponent(parametroExcluir)}`);
          await sock.sendMessage(GRUPO_ID, { text: responseExcluir.data });
          break;
        default:
          console.log("Comando não reconhecido.");
          await sock.sendMessage(GRUPO_ID, { text: "⌫ Comando não reconhecido. Use 'ajuda' para ver a lista de comandos." });
      }
    } catch (error) {
      console.error("Erro ao processar a transação:", error);
      await sock.sendMessage(GRUPO_ID, { text: `⌫ Erro: ${error.message}` });
    }
  });
}

// Inicia o servidor e o bot
app.listen(3000, () => console.log("Servidor rodando!"));
iniciarBot();