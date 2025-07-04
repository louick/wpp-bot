const { Boom } = require('@hapi/boom')
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')
const qrcode = require('qrcode-terminal')
const path = require('path')
const fs = require('fs')

// Mensagem padrão
const respostaTexto = `Posso estar Viajando, ou não.
Posso estar em Reunião, ou não.
Deixe o motivo do seu contato e respondo assim que possível.`

// Contatos que recebem imagem aleatória
const contatosImagem = new Set([
  '559199790260@s.whatsapp.net', // mãe
  '559181858191@s.whatsapp.net', // outro número VIP
])

const ultimoEnvio = {} // Controle de tempo por contato

function imagemAleatoria() {
  const n = Math.floor(Math.random() * 7) + 1
  return path.resolve(__dirname, `image/${n}.jpg`)
}

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys')

  const sock = makeWASocket({
    auth: state,
  })

  sock.ev.on('creds.update', saveCreds)

  // Exibe QR code no terminal para login
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      qrcode.generate(qr, { small: true })
      console.log('Escaneie o QR acima com seu WhatsApp!')
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode
      console.log('[LOG] Conexão fechada.', reason)
      startSock()
    } else if (connection === 'open') {
      console.log('[LOG] Bot conectado!')
    }
  })

  // Lida com mensagens recebidas
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const jid = msg.key.remoteJid
    const isGroup = jid.endsWith('@g.us')
    const now = Date.now()

    console.log(`\n[LOG] Mensagem recebida de: ${jid}`)

    // Ignora grupos
    if (isGroup) {
      console.log('[LOG] Grupo, ignorando.')
      return
    }

    // Controle de 2h por contato
    if (ultimoEnvio[jid] && now - ultimoEnvio[jid] < 2 * 60 * 60 * 1000) {
      const min = ((now - ultimoEnvio[jid]) / 1000 / 60).toFixed(1)
      console.log(`[LOG] Já respondeu há ${min} min, ignorando.`)
      return
    }

    try {
      if (contatosImagem.has(jid)) {
        const imgPath = imagemAleatoria()
        const buffer = fs.readFileSync(imgPath)
        await sock.sendMessage(jid, { image: buffer, caption: '' })
        console.log(`[LOG] Enviou imagem aleatória para contato VIP (${jid})`)
      } else {
        await sock.sendMessage(jid, { text: respostaTexto })
        console.log(`[LOG] Enviou mensagem padrão para ${jid}`)
      }
      ultimoEnvio[jid] = now
    } catch (err) {
      console.log(`[ERRO] Falha ao responder para ${jid}:`, err)
    }
  })
}

startSock()
