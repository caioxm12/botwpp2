const axios = require('axios');

const OPENROUTER_API_KEY = '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'; // Substitua pela sua chave de API

async function testarAPI() {
  try {
    const resposta = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'deepseek/deepseek-r1:free',
        messages: [
          {
            role: 'user',
            content: 'Interpretar a seguinte mensagem como uma transação financeira: "Comprei uma blusa por 65 reais". Retorne um JSON com "valor", "categoria" e "tipo" (Entrada ou Saída).'
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

    // Exibe a resposta completa da API
    console.log("Resposta da API:", JSON.stringify(resposta.data, null, 2));

    // Acessa o conteúdo da mensagem
    const mensagem = resposta.data.choices[0].message.content;
    console.log("Conteúdo da mensagem:", mensagem);
  } catch (erro) {
    console.error("Erro ao testar a API:", erro.response ? erro.response.data : erro.message);
  }
}

testarAPI();