# 🤖 Kairo - WhatsApp AI Bot

Kairo is a WebSocket-based WhatsApp Chat bot built using [Baileys](https://github.com/WhiskeySockets/Baileys) and powered by [Google's Gemini](https://ai.google.dev/gemini-api/docs). It can respond to commands, generate AI responses, and even spam fun messages responsibly. 

---

## 🚀 Features

- 👋 `Kairo` - Greet the bot and receive a response  
- 🤖 `/ask <message>` - Chat with Gemini AI  
- 📖 `/help` - Get the list of all available commands 
- 📤 `/spam "message" <number>` - Send a message multiple times (limit: 20)

---

## 🧠 Tech Stack

- **Node.js**
- **MongoDB**
- **Baileys (Whiskeysocket)** – WebSocket interface for WhatsApp
- **Google Gemini API** – For intelligent AI responses
- **dotenv** – Environment variable management

---

## 📦 Installation

1. **Clone the repository:**
```bash
git clone https://github.com/Kevindua26/Kairo.git

cd Kairo
```

2. **Install dependencies:**
```bash
npm i
```

3. **Setup your environments:**
Create a `.env` file:
```env
GEMINI_API_KEY=your_google_gemini_api_key
```

4. **Run the BOT:**
```bash 
node index.js
```

---

## ⚠️ DISCLAIMER
This bot is for educational and personal use only. Spamming should be done responsibly and only in private/test groups. Misuse can lead to WhatsApp bans. Always respect the WhatsApp [Terms of Service](https://www.whatsapp.com/legal/terms-of-service).

## 🧑‍💻 Author
Made with 💙 by [Kevin](https://linktr.ee/kevindua26?utm_source=linktree_profile_share&ltsid=a223b61f-5c64-4827-b465-e388f3e07dea)

Contact me - [Linktree](https://linktr.ee/kevindua26?utm_source=linktree_profile_share&ltsid=a223b61f-5c64-4827-b465-e388f3e07dea)