const { create } = require('@wppconnect-team/wppconnect');
const path = require('path');

const respostaTexto = `Posso estar Viajando, ou não.

Posso estar em Reunião, ou não.

Deixe o motivo do seu contato e respondo assim que possível.`;

const contatosImagem = new Set([
  '559199790260@c.us', // sua mãe
  '559181858191@c.us', // novo número
]);

const ultimoEnvio = {};

function imagemAleatoria() {
  const n = Math.floor(Math.random() * 7) + 1;
  return path.resolve(__dirname, `image/${n}.jpg`);
}

console.log('Iniciando WPPConnect...');

create({
  session: 'bot-session',
  multidevice: true
}).then(client => {
  console.log('✅ Bot iniciado! Escaneie o QR code no console.');

  client.onMessage(async message => {
    console.log(`\n[LOG] Nova mensagem de ${message.from}: ${message.body}`);

    if (message.from.endsWith('@g.us')) {
      console.log('[LOG] Ignorando grupo.');
      return;
    }

    const contatos = await client.getAllContacts();
    const contatosSalvos = new Set(contatos.map(c => c.id._serialized));
    const isSalvo = contatosSalvos.has(message.from);
    console.log(`[LOG] Contato salvo? ${isSalvo}`);

    if (!isSalvo) {
      console.log('[LOG] Ignorando não salvo.');
      return;
    }

    const agora = Date.now();
    const ultimo = ultimoEnvio[message.from];
    if (ultimo && agora - ultimo < 2 * 60 * 60 * 1000) {
      const minutes = ((agora - ultimo) / 1000 / 60).toFixed(1);
      console.log(`[LOG] Mensagem enviada há ${minutes} min — pulando.`);
      return;
    }

    try {
      if (contatosImagem.has(message.from)) {
        const imgPath = imagemAleatoria();
        await client.sendImage(message.from, imgPath, path.basename(imgPath), '');
        console.log(`[LOG] Enviou imagem (${imgPath}) para contato VIP (${message.from}).`);
      } else {
        await client.sendText(message.from, respostaTexto);
        console.log(`[LOG] Enviou texto para ${message.from}.`);
      }
      ultimoEnvio[message.from] = agora;
    } catch (err) {
      console.error(`[ERRO] Falha ao enviar para ${message.from}:`, err);
    }
  });
}).catch(err => console.error('[ERRO] Falha ao iniciar o bot:', err));
