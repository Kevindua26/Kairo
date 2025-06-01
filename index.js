const { DisconnectReason, useMultiFileAuthState} = require('baileys');
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const express = require('express');
const app = express();
const path = require('path');
const makeWASocket = require('baileys').default;

// importing api key from GeminiAPI.js
const apiKey = require('./GeminiAPI').apiKey;
const ai = new GoogleGenAI({ apiKey: apiKey });

async function resetConnection() {
  const authPath = path.join(__dirname, 'auth_info_baileys');
  
  // Delete the auth directory
  if (fs.existsSync(authPath)) {
    fs.rmSync(authPath, { recursive: true, force: true });
    console.log('Authentication state reset. Restarting connection...');
  }

  // Restart the connection logic
  connectionLogic();
}

async function connectionLogic() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const sock = makeWASocket({
    // can provide additional config here
    printQRInTerminal: true,
    auth: state,
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update || {};

    if (qr) {
      console.log(qr);
      //write custom logic here
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;

      if (shouldReconnect) {
        connectionLogic();
      }
    }
  });

  sock.ev.on('messages.upsert', (messageInfoUpsert) => {
    resolvingMessageUpsert(messageInfoUpsert, sock);
  });

  sock.ev.on('creds.update', saveCreds);
}

async function resolvingMessageUpsert(meesageInfoUpsert, sock) {
  const message = meesageInfoUpsert.messages[0];
  const remoteJid = message.key.remoteJid;
  const pushName = message.pushName;

  // Check if the message contains extendedTextMessage
  const text = message.message?.extendedTextMessage?.text || message.message?.conversation;

  if (!text) {
    console.log('Message type not supported or no text found.');
    return;
  }
  
  const banWords = [
    "Fuck",
    "motherfucker",
    "bc",
    "behenchod",
    "bhenchod",
    "behnchod",
    "chutiya",
    "bsdk",
    "bhosdike",
    "madarchod",
    "gandu",
    "gand",
    "gand mara",
    "gand marao",
    "lodu",
    "lund"
  ]
  if(await banWordsAlert(banWords, text, remoteJid, sock, message)) return;

  // /ask <your message>
  const genAICommand = text.match(/^\/ask\s+(.+)/i);
  if (genAICommand) {
    const kairoprompt = `Consider you as Kairo, a helpful AI assistant. Respond to the user's query in a friendly and informative manner. The user will ask you questions or give you commands, and you should respond accordingly. If user asks for help, tell him to use /help command for Kairo's menu. If user 'ask who are you' then reply with the name 'Kairo' and tell him that you are a helpful AI assistant, designed by Kevin. Now the user: ${pushName}, will ask you from next line.`;
    const commandText = genAICommand[1]; // This will contain the text after "Kairo "

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `"${kairoprompt}\n\n${commandText}"`,
    });
    let replyText = response.text;
    console.log(`AI Response: ${replyText}`);

    await sock.sendMessage(remoteJid, { text: `${replyText}`}, { quoted: message });

    return;
  }

  // /help
  if (text === '/help') {
    await sock.sendMessage(
      remoteJid, 
      { 
        text: `Hello ${pushName}, I'm Kairo! 🤖\nHere are the commands you can use:\n\n1. 📖*/help* - Show this help message\n2. 🤖*/ask <your message>* - Generate a response using AI\n3. 📤*Kairo spam "message" <number>* - Spam a message a specified number of times (up to 20)\n4. 👋*Kairo* - Reply with a greeting\n` 
      },
      { 
        quoted: message 
      }
    );

    return;
  }

  // Kairo spam "message" <number>
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const spamMatch = text.match(/^Kairo spam "(.+)" (\d+)$/i);
  if (spamMatch) {
    const spamMessage = spamMatch[1]; // Extract the message inside quotes
    const spamCount = parseInt(spamMatch[2], 10); // Extract the number of times to spam

    if (spamCount > 0 && spamCount <= 20) {
      await react('🙇🏼‍♂️', remoteJid, sock, message);
      for (let i = 0; i < spamCount; i++) {
        await sock.sendMessage(remoteJid, { text: spamMessage });
        await sleep(500); // Add 500ms delay after each message
      }
    } else {
      console.log('Invalid spam count.');
      await sock.sendMessage(remoteJid, { text: `Sorry, I cann't spam it more than 20 😔` }, { quoted: message });
    }

    return;
  }

  // Kairo
  if (text === 'Kairo') {
    // await react('❤️', remoteJid, sock, message);
    await sock.sendMessage(remoteJid, { text: `Hi 👋🏻, I'm here for you ${pushName}! \n📋 /help to show menu` }, { quoted: message });
    return;
  }
  if (/thanks kairo/i.test(text)) {
    await react('❤️', remoteJid, sock, message);
    return;
  }

  // React to specific messages
  // const reactOnMessages = [
  //   'Thanks Kairo', 'Thanks kairo', 'thanks kairo', 'thanks Kairo'
  // ];
  // if (reactOnMessages.includes(text)) {
  //   await react('❤️', remoteJid, sock, message);
  // }

  

  console.log([remoteJid, pushName, text]);
}

async function banWordsAlert(banWords, text, remoteJid, sock, message) {
  const regex = new RegExp(`\\b(${banWords.join('|')})\\b`, 'i');
  
  if (regex.test(text)) {
    // Reply to the message
    await react('🖕', remoteJid, sock, message);
    await sock.sendMessage(remoteJid, { text: `⚠️Warning⚠️ \n${message.pushName}, you aren't allowed to use this word.`}, { quoted: message });
    
    return true;
  }
}

async function react(emoji, remoteJid, sock, message) {
  const reactionMessage = {
    react: {
      text: `${emoji}`, // use an empty string to remove the reaction
      key: message.key,
    },
  };
  await sock.sendMessage(remoteJid, reactionMessage);
}

// resetConnection();
connectionLogic();
