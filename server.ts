import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import http from "http";

dotenv.config();

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(express.json());

  // WebSocket Proxy for Gemini Live
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (clientWs, request) => {
    const rawApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY;
    const apiKey = rawApiKey?.trim();
    
    if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
      console.error("Live Proxy: Gemini API Key missing or invalid in environment.");
      clientWs.close(1011, "Server API Key not properly configured");
      return;
    }

    // Alerta no console do servidor para ajudar o desenvolvedor a identificar se a chave parece correta
    const maskedKey = `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`;
    console.log(`Live Proxy connecting with key: ${maskedKey} (length: ${apiKey.length})`);

    if (!apiKey.startsWith('AIza')) {
       console.warn("Live Proxy: API Key does not start with AIza. This is likely an invalid key.");
    }

    // Connect to Google Gemini Live API
    // The client sends the query params, we add the API Key
    const url = new URL(request.url!, `http://${request.headers.host}`);
    const targetUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidirectionalGenerateContent?key=${apiKey}`;
    
    const googleWs = new WebSocket(targetUrl);

    googleWs.on('open', () => {
      console.log("Connected to Google Gemini Live API");
    });

    googleWs.on('message', (data) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data);
      }
    });

    clientWs.on('message', (data) => {
      if (googleWs.readyState === WebSocket.OPEN) {
        googleWs.send(data);
      }
    });

    googleWs.on('close', () => clientWs.close());
    clientWs.on('close', () => googleWs.close());
    googleWs.on('error', (err) => console.error("Google WS Error:", err));
    clientWs.on('error', (err) => console.error("Client WS Error:", err));
  });

  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url!, `http://${request.headers.host}`);
    if (pathname === '/api/live') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  // API Route for Text Translation (Server-Side)
  app.post("/api/translate", async (req, res) => {
    try {
      const { text, targetLanguage } = req.body;
      const rawApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY;
      const apiKey = rawApiKey?.trim();

      if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
        console.error("Translate API: Key missing.");
        return res.status(500).json({ error: "Gemini API Key missing or invalid on server." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({ 
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: "Você é um tradutor expert. Retorne apenas a tradução direta para o idioma solicitado, sem comentários extras."
        },
        contents: [{ role: "user", parts: [{ text: `Traduza o seguinte texto para ${targetLanguage}: "${text}"` }] }]
      });

      const translation = response.text || "Erro na tradução.";
      res.json({ translation });
    } catch (error: any) {
      console.error("Translation error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { text, history, targetLanguage } = req.body;
      const rawApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.GOOGLE_API_KEY;
      const apiKey = rawApiKey?.trim();

      if (!apiKey || apiKey === 'undefined' || apiKey === 'null') {
        console.error("Chat API: Key missing.");
        return res.status(500).json({ error: "Gemini API Key missing or invalid on server." });
      }

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({ 
        model: "gemini-3-flash-preview",
        config: {
          systemInstruction: `Você é um assistente poliglota inteligente que alterna entre tradutor e chat geral.
            CONTEXTO ATUAL: O usuário quer traduções para ${targetLanguage}.
            OBJETIVO:
            - Se o input for texto para traduzir: forneça apenas a tradução impecável.
            - Se o input for uma pergunta ou conversa: saia do modo tradutor e responda como um assistente (ChatGPT).
            - Mantenha o histórico (contexto). Se ele perguntar algo e depois voltar a traduzir, lembre-se do que foi dito.`
        },
        contents: [
          ...history,
          { role: "user", parts: [{ text }] }
        ]
      });
      
      const translation = response.text || "Sem resposta do assistente.";
      res.json({ translation });
    } catch (error: any) {
      console.error("Chat error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Endpoint to check if server-side key is available (without exposing it)
  app.get("/api/status", (req, res) => {
    res.json({ 
      hasApiKey: !!process.env.GEMINI_API_KEY,
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
