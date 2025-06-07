require('dotenv').config();

const { DisconnectReason, useMultiFileAuthState} = require('baileys');
const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const express = require('express');
const app = express();
const path = require('path');
const makeWASocket = require('baileys').default;

// importing api key
const apiKey = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: apiKey });

const port = 3000;

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
      } else if (connection == 'open') {
        console.log('Already connected');
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
  const participant = message.key.participant;
  const pushName = message.pushName;

  // console.log([message, remoteJid, pushName]);

  // Check if the message contains extendedTextMessage
  const text = message.message?.extendedTextMessage?.text || message.message?.conversation;
  const emoji = message.message?.reactionMessage?.text || message.message?.reactionMessage?.key?.remoteJid;
  const sticker = message.message?.stickerMessage?.mimetype;
  const audio = message.message?.audioMessage?.mimetype;
  const image = message.message?.imageMessage?.mimetype;
  const video = message.message?.videoMessage?.mimetype;
  const caption = message.message?.imageMessage?.caption || message.message?.videoMessage?.caption;
  const document = message.message?.documentMessage?.mimetype;
  
  if (text) {
    console.log([participant, pushName, text]);

  } else if (emoji) {
    console.log([participant, pushName, emoji]);

  } else if (sticker) {
    console.log([participant, pushName, `Sticker`, sticker]);
    return;

  } else if (audio) {
    console.log([participant, pushName, `Audio`, audio]);
    return;

  } else if (image) {
    console.log([participant, pushName, `Image`, image, caption]);
    return;

  } else if (video) {
    console.log([participant, pushName, `Video`, video, caption]);
    return;

  } else if (document) {
    console.log([participant, pushName, `Document`, document]);
    return;

  } else {
    console.log([participant, pushName, `Unknown message type`]);
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
    "chutiye",
    "bsdk",
    "bhosdike",
    "madarchod",
    "gandu",
    "gand",
    "gand mara",
    "gand marao",
    "lode",
    "lodu",
    "lund",
    "chut",
    "randi"
  ]
  // if(await banWordsAlert(banWords, text, remoteJid, sock, message)) return;

  // /tag
  if (text == '/tag') {
    await tagAll(remoteJid, message, sock);
    return;
  }

  // /ask <your message>
  const askCommand = text.match(/^\/ask\s+(.+)/i);
  if (askCommand) {
    const kairoPrompt = `Consider you as Kairo, a helpful AI assistant. 
      Respond to the user's query in a friendly and informative manner. 
      The user will ask you questions or give you commands, and you should respond accordingly. 
      If user asks for help, tell him to use /help command for Kairo's menu. 
      If user 'ask who are you' then reply with the name 'Kairo' and tell him that you are a helpful AI assistant, designed by Kevin. 
      Hence you a project made by Kevin, the github link is https://www.github.com/Kevindua26/Kairo, don't provide link until user asks. 
      Now the user: ${pushName}, will ask you from next line.`;

    const commandText = askCommand[1]; // This will contain the text after "Kairo "

    try {
      await react('🤖', remoteJid, sock, message);
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: `"${kairoPrompt}\n\n${commandText}"`,
      });
      let replyText = response.text;
      console.log(`AI Response: ${replyText}`);
    
      await sock.sendMessage(remoteJid, { text: `${replyText}`}, { quoted: message }, { disappearingMessagesInChat: true });

    } catch (err) {
      console.error('Error generating AI response: ', err);
      await sock.sendMessage(remoteJid, { text: `Server Overloaded!, try again later` }, { quoted: message }, { disappearingMessagesInChat: true });
    }
    return;
  }

  // /help
  if (text === '/help') {
    await sock.sendMessage(
      remoteJid, 
      { text: `Hello ${pushName}, I'm Kairo! 🤖\nHere are the commands you can use:\n\n1. 📖 */help* - Show this help message\n2. 🤖 */ask <your message>* - Generate a response using AI\n3. 🏷️ */tag* - Mention all group members (only works in groups) \n4. 📤 */spam "message" <number>* - Spam a message a specified number of times (up to 20)\n5. 👋 *Kairo* - Reply with a greeting\n` },
      { quoted: message },
      { disappearingMessagesInChat: true } // Enable disappearing messages in chat
    );

    return;
  }

  // /spam "message" <number>
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  const spamMatch = text.match(/^\/spam "(.+)" (\d+)$/i);
  if (spamMatch) {
    let spamMessage = spamMatch[1]; // Extract the message inside quotes
    const spamCount = parseInt(spamMatch[2], 10); // Extract the number of times to spam

    // Check for mention pattern in the spam message
    const mentionMatch = spamMessage.match(/@(\d{10,})/); // e.g., @919912345678
    let mentions = [];
    if (mentionMatch) {
      const mentionId = mentionMatch[1] + "@s.whatsapp.net";
      mentions = [mentionId];
      // Replace @number in text with WhatsApp mention format
      spamMessage = spamMessage.replace(
        /@(\d{10,})/,
        `@${mentionMatch[1]}`
      );
    }
    
    if (spamCount > 0 && spamCount <= 20) {
      await react('🙇🏼‍♂️', remoteJid, sock, message);
      for (let i = 0; i < spamCount; i++) {
        await sock.sendMessage(remoteJid, { text: spamMessage, mentions }, { disappearingMessagesInChat: true });
        await sleep(1000); // Add 1000ms delay after each message
      }
    } else {
      console.log('Invalid spam count.');
      await sock.sendMessage(remoteJid, { text: `Sorry, I cann't spam it more than 20 😔` }, { quoted: message });
    }

    return;
  }

  // Kairo
  if (text === 'Kairo' || text === 'kairo' || text === 'KAIRO') {
    // await react('❤️', remoteJid, sock, message);
    await sock.sendMessage(
      remoteJid, 
      { text: `Hi 👋🏻, I'm here for you ${pushName}! \n📋 /help to show menu` }, 
      { quoted: message },
      { disappearingMessagesInChat: true } // Enable disappearing messages in chat
    );
    return;
  }

  // React to specific messages
  // const reactOnMessages = [
  //   'Thanks Kairo', 'Thanks kairo', 'thanks kairo', 'thanks Kairo'
  // ];
  // if (reactOnMessages.includes(text)) {
  //   await react('❤️', remoteJid, sock, message);
  // }

  const appreciatingWords = [
    "thanks kairo",
    "thanku kairo",
    "thank you kairo",
    "thank you so much kairo",
    "tysm kairo",
    "good bot",
    "good job kairo",
    "well done kairo",
    "appreciate you kairo",
    "appreciate it kairo",
  ];
  if(await appreciationWordReact(appreciatingWords, text, remoteJid, sock, message)) return;

}

