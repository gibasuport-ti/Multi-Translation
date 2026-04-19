import React, { useEffect, useRef, useState, useCallback } from "react";
import { GoogleGenAI, Modality, LiveServerMessage, ThinkingLevel } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  Mic, MicOff, Languages, Volume2, Loader2, Sparkles, Send, 
  Eraser, X, RefreshCw, Lock, Unlock, CreditCard, Settings, Terminal,
  User, UserCircle, Play, Square, ListRestart, HelpCircle
} from "lucide-react";
import { float32ToInt16Base64, base64ToFloat32 } from "../lib/audio-utils";

interface Transcription {
  text: string;
  isModel: boolean;
  id: string;
}

export default function LiveTranslator() {
  const [isActive, setIsActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [transcriptions, setTranscriptions] = useState<Transcription[]>([]);
  const [isModelTalking, setIsModelTalking] = useState(false);
  const [promptValue, setPromptValue] = useState("");
  const [isSendingPrompt, setIsSendingPrompt] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [needsApiKey, setNeedsApiKey] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [sessionStatus, setSessionStatus] = useState<"idle" | "connecting" | "active" | "error">("idle");
  const [targetLanguage, setTargetLanguage] = useState("Português (Brasil)");
  const [theme, setTheme] = useState<"sky" | "dark" | "sunset" | "emerald" | "plasma" | "cyber" | "neon" | "lava">("sky");
  const [isPro, setIsPro] = useState(false);
  const [payLink, setPayLink] = useState(localStorage.getItem("mp_link") || "");
  const [showPaywall, setShowPaywall] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [selectionMenu, setSelectionMenu] = useState<{ text: string, x: number, y: number } | null>(null);

  const themes = {
    sky: {
      bg: "bg-sky-400",
      blobs: ["bg-blue-300", "bg-cyan-400"],
      text: "text-white",
      subtext: "text-blue-50",
      border: "border-white/20",
      glass: "bg-white/10",
      buttonActive: "bg-white text-blue-600",
      chatModel: "bg-blue-50/95 text-blue-900",
      chatUser: "bg-white/15 text-white"
    },
    dark: {
      bg: "bg-neutral-950",
      blobs: ["bg-purple-900/40", "bg-blue-900/40"],
      text: "text-white",
      subtext: "text-neutral-400",
      border: "border-white/10",
      glass: "bg-white/5",
      buttonActive: "bg-white text-neutral-900",
      chatModel: "bg-white/10 text-white",
      chatUser: "bg-blue-500/20 text-blue-100"
    },
    sunset: {
      bg: "bg-orange-500",
      blobs: ["bg-rose-400/50", "bg-amber-300/50"],
      text: "text-white",
      subtext: "text-orange-100",
      border: "border-white/20",
      glass: "bg-white/10",
      buttonActive: "bg-white text-orange-600",
      chatModel: "bg-orange-50/95 text-orange-900",
      chatUser: "bg-white/20 text-white"
    },
    emerald: {
      bg: "bg-emerald-500",
      blobs: ["bg-lime-300", "bg-teal-400"],
      text: "text-white",
      subtext: "text-emerald-50",
      border: "border-white/30",
      glass: "bg-white/15",
      buttonActive: "bg-white text-emerald-600",
      chatModel: "bg-emerald-50 text-emerald-950",
      chatUser: "bg-white/20 text-white"
    },
    plasma: {
      bg: "bg-fuchsia-600",
      blobs: ["bg-indigo-400", "bg-pink-400"],
      text: "text-white",
      subtext: "text-fuchsia-100",
      border: "border-white/30",
      glass: "bg-white/20",
      buttonActive: "bg-white text-fuchsia-700",
      chatModel: "bg-fuchsia-50 text-fuchsia-950",
      chatUser: "bg-black/20 text-white"
    },
    cyber: {
      bg: "bg-cyan-500",
      blobs: ["bg-blue-400", "bg-violet-400"],
      text: "text-white",
      subtext: "text-cyan-50",
      border: "border-white/40",
      glass: "bg-white/20",
      buttonActive: "bg-white text-cyan-700",
      chatModel: "bg-cyan-50 text-cyan-950",
      chatUser: "bg-blue-950/30 text-white"
    },
    neon: {
      bg: "bg-zinc-900",
      blobs: ["bg-lime-400/40", "bg-cyan-400/40"],
      text: "text-lime-300",
      subtext: "text-zinc-500",
      border: "border-lime-400/30",
      glass: "bg-lime-400/10",
      buttonActive: "bg-lime-400 text-black",
      chatModel: "bg-zinc-800 border-lime-400/50 text-lime-100",
      chatUser: "bg-cyan-400/20 border-cyan-400/50 text-cyan-100"
    },
    lava: {
      bg: "bg-red-800",
      blobs: ["bg-orange-600", "bg-yellow-500"],
      text: "text-white",
      subtext: "text-red-200",
      border: "border-white/30",
      glass: "bg-black/20",
      buttonActive: "bg-yellow-400 text-red-900",
      chatModel: "bg-white/90 text-red-950",
      chatUser: "bg-red-400/30 text-white"
    }
  };

  const currentTheme = themes[theme];

  const premiumLanguages = [
    "Inglês",
    "Espanhol",
    "Francês",
    "Alemão",
    "Italiano",
    "Japonês",
    "Chinês (Mandarim)",
    "Russo"
  ];

  const freeLanguage = "Português (Brasil)";
  const languagesList = [freeLanguage, ...premiumLanguages];

  const handleLanguageChange = (lang: string) => {
    if (lang !== freeLanguage && !isPro) {
      setShowPaywall(true);
      return;
    }
    setTargetLanguage(lang);
  };

  const handleSavePayLink = () => {
    localStorage.setItem("mp_link", adminInput);
    setPayLink(adminInput);
    setShowAdmin(false);
  };
  const isActiveRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sessionRef = useRef<any>(null); // GoogleGenAI handles the session
  const transcriptionsEndRef = useRef<HTMLDivElement>(null);
  const audioQueueRef = useRef<Float32Array[]>([]);
  const isPlayingRef = useRef(false);

  const addTranscription = useCallback((input: any, isModel: boolean) => {
    let text = "";
    if (typeof input === "string") {
      text = input;
    } else if (input && typeof input === "object") {
      text = input.text || input.transcription || "";
      if (!text && Array.isArray(input.parts)) {
        text = input.parts.map((p: any) => p.text || "").join(" ");
      }
    }

    const trimmedText = text?.toString().trim();
    if (!trimmedText) return;

    setTranscriptions((prev) => {
      const last = prev[prev.length - 1];
      
      // Smart Merge for consecutive speakers
      if (last && last.isModel === isModel) {
        const lastTxt = last.text.toLowerCase();
        const nextTxt = trimmedText.toLowerCase();

        // 1. Skip duplicates
        if (lastTxt === nextTxt || lastTxt.includes(nextTxt)) return prev;

        // 2. Handle cumulative updates (next contains last)
        if (nextTxt.includes(lastTxt)) {
          return [...prev.slice(0, -1), { ...last, text: trimmedText }];
        }

        // 3. Simple append
        const updated = { 
          ...last, 
          text: (last.text + " " + trimmedText).trim().replace(/\s+/g, " ") 
        };
        return [...prev.slice(0, -1), updated];
      }

      return [
        ...prev,
        { text: trimmedText, isModel, id: Date.now().toString() + Math.random().toString(36).substr(2, 5) }
      ].slice(-50);
    });
  }, []);

  const [currentlySpeaking, setCurrentlySpeaking] = useState<string | null>(null);
  // Mantemos como estado interno mas removemos a UI de troca conforme solicitado
  const [voiceSettings] = useState({
    gender: 'female' as 'female' | 'male',
    voiceIndex: 0, 
    softness: 1.0
  });
  const [pausedMessage, setPausedMessage] = useState<{
    id: string;
    text: string;
    isModel: boolean;
    charIndex: number;
  } | null>(null);
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);
  const currentCharRef = useRef(0);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) setVoices(v);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // Safety Interval: Se o navegador parar de falar mas o estado continuar preso
    const interval = setInterval(() => {
      if (!window.speechSynthesis.speaking && currentlySpeaking !== null) {
        setCurrentlySpeaking(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentlySpeaking]);

  const speakText = (text: string, isModel: boolean, msgId: string, fromIndex: number = 0, isInternal: boolean = false) => {
    if (!('speechSynthesis' in window)) {
      setErrorMsg("Seu navegador não suporta viva voz.");
      return;
    }

    // Se clicar no botão principal (não interno) enquanto está falando algo
    if (currentlySpeaking !== null && !isInternal) {
      window.speechSynthesis.resume(); // Workaround para browsers que travam no cancel()
      window.speechSynthesis.cancel();
      if (currentlySpeaking === msgId) {
        setPausedMessage({ id: msgId, text, isModel, charIndex: currentCharRef.current });
      }
      setCurrentlySpeaking(null);
      return;
    }

    // Se clicar no botão principal enquanto está pausado, o menu já é visível.
    if (pausedMessage?.id === msgId && !isInternal) {
      return;
    }

    try {
      window.speechSynthesis.resume(); // Workaround 
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text.substring(fromIndex));
      let targetLangCode = "pt-BR";
      
      if (isModel) {
        const langMap: Record<string, string> = {
          "Inglês": "en-US",
          "Espanhol": "es-ES",
          "Francês": "fr-FR",
          "Alemão": "de-DE",
          "Italiano": "it-IT",
          "Japonês": "ja-JP",
          "Português (Brasil)": "pt-BR",
          "Chinês (Mandarim)": "zh-CN",
          "Russo": "ru-RU"
        };
        targetLangCode = langMap[targetLanguage] || "en-US";
      }

      utterance.lang = targetLangCode;
      
      const filteredVoices = voices.filter(v => v.lang.startsWith(targetLangCode.split('-')[0]));
      
      const genderKeywords = voiceSettings.gender === 'female' 
        ? ['natural', 'online', 'premium', 'google', 'helena', 'francisca', 'victoria', 'samantha', 'maria', 'zira', 'female']
        : ['natural', 'online', 'premium', 'google', 'ricardo', 'antonio', 'daniel', 'felipe', 'david', 'male'];

      // Prioriza vozes "Natural", "Online" ou "Premium" que são neurais e de altíssima qualidade
      const candidates = filteredVoices
        .filter(v => genderKeywords.some(kw => v.name.toLowerCase().includes(kw)))
        .sort((a, b) => {
          const aLower = a.name.toLowerCase();
          const bLower = b.name.toLowerCase();
          // Vozes "Online" ou "Natural" costumam ser as melhores (neurais)
          const aScore = (aLower.includes('natural') ? 10 : 0) + (aLower.includes('online') ? 8 : 0) + (aLower.includes('google') ? 5 : 0);
          const bScore = (bLower.includes('natural') ? 10 : 0) + (bLower.includes('online') ? 8 : 0) + (bLower.includes('google') ? 5 : 0);
          return bScore - aScore;
        });

      const selectedVoice = candidates[0] || filteredVoices.find(v => v.name.toLowerCase().includes(voiceSettings.gender)) || filteredVoices[0];

      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }

      // Variação de estilo (Otimizada para Locução "Veludo" Alfa FM)
      const styleVariations = [
        { pitch: -0.08, rate: -0.07 }, // Style 1: Alfa FM Pure (Deep, Warm, Velvety)
        { pitch: -0.12, rate: -0.05 }, // Style 2: Night Radio (Midnight Calm)
        { pitch: -0.02, rate: 0.02 },  // Style 3: Morning Show (Clear & Bright)
        { pitch: -0.05, rate: -0.12 }  // Style 4: Classic Formal
      ];
      const variation = styleVariations[voiceSettings.voiceIndex] || styleVariations[0];

      // Base pitch levemente menor para remover o "metálico" e rate menor para dicção clara
      utterance.pitch = (voiceSettings.gender === 'female' ? 0.98 : 0.95) + variation.pitch;
      utterance.rate = (voiceSettings.gender === 'female' ? 0.96 : 1.0) + variation.rate;
      utterance.volume = 1.0;

      utterance.onboundary = (event) => {
        if (event.name === 'word') {
          currentCharRef.current = fromIndex + event.charIndex;
        }
      };

      utterance.onstart = () => {
        setCurrentlySpeaking(msgId);
        setPausedMessage(null);
      };

      utterance.onend = () => {
        // Se ainda for a mesma mensagem, limpamos tudo (leitura terminou normal)
        setCurrentlySpeaking(prev => {
          if (prev === msgId) {
            // Só limpamos o pausedMessage se NÃO houve interrupção recente
            // O cancel() dispara onend ou onerror(interrupted)
            return null;
          }
          return prev;
        });
      };

      utterance.onerror = (e) => {
        console.error("TTS Error:", e.error, e);
        if (e.error === 'interrupted') {
          // Quando interrompido, salvamos o ponto. O onend pode disparar depois, 
          // então precisamos garantir que o pausedMessage persista.
          setPausedMessage({ id: msgId, text, isModel, charIndex: currentCharRef.current });
        }
        setCurrentlySpeaking(prev => prev === msgId ? null : prev);
      };
      
      setTimeout(() => {
        window.speechSynthesis.speak(utterance);
      }, 120);
    } catch (err) {
      console.error("TTS failed:", err);
      setCurrentlySpeaking(null);
    }
  };

  // Função para ler apenas texto selecionado
  const speakSelection = (text?: string) => {
    // Tenta pegar o texto passado ou a seleção atual do sistema
    const selection = window.getSelection();
    const textToSpeak = text || selection?.toString();
    
    if (textToSpeak && textToSpeak.trim()) {
      // Usamos isInternal=true para forçar o início da fala cancelando qualquer anterior sem alternar estado de pausa
      speakText(textToSpeak, true, 'selection-' + Date.now(), 0, true);
      setSelectionMenu(null);
      // Limpa a seleção do sistema para evitar que o menu fique "preso"
      if (!text) selection?.removeAllRanges();
    }
  };

  const translateSelection = async (text: string) => {
    const apiKey = (window as any).process?.env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      setErrorMsg("API Key não encontrada.");
      return;
    }
    
    setSelectionMenu(null);
    setIsSendingPrompt(true);
    addTranscription(`Traduzindo seleção: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`, false);

    try {
      const gAI = new GoogleGenAI({ apiKey });
      const response = await gAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ role: "user", parts: [{ text: `Traduza o seguinte texto para ${targetLanguage}: "${text}"` }] }],
        config: {
          systemInstruction: "Você é um tradutor expert. Retorne apenas a tradução direta, sem comentários extras.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
        }
      });
      
      const translation = response.text || "Erro na tradução.";
      addTranscription(translation, true);
    } catch (err: any) {
      const errorDetail = err.message || "Erro desconhecido";
      addTranscription(`Erro ao traduzir seleção: ${errorDetail}`, true);
    } finally {
      setIsSendingPrompt(false);
    }
  };

  const playNextChunk = useCallback(() => {
    if (audioQueueRef.current.length === 0 || isPlayingRef.current || !audioContextRef.current) {
      if (audioQueueRef.current.length === 0) setIsModelTalking(false);
      return;
    }

    setIsModelTalking(true);
    isPlayingRef.current = true;
    const chunk = audioQueueRef.current.shift()!;
    
    const buffer = audioContextRef.current.createBuffer(1, chunk.length, 24000);
    buffer.getChannelData(0).set(chunk);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.connect(audioContextRef.current.destination);
    source.onended = () => {
      isPlayingRef.current = false;
      playNextChunk();
    };
    source.start();
  }, []);

  const stopSession = async () => {
    setIsActive(false);
    isActiveRef.current = false;
    setIsInitializing(false);
    setAudioLevel(0);
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (sessionRef.current) {
      try {
        const session = await sessionRef.current;
        session.close();
      } catch (e) {
        console.warn("Error closing session:", e);
      }
      sessionRef.current = null;
    }
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsModelTalking(false);
  };

  const startSession = async () => {
    setErrorMsg(null);
    setNeedsApiKey(false);
    setSessionStatus("connecting");

    const apiKey = (window as any).process?.env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY || localStorage.getItem("GEMINI_API_KEY");
    
    if (!apiKey || apiKey === "SUA_CHAVE_AQUI") {
      setErrorMsg("Chave de API não configurada no cliente (.env) nem no ambiente do AI Studio. Clique no botão abaixo para configurar.");
      setNeedsApiKey(true);
      setIsInitializing(false);
      setSessionStatus("error");
      return;
    }

    setIsInitializing(true);
    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 16000
        });
        audioContextRef.current = audioCtx;
      }

      // Force resume on interaction
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      try {
        const constraints = {
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000,
          }
        };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        streamRef.current = stream;
      } catch (micErr: any) {
        setIsInitializing(false);
        setSessionStatus("error");
        setErrorMsg("Não foi possível acessar seu microfone. Verifique as permissões.");
        return;
      }

      const gAI = new GoogleGenAI({ apiKey });

      // Mapeamento dinâmico de vozes Gemini Live
      const liveVoices: Record<string, string[]> = {
        female: ["Aoede", "Kore", "Aoede", "Puck"], // Aoede é a mais próxima de locução
        male: ["Charon", "Fenrir", "Puck", "Charon"]
      };
      const selectedLiveVoice = liveVoices[voiceSettings.gender][voiceSettings.voiceIndex] || (voiceSettings.gender === 'female' ? "Aoede" : "Charon");

      const sessionPromise = gAI.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onopen: () => {
          setIsInitializing(false);
          setIsActive(true);
          isActiveRef.current = true;
          setSessionStatus("active");
          
          sessionPromise.then(session => {
            session.sendRealtimeInput({ text: "Iniciando tradução simultânea. O usuário vai falar agora." });
          });
          
          const source = audioContextRef.current!.createMediaStreamSource(streamRef.current!);
          processorRef.current = audioContextRef.current!.createScriptProcessor(4096, 1, 1);
          
          source.connect(processorRef.current);
          processorRef.current.connect(audioContextRef.current!.destination);
          
          processorRef.current.onaudioprocess = (e) => {
            if (isActiveRef.current) {
              const inputData = e.inputBuffer.getChannelData(0);
              
              let max = 0;
              for (let i = 0; i < inputData.length; i++) {
                const val = inputData[i];
                if (val > max) max = val;
                else if (-val > max) max = -val;
              }
              setAudioLevel(max);

              sessionPromise.then(session => {
                if (isActiveRef.current) {
                  session.sendRealtimeInput({
                    audio: { 
                      data: float32ToInt16Base64(inputData), 
                      mimeType: 'audio/pcm;rate=16000' 
                    }
                  });
                }
              }).catch(e => console.error("Send error:", e));
            }
          };
        },
        onmessage: async (msg: LiveServerMessage) => {
          if ((msg as any).goaway) {
            stopSession();
            setErrorMsg("Sessão expirada. Reinicie para continuar.");
            return;
          }
          
          const content = msg.serverContent;
          if (!content) return;

          // 1. Extract from Model Turn (Audio content messages)
          if (content.modelTurn) {
            content.modelTurn.parts?.forEach(part => {
              if (part.inlineData?.data) {
                const float32 = base64ToFloat32(part.inlineData.data);
                audioQueueRef.current.push(float32);
                playNextChunk();
              }
              if (part.text) {
                addTranscription(part.text, true);
              }
            });
          }

          // 2. Extract explicit Output Transcription (metadata field)
          const outTrans = (content as any).outputAudioTranscription;
          if (outTrans) {
            addTranscription(outTrans, true);
          }

          // 3. Extract explicit Input Transcription (to show user text)
          const inTrans = (content as any).inputAudioTranscription;
          if (inTrans) {
            addTranscription(inTrans, false);
          }

          // Fallback scan
          const scan = (o: any) => {
            if (!o || typeof o !== 'object') return;
            if (o.text && typeof o.text === 'string') addTranscription(o.text, true);
            Object.values(o).forEach(scan);
          };
          scan(content);

          // 4. Handle Interruption
          if (content.interrupted) {
            audioQueueRef.current = [];
            isPlayingRef.current = false;
            setIsModelTalking(false);
          }
        },
        onerror: (err: any) => {
          const msg = err.message || "";
          if (msg.includes("GoAway") || msg.includes("session duration limit")) {
            setErrorMsg("A sessão atingiu o limite de tempo. Reinicie para continuar.");
            setSessionStatus("idle");
            stopSession();
            return;
          }

          if (msg.toLowerCase().includes('permission denied') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('api_key')) {
            setErrorMsg("Conexão recusada pela API. Chave ou cota inválida.");
            setNeedsApiKey(true);
          } else {
            setErrorMsg(`Erro de conexão: ${msg || "Tente novamente"}`);
          }
          setSessionStatus("error");
          stopSession();
        },
        onclose: () => {
          setSessionStatus("idle");
        },
      },
      config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedLiveVoice } },
          },
          systemInstruction: `Você é um assistente poliglota inteligente e versátil.
            Sua missão principal é traduzir instantaneamente o que o usuário diz para ${targetLanguage},
            mas você deve ser capaz de mudar de assunto e conversar sobre qualquer coisa quando solicitado.
            COMPORTAMENTO:
            1. Se o usuário fornecer texto simples, traduza IMEDIATAMENTE.
            2. Se o usuário fizer uma pergunta ou quiser bater papo, responda normalmente (estilo ChatGPT).
            3. Mantenha o contexto da conversa. Se ele sair do assunto e depois voltar a enviar frases isoladas, retome a tradução para ${targetLanguage}.
            4. Seja natural, rápido e mude de "Tradutor" para "Assistente" de forma fluida.`,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        }
      });
      
      sessionRef.current = sessionPromise;
      
    } catch (err: any) {
      setIsInitializing(false);
      setSessionStatus("error");
      stopSession();
      setErrorMsg(`Falha ao iniciar: ${err.message || "Erro de rede"}`);
    }
  };

  const handleSelectKey = async () => {
    if ((window as any).aistudio?.openSelectKey) {
      await (window as any).aistudio.openSelectKey();
      startSession();
    } else {
      // Fallback para GitHub Pages ou Local
      const userKey = prompt("Insira sua Gemini API Key (pegue em: aistudio.google.com/app/apikey):");
      if (userKey && userKey.trim().length > 20) {
        localStorage.setItem("GEMINI_API_KEY", userKey.trim());
        setErrorMsg(null);
        setNeedsApiKey(false);
        startSession();
      } else if (userKey) {
        alert("Chave de API inválida ou muito curta.");
      }
    }
  };

  const handlePromptSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const apiKey = (window as any).process?.env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY || localStorage.getItem("GEMINI_API_KEY");
    if (!promptValue.trim() || isSendingPrompt || !apiKey || apiKey === "SUA_CHAVE_AQUI") {
      if (!apiKey || apiKey === "SUA_CHAVE_AQUI") setErrorMsg("API Key do Gemini não encontrada ou não configurada.");
      return;
    }

    setIsSendingPrompt(true);
    const userText = promptValue;
    setPromptValue("");
    addTranscription(userText, false);

    // Contexto: Pegamos as últimas mensagens para o Gemini lembrar do que estamos falando
    const history = transcriptions.slice(-12).map(t => ({
      role: t.isModel ? "model" : "user",
      parts: [{ text: t.text }]
    }));

    try {
      const gAI = new GoogleGenAI({ apiKey });
      const response = await gAI.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          ...history,
          { role: "user", parts: [{ text: userText }] }
        ],
        config: {
          systemInstruction: `Você é um assistente poliglota inteligente que alterna entre tradutor e chat geral.
            CONTEXTO ATUAL: O usuário quer traduções para ${targetLanguage}.
            OBJETIVO:
            - Se o input for texto para traduzir: forneça apenas a tradução impecável.
            - Se o input for uma pergunta ou conversa: saia do modo tradutor e responda como um assistente (ChatGPT).
            - Mantenha o histórico (contexto). Se ele perguntar algo e depois voltar a traduzir, lembre-se do que foi dito.`,
          thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL }
        }
      });
      
      const translation = response.text || "Sem resposta do assistente.";
      addTranscription(translation, true);
    } catch (err: any) {
      console.error("Prompt error:", err);
      const errorDetail = err.message || "Erro desconhecido";
      addTranscription(`Erro ao conectar com o Gemini: ${errorDetail}`, true);
    } finally {
      setIsSendingPrompt(false);
    }
  };

  useEffect(() => {
    const handleMouseUp = (e: MouseEvent) => {
      const selection = window.getSelection();
      const text = selection?.toString().trim();
      
      if (text && text.length > 0) {
        // Debounce ou delay opcional para evitar flicker
        setSelectionMenu({
          text,
          x: e.clientX,
          y: e.clientY
        });
      } else {
        // Se clicar fora e não houver seleção, fecha o menu
        if (selectionMenu) setSelectionMenu(null);
      }
    };

    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, [selectionMenu]);

  useEffect(() => {
    transcriptionsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptions]);

  return (
    <div className={`fixed inset-0 flex flex-col w-full max-w-lg mx-auto overflow-hidden transition-colors duration-500 shadow-2xl ${currentTheme.bg}`}>
      {/* Dynamic Background Effects */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <motion.div 
          animate={{ 
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
            x: [0, 50, 0],
            y: [0, 30, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className={`absolute top-[-10%] left-[-10%] w-[80%] h-[80%] rounded-full blur-[120px] ${currentTheme.blobs[0]}`}
        />
        <motion.div 
          animate={{ 
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
            x: [0, -40, 0],
            y: [0, -50, 0]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          className={`absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] rounded-full blur-[100px] ${currentTheme.blobs[1]}`}
        />
      </div>

      <header className="w-full text-center px-6 pt-8 pb-4 flex flex-col items-center shrink-0">
        <div className="w-full flex justify-between items-center mb-2 mt-4 px-4 pr-6">
          <div className="flex gap-2">
            <button 
              onClick={() => setShowAdmin(!showAdmin)}
              className={`p-1.5 rounded-lg opacity-30 hover:opacity-100 transition-all ${currentTheme.text}`}
              title="Configurar Monetização (Dono do App)"
            >
              <Terminal className="w-4 h-4" />
            </button>
            {!isPro && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowPaywall(true)}
                className="flex items-center gap-1.5 bg-yellow-400 text-yellow-900 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider shadow-lg"
              >
                <Sparkles className="w-3 h-3" />
                Seja Pro
              </motion.button>
            )}
            {isPro && (
              <div className="flex items-center gap-1.5 bg-green-400/20 text-green-300 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border border-green-500/30">
                <Unlock className="w-3 h-3" />
                Multi-Idioma Ativo
              </div>
            )}
          </div>
          <div className="flex gap-2">
            {Object.keys(themes).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t as any)}
              className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 transition-all ${theme === t ? 'border-white scale-110 shadow-lg' : 'border-white/20 scale-90 opacity-50'} ${themes[t as keyof typeof themes].bg}`}
              title={`Tema ${t}`}
            />
          ))}
          </div>
        </div>

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-3 mb-2">
            <motion.div 
              whileHover={{ scale: 1.05, rotate: 5 }}
              className={`w-12 h-12 sm:w-16 sm:h-16 backdrop-blur-xl rounded-2xl shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center border border-white/30 ${currentTheme.glass}`}
            >
              <Languages className={`w-6 h-6 sm:w-8 sm:h-8 ${currentTheme.text} drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]`} />
            </motion.div>
            <div className="flex bg-white/10 p-2 px-3 rounded-2xl border border-white/10 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <p className="text-[9px] font-black uppercase text-emerald-400 tracking-wider">Voz Otimizada Ativa</p>
              </div>
            </div>
          </div>
          <h1 className={`text-xl sm:text-2xl font-bold tracking-tight drop-shadow-md ${currentTheme.text}`}>Multi-Translation</h1>
          <div className={`flex items-center gap-2 mt-1 px-3 py-1 backdrop-blur-md rounded-full border border-white/10 ${currentTheme.glass}`}>
            <span className="w-1.5 h-1.5 bg-cyan-300 rounded-full animate-pulse shadow-[0_0_8px_rgba(103,232,249,0.8)]" />
            <p className={`text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] ${currentTheme.subtext}`}>AI & Tradução Profissional Live</p>
          </div>
        </div>

        {/* Voice Selection Menu disabled as requested */}

        {/* Language Selector */}
        <div className="mt-4 sm:mt-6 w-full px-4 sm:px-6">
          <div className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none opacity-50">
              <Languages className={`w-4 h-4 ${currentTheme.text}`} />
            </div>
            <select 
              value={targetLanguage}
              onChange={(e) => handleLanguageChange(e.target.value)}
              disabled={isActive || isInitializing}
              className={`w-full backdrop-blur-xl border rounded-2xl pl-12 pr-12 py-2.5 sm:py-3 text-xs sm:text-sm font-bold shadow-xl appearance-none focus:outline-none focus:ring-2 focus:ring-cyan-300/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${currentTheme.glass} ${currentTheme.border} ${currentTheme.text}`}
            >
              {languagesList.map(lang => {
                const isLocked = lang !== freeLanguage && !isPro;
                return (
                  <option key={lang} value={lang} className="text-neutral-900">
                    {lang} {isLocked ? "🔒 (Pro)" : ""}
                  </option>
                );
              })}
            </select>
            <div className={`absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-70 ${currentTheme.text}`}>
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full flex flex-col items-center space-y-4 sm:space-y-6 overflow-hidden mt-2 relative">
        {/* Selection Floating Menu */}
        <AnimatePresence>
          {selectionMenu && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8 }}
              style={{ 
                left: Math.min(selectionMenu.x, window.innerWidth - 180), 
                top: selectionMenu.y - 60 
              }}
              className="fixed z-[100] flex gap-1 p-1 bg-neutral-900/90 backdrop-blur-2xl rounded-2xl border border-white/20 shadow-2xl ring-1 ring-white/10"
            >
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  translateSelection(selectionMenu.text);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-cyan-400 hover:bg-white/10 transition-all active:scale-95"
              >
                <Languages className="w-3.5 h-3.5" />
                Traduzir
              </button>
              <div className="w-[1px] bg-white/10 my-1 ml-1" />
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  speakSelection(selectionMenu.text);
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 transition-all active:scale-95"
              >
                <Volume2 className="w-3.5 h-3.5" />
                Ouvir
              </button>
              <button
                onClick={() => setSelectionMenu(null)}
                className="p-2 text-white/40 hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal: Admin - Set MP Link */}
        <AnimatePresence>
          {showAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute inset-x-4 top-0 z-50 p-6 backdrop-blur-3xl rounded-3xl border border-white/20 shadow-2xl bg-neutral-900/90 text-white"
            >
              <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-4 text-cyan-400">Configuração do Dono</h3>
              <p className="text-[10px] text-zinc-400 mb-4 font-medium leading-relaxed">
                Insira o link de pagamento do seu Mercado Pago abaixo. Este botão será exibido para os usuários que tentarem usar outros idiomas.
              </p>
              <input 
                type="text" 
                value={adminInput}
                onChange={(e) => setAdminInput(e.target.value)}
                placeholder="https://link.mercadopago.com.br/..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-xs mb-4 focus:ring-2 focus:ring-cyan-500 outline-none"
              />
              <div className="flex gap-2">
                <button 
                  onClick={handleSavePayLink}
                  className="flex-1 bg-cyan-500 text-black py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20"
                >
                  Salvar Link
                </button>
                <button 
                  onClick={() => setShowAdmin(false)}
                  className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/10"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Modal: Paywall */}
        <AnimatePresence>
          {showPaywall && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-md bg-black/40"
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className={`w-full max-w-sm rounded-[2.5rem] border p-8 shadow-2xl relative overflow-hidden ${currentTheme.glass} ${currentTheme.border} ${currentTheme.bg}`}
              >
                <div className="absolute top-0 right-0 p-4">
                  <button onClick={() => setShowPaywall(false)} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                    <X className="w-5 h-5 text-white/50" />
                  </button>
                </div>

                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-yellow-400 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-yellow-400/20 rotate-3">
                    <Sparkles className="w-8 h-8 text-yellow-900" />
                  </div>
                  
                  <h2 className={`text-2xl font-black uppercase tracking-tighter mb-1 ${currentTheme.text}`}>Acesso Vitalício</h2>
                  <div className="bg-white/10 px-4 py-1.5 rounded-full mb-4 border border-white/20">
                    <span className="text-xl font-black text-yellow-300">R$ 10,00</span>
                  </div>
                  
                  <p className={`text-[11px] font-medium leading-relaxed mb-6 px-2 opacity-90 ${currentTheme.subtext}`}>
                    Seu apoio é fundamental! Esta contribuição de apenas <span className="font-bold text-white">R$ 10,00</span> serve como incentivo para continuarmos desenvolvendo ferramentas úteis, inovadoras e com preço acessível para todos.
                  </p>

                  <div className="w-full space-y-4">
                    <a 
                      href={payLink || "#"} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={() => !payLink && setShowAdmin(true)}
                      className="flex items-center justify-center gap-3 w-full bg-white text-black py-4 rounded-2xl font-black uppercase tracking-[0.15em] text-xs shadow-xl active:scale-95 transition-all"
                    >
                      <CreditCard className="w-4 h-4" />
                      {payLink ? "Pagar com Mercado Pago" : "Configurar Pagamento"}
                    </a>
                    
                    <button 
                      onClick={() => {
                        setIsPro(true);
                        setShowPaywall(false);
                      }}
                      className="w-full py-3 rounded-xl border border-white/20 text-[9px] font-black uppercase tracking-widest text-white/40 hover:text-white/100 transition-all"
                    >
                      {payLink ? "Já paguei / Simular Sucesso" : "Pular (Apenas Teste)"}
                    </button>
                  </div>

                  <p className="mt-6 text-[8px] uppercase tracking-[0.3em] font-black text-white/30">
                    Acesso Vitalício • Pagamento Seguro
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Error Alert */}
        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full bg-red-50 border border-red-100 p-4 rounded-2xl flex items-start gap-3 shadow-sm mb-4"
            >
              <div className="p-1 bg-red-500 rounded-full">
                <X className="w-3 h-3 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">Erro</p>
                <p className="text-xs text-red-600 leading-relaxed font-medium mb-3">{errorMsg}</p>
                
                {needsApiKey && (
                  <button
                    onClick={handleSelectKey}
                    className="flex items-center gap-2 bg-red-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shadow-sm hover:bg-red-700 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Configurar Chave API
                  </button>
                )}
              </div>
              <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Animated Waveform / Pulse Area */}
        <div className="relative w-24 h-24 sm:w-32 sm:h-32 flex items-center justify-center shrink-0">
          <AnimatePresence>
            {isActive && (
              <>
                <motion.div 
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ 
                    scale: [1, 1.25 + (isModelTalking ? 0.15 : audioLevel * 2), 1],
                    opacity: [0.2, 0.4, 0.2] 
                  }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 bg-white/20 rounded-full blur-xl"
                />
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ 
                    scale: [1, 1.1 + (isModelTalking ? 0.1 : audioLevel * 1), 1],
                    opacity: [0.4, 0.6, 0.4] 
                  }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
                  className={`absolute inset-3 backdrop-blur-sm rounded-full border border-white/30 ${currentTheme.glass}`}
                />
              </>
            )}
          </AnimatePresence>

          <button
            onClick={isActive ? stopSession : startSession}
            disabled={isInitializing}
            className={`
              relative z-10 w-24 h-24 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all duration-300 border-2
              ${isActive 
                ? `${currentTheme.buttonActive} border-cyan-300 animate-[pulse_2s_infinite]` 
                : `${currentTheme.glass} ${currentTheme.text} border-white/40 hover:scale-105 active:scale-95 hover:bg-white/20`}
              ${isInitializing ? 'opacity-50 cursor-not-allowed' : ''}
              group
            `}
          >
            {isInitializing ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : isActive ? (
              <Mic className="w-10 h-10 drop-shadow-sm" />
            ) : (
              <MicOff className={`w-10 h-10 opacity-50 ${currentTheme.text}`} />
            )}
            
            {isActive && (
              <motion.div 
                layoutId="status-dot-neon"
                className="absolute top-2 right-2 w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow-[0_0_10px_rgba(239,68,68,0.8)]"
              />
            )}
            
            <div className="absolute inset-0 rounded-full border-4 border-cyan-400/0 group-hover:border-cyan-400/30 transition-all duration-500" />
          </button>
        </div>

        {/* Status Text */}
        <div className="min-h-[40px] text-center shrink-0">
          <AnimatePresence mode="wait">
            {!isActive && !isInitializing && (
              <motion.p 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`text-[11px] font-black uppercase tracking-[0.25em] flex items-center justify-center gap-2 drop-shadow-sm ${currentTheme.text} opacity-80`}
              >
                {sessionStatus === "error" ? "Falha na conexão" : "Toque para traduzir voz"} <Sparkles className="w-4 h-4 text-cyan-300 animate-pulse" />
              </motion.p>
            )}
            {isActive && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`flex items-center gap-4 backdrop-blur-xl px-6 py-3 rounded-2xl border border-white/20 shadow-2xl ${currentTheme.glass}`}
              >
                <div className={`w-2.5 h-2.5 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.8)] ${audioLevel > 0.1 ? 'bg-cyan-300 animate-pulse' : 'bg-blue-300 opacity-50'}`} />
                <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${currentTheme.text}`}>
                  {isModelTalking ? "Gemini Falando" : (audioLevel > 0.05 ? "Captando Áudio" : "Ouvindo...")}
                </span>
              </motion.div>
            )}
            {isInitializing && (
              <div className="flex flex-col items-center gap-2">
                <motion.p 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[11px] font-black uppercase tracking-[0.25em] text-cyan-200 animate-pulse drop-shadow-sm"
                >
                  Sincronizando...
                </motion.p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Transcriptions Display */}
        <div className="w-full flex-1 flex flex-col gap-3 overflow-hidden min-h-0">
          <div className="flex items-center justify-between px-6">
            <h3 className={`text-[10px] font-black uppercase tracking-[0.25em] opacity-70 drop-shadow-sm ${currentTheme.text}`}>Tradução</h3>
            {transcriptions.length > 0 && (
              <button 
                onClick={() => setTranscriptions([])}
                className={`flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-70 hover:opacity-100 transition-all px-3 py-1.5 rounded-full border border-white/10 ${currentTheme.glass} ${currentTheme.text}`}
                title="Limpar"
              >
                <Eraser className="w-3.5 h-3.5" />
                Limpar
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto px-6 scrollbar-hide flex flex-col gap-4">
            <AnimatePresence initial={false}>
              {transcriptions.map((t) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${t.isModel ? 'justify-start' : 'justify-end'}`}
                >
                  <div className={`flex ${t.isModel ? 'justify-start' : 'justify-end'}`}>
                    <div 
                      className={`
                        max-w-[92%] px-5 py-3 rounded-2xl shadow-xl border leading-relaxed text-[13px] font-bold relative group/bubble
                        ${t.isModel 
                          ? `${currentTheme.chatModel} border-white/50 rounded-tl-none shadow-[0_10px_20px_rgba(0,0,0,0.05)]` 
                          : `${currentTheme.chatUser} backdrop-blur-md border-white/20 rounded-tr-none shadow-[0_10px_20px_rgba(0,0,0,0.1)]`}
                      `}
                    >
                      <div className="pr-8">
                        {t.text}
                      </div>
                      
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          speakText(t.text, t.isModel, t.id);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          speakSelection();
                        }}
                        className={`
                          absolute bottom-2 right-2 w-7 h-7 rounded-full flex items-center justify-center transition-all bg-black/10 hover:bg-black/20 text-current
                          sm:opacity-0 sm:group-hover/bubble:opacity-100 shadow-sm border border-black/5 z-20
                          ${currentlySpeaking === t.id ? 'animate-pulse bg-cyan-400/20' : ''}
                          ${pausedMessage?.id === t.id ? 'bg-yellow-400/30' : ''}
                        `}
                        title={currentlySpeaking === t.id ? "Pausar" : (pausedMessage?.id === t.id ? "Retomar" : "Ouvir (Duplo clique p/ Seleção)")}
                      >
                        {currentlySpeaking === t.id ? (
                          <Square className="w-3 h-3 fill-current" />
                        ) : pausedMessage?.id === t.id ? (
                          <Play className="w-3 h-3 fill-current" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Menu de Retomada Inteligente */}
                      <AnimatePresence>
                        {pausedMessage?.id === t.id && !currentlySpeaking && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 15 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 15 }}
                            className="absolute -top-14 left-0 right-0 flex gap-2 justify-center z-40"
                          >
                            <div className="flex flex-col items-center">
                              <span className="text-[7px] font-black text-white/40 uppercase tracking-[0.3em] mb-1">Opções de Áudio</span>
                              <div className="flex bg-slate-900/95 backdrop-blur-xl p-1 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] border border-white/10 ring-1 ring-white/5">
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    speakText(t.text, t.isModel, t.id, pausedMessage.charIndex, true);
                                  }}
                                  className="bg-cyan-500 text-white text-[10px] px-4 py-2 rounded-xl font-black flex items-center gap-1.5 hover:bg-cyan-400 active:scale-95 transition-all shadow-lg shadow-cyan-500/20"
                                >
                                  <Play className="w-3 h-3 fill-current" /> RETOMAR
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    speakText(t.text, t.isModel, t.id, 0, true);
                                  }}
                                  className="text-white text-[10px] px-4 py-2 rounded-xl font-black flex items-center gap-1.5 hover:bg-white/10 active:scale-95 transition-all"
                                >
                                  <ListRestart className="w-3 h-3" /> INÍCIO
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <div ref={transcriptionsEndRef} />
          </div>
        </div>

        {/* The Prompt Bar (Input Field) */}
        <div className="w-full px-4 pb-4 sm:pb-6 shrink-0 mt-2">
          <form 
            onSubmit={handlePromptSubmit}
            className={`w-full backdrop-blur-3xl rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border flex items-center gap-2 transition-all duration-300 ring-1 ring-white/10 ${theme === 'sky' ? 'bg-white/20 border-white/40' : currentTheme.glass + ' ' + currentTheme.border}`}
          >
            <input
              type="text"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              placeholder={isActive ? "Fale qualquer assunto..." : "Traduza ou converse..."}
              className={`flex-1 bg-transparent border-none focus:ring-0 text-sm px-6 py-3.5 font-bold placeholder-white/70 tracking-wide ${currentTheme.text}`}
            />
            
            <div className="flex items-center gap-2 pr-1">
              {promptValue.trim() && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  type="submit"
                  disabled={isSendingPrompt}
                  className={`${currentTheme.buttonActive} p-2.5 rounded-full transition-all shadow-lg active:scale-95`}
                >
                  {isSendingPrompt ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </motion.button>
              )}

              {!promptValue.trim() && (
                <button
                  type="button"
                  onClick={isActive ? stopSession : startSession}
                  disabled={isInitializing}
                  className={`
                    p-2.5 rounded-full transition-all duration-300 shadow-md border
                    ${isActive 
                      ? 'bg-red-500/20 text-red-100 border-red-400/30' 
                      : 'bg-white/20 text-white border-white/20 hover:bg-white/30'}
                  `}
                >
                  {isInitializing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isActive ? (
                    <Mic className="w-4 h-4" />
                  ) : (
                    <MicOff className="w-4 h-4 opacity-70" />
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </main>

      <footer className="mt-4 text-center text-[10px] text-white/50 uppercase tracking-[0.3em] font-black pb-4 drop-shadow-sm shrink-0">
        Gemini 3.1 Live • Pro Edition
      </footer>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