async function tagAll(remoteJid, message, sock) {
  try {
    // Only works in groups
    if (!remoteJid.endsWith('@g.us')) {
      await sock.sendMessage(remoteJid, { text: "This command only works in groups." }, { quoted: message }, { disappearingMessagesInChat: true });
      return;
    }
    
    await react('🙇🏼‍♂️', remoteJid, sock, message);

    const groupMetadata = await sock.groupMetadata(remoteJid);
    const participants = groupMetadata.participants;
    // Exclude the sender from mentions
    const senderId = message.key.participant || message.key.remoteJid;
    const mentionIds = participants
      .map(p => p.id)
      .filter(id => id !== senderId);

    // Build the mention message
    const mentionText = mentionIds.map(id => `@${id.split('@')[0]}`).join(' ');

    await sock.sendMessage(
      remoteJid,
      {
        text: `${mentionText}`,
        mentions: mentionIds
      },
      { quoted: message }
    );
  } catch (err) {
    console.error('Error in /tag:', err);
    await sock.sendMessage(remoteJid, { text: "Failed to tag everyone." }, { quoted: message });
  }
  return;
};

async function banWordsAlert(banWords, text, remoteJid, sock, message) {
  const regex = new RegExp(`\\b(${banWords.join('|')})\\b`, 'i');
  
  if (regex.test(text)) {
    // Reply to the message
    await react('🚫', remoteJid, sock, message);
    await sock.sendMessage(
      remoteJid, 
      { text: `⚠️ Warning, \n${message.pushName} you aren't allowed to use this word.`}, 
      { quoted: message },
      { disappearingMessagesInChat: true }
    );
    
    return true;
  }
}

async function appreciationWordReact(appreciatingWords, text, remoteJid, sock, message) {
  const regex = new RegExp(`\\b(${appreciatingWords.join('|')})\\b`, 'i');
  
  if (regex.test(text)) {
    // Reply to the message
    await react('❤️', remoteJid, sock, message);
    
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
// connectionLogic();



// Express server to keep the process alive
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.listen(port, () => {
  console.log(`\nServer is running on port ${port}\nVisit http://localhost:${port} to check if Kairo is running.\n\n`);

  connectionLogic();
});

app.get('/', (req, res) => {
  res.send('Kairo is running!');
});
