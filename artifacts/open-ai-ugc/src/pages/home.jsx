"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  FiArrowUp,
  FiVideo,
  FiX,
  FiChevronDown,
  FiZap,
  FiLoader,
  FiAlertCircle,
  FiPackage,
  FiUser,
  FiTarget,
  FiEdit3,
  FiImage,
  FiMic,
  FiFolder,
  FiPlay,
} from "react-icons/fi";
import { proxiedSrc } from "@/lib/utils";

// 4 modelos do Replicate (params controlam só a UI; os campos reais de input
// ficam em api/generate/route.js → buildInput).
const MODELS = [
  {
    id: "seedance-2",
    name: "Seedance 2 Fast",
    icon: FiVideo,
    params: {
      aspect_ratio: { options: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], default: "9:16" },
      resolution: { options: ["480p", "720p", "1080p"], default: "720p" },
      duration: { options: [5, 10], default: 5 },
    },
  },
  {
    id: "kling-v3",
    name: "Kling v3",
    icon: FiVideo,
    params: {
      aspect_ratio: { options: ["16:9", "9:16", "1:1"], default: "9:16" },
      duration: { options: [5, 10], default: 5 },
    },
  },
  {
    id: "veo-3-1-fast",
    name: "Veo 3.1 Fast",
    icon: FiVideo,
    params: {
      aspect_ratio: { options: ["16:9", "9:16"], default: "9:16" },
      resolution: { options: ["720p", "1080p"], default: "720p" },
    },
  },
  {
    id: "wan-2-2",
    name: "Wan 2.2 Fast",
    icon: FiZap,
    params: { resolution: { options: ["480p", "720p"], default: "480p" } },
  },
];

function buildContext({ product, avatar, campaign }) {
  let ctx = "";
  if (product) {
    const info = product.info || {};
    ctx += `PRODUTO: ${product.name}\n`;
    if (product.description) ctx += `Descrição: ${product.description}\n`;
    if (info.benefits?.length) ctx += `Benefícios: ${info.benefits.join("; ")}\n`;
    if (info.differentials?.length) ctx += `Diferenciais: ${info.differentials.join("; ")}\n`;
    if (info.audience) ctx += `Público do produto: ${info.audience}\n`;
    if (info.price) ctx += `Preço: ${info.price}\n`;
  }
  if (avatar) {
    const s = avatar.settings || {};
    ctx += `\nAVATAR/ATOR: ${avatar.name}`;
    if (avatar.description) ctx += ` — ${avatar.description}`;
    const bits = [s.gender, s.age, s.style, s.voice && `voz ${s.voice}`].filter(Boolean);
    if (bits.length) ctx += ` (${bits.join(", ")})`;
    ctx += "\n";
  }
  if (campaign) {
    ctx += `\nCAMPANHA: ${campaign.name}\n`;
    if (campaign.objective) ctx += `Objetivo: ${campaign.objective}\n`;
    if (campaign.angle) ctx += `Ângulo: ${campaign.angle}\n`;
    if (campaign.audience) ctx += `Público-alvo: ${campaign.audience}\n`;
    if (campaign.cta) ctx += `CTA: ${campaign.cta}\n`;
  }
  return ctx.trim();
}

// Lê a duração (segundos) de um áudio data URI no navegador.
function getAudioDuration(src) {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => resolve(a.duration && isFinite(a.duration) ? a.duration : 0);
    a.onerror = () => resolve(0);
    a.src = src;
  });
}

function Dropdown({ label, value, options, onChange, unit = "" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  return (
    <div
      ref={ref}
      className="relative"
      onBlur={(e) => { if (!ref.current.contains(e.relatedTarget)) setOpen(false); }}
    >
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 px-3 py-1 rounded transition-all hover:bg-glass-hover ${open ? "bg-glass-hover" : ""}`}
      >
        <span className="text-xs font-medium text-muted capitalize">{label}</span>
        <span className="text-xs font-medium text-foreground">{value}{unit}</span>
        <FiChevronDown className={`text-xs text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 bg-white border border-glass-border rounded shadow-2xl z-[10000]">
          {options.map((opt) => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-4 py-2 text-xs font-bold hover:bg-slate-100 transition-colors ${opt === value ? "text-slate-900 bg-slate-50" : "text-slate-500"}`}
            >
              {opt}{unit}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Home() {
  const { status } = useSession();
  const router = useRouter();

  const [products, setProducts] = useState([]);
  const [avatars, setAvatars] = useState([]);
  const [campaigns, setCampaigns] = useState([]);

  const [productId, setProductId] = useState("");
  const [avatarId, setAvatarId] = useState("");
  const [campaignId, setCampaignId] = useState("");

  // composição da imagem (avatar + produto via nano-banana)
  const [scenePrompt, setScenePrompt] = useState("");
  const [composeImage, setComposeImage] = useState(null);
  const [composeLoading, setComposeLoading] = useState(false);
  const [composeError, setComposeError] = useState("");
  const [savedImages, setSavedImages] = useState([]); // imagens já geradas, pra reusar

  const [scripts, setScripts] = useState([]);
  const [scriptsLoading, setScriptsLoading] = useState(false);
  const [scriptsError, setScriptsError] = useState("");
  const [prompt, setPrompt] = useState("");
  const [reshapeLoading, setReshapeLoading] = useState(false);

  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [modelSettings, setModelSettings] = useState({});
  const [isModelsModalOpen, setIsModelsModalOpen] = useState(false);

  // pipeline: "talking-a" (omni-human) | "talking-b" (cena+lipsync)
  const [pipeline, setPipeline] = useState("talking-b");
  const [voices, setVoices] = useState([]);
  const [voicesConfigured, setVoicesConfigured] = useState(true);
  const [voiceId, setVoiceId] = useState("");
  const [voiceSettings, setVoiceSettings] = useState({
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0.0,
    speed: 1.0,
  });
  const [audios, setAudios] = useState([]); // lista de vozes geradas { id, audio, label, duration }
  const [selectedAudio, setSelectedAudio] = useState(null); // a voz escolhida (data URI)
  const [selectedAudioDuration, setSelectedAudioDuration] = useState(0); // segundos da voz escolhida
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState("");
  const [savedAudios, setSavedAudios] = useState([]); // áudios já gerados, pra reusar
  const [isAudioModalOpen, setIsAudioModalOpen] = useState(false);
  const [motionPrompt, setMotionPrompt] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGeneration, setLastGeneration] = useState(null); // o que está aberto no preview
  const [jobs, setJobs] = useState([]); // gerações acompanhadas (continuam mesmo se fechar)

  const isTalking = pipeline !== "video";

  const product = products.find((p) => p.id === productId);
  const avatar = avatars.find((a) => a.id === avatarId);
  const campaign = campaigns.find((c) => c.id === campaignId);

  // imagens enviadas pro modelo: rosto do avatar primeiro, depois fotos do produto
  const images = [
    ...(avatar?.photos || []).slice(0, 1),
    ...(product?.photos || []),
  ].filter(Boolean).slice(0, 7);

  useEffect(() => {
    if (status !== "authenticated") return;
    (async () => {
      const [p, a, c] = await Promise.all([
        fetch("/api/products"), fetch("/api/avatars"), fetch("/api/campaigns"),
      ]);
      if (p.ok) setProducts((await p.json()).products || []);
      if (a.ok) setAvatars((await a.json()).avatars || []);
      if (c.ok) setCampaigns((await c.json()).campaigns || []);

      const v = await fetch("/api/voices");
      if (v.ok) {
        const vd = await v.json();
        setVoicesConfigured(vd.configured);
        setVoices(vd.voices || []);
        if (vd.voices?.[0]) setVoiceId(vd.voices[0].voiceId);
      }

      const im = await fetch("/api/creations?type=image");
      if (im.ok) setSavedImages(await im.json());

      const au = await fetch("/api/creations?type=audio");
      if (au.ok) setSavedAudios((await au.json()).filter((a) => a.status === "completed" && a.url));

      // seleção vinda de "Minhas Criações" (clique pra usar no gerador)
      try {
        const raw = sessionStorage.getItem("ugc:useCreation");
        if (raw) {
          sessionStorage.removeItem("ugc:useCreation");
          const c = JSON.parse(raw);
          if (c.type === "image" && c.url) {
            setComposeImage(c.url);
            setSavedImages((prev) =>
              prev.some((x) => x.url === c.url) ? prev : [{ id: c.id, url: c.url }, ...prev]
            );
          } else if (c.type === "audio" && c.url) {
            await useSavedAudio(c);
          }
        }
      } catch {}
    })();
  }, [status]);

  useEffect(() => {
    if (selectedModel.params) {
      const d = {};
      Object.keys(selectedModel.params).forEach((k) => (d[k] = selectedModel.params[k].default));
      setModelSettings(d);
    }
  }, [selectedModel]);

  // quando a campanha tem produto vinculado, seleciona ele
  useEffect(() => {
    if (campaign?.productId) setProductId(campaign.productId);
  }, [campaignId]);

  // Polling contínuo: acompanha TODOS os jobs em processamento, mesmo que o
  // preview esteja fechado. Quando um termina, atualiza e reaparece na tela.
  useEffect(() => {
    const pending = jobs.filter((j) => j.status === "processing");
    if (pending.length === 0) return;
    const interval = setInterval(async () => {
      for (const job of pending) {
        try {
          const res = await fetch(`/api/creations/${job.id}`);
          if (!res.ok) continue;
          const data = await res.json();
          if (data.status !== "processing") {
            setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, ...data } : j)));
            // atualiza o preview aberto, ou reabre se nada estiver aberto
            setLastGeneration((prev) =>
              !prev || prev.id === job.id ? data : prev
            );
          }
        } catch {}
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [jobs]);

  const composeImageFn = async () => {
    if (!avatarId && !productId) {
      setComposeError("Escolha um avatar e/ou produto primeiro.");
      return;
    }
    setComposeLoading(true);
    setComposeError("");
    try {
      const res = await fetch("/api/compose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarId,
          productId,
          prompt: scenePrompt,
          aspectRatio: modelSettings.aspect_ratio || "9:16",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao compor imagem");
      setComposeImage(data.image);
      // adiciona na galeria de reuso (no topo)
      setSavedImages((prev) => [{ id: data.id, url: data.image }, ...prev]);
    } catch (err) {
      setComposeError(err.message);
    } finally {
      setComposeLoading(false);
    }
  };

  const generateVoice = async () => {
    if (!prompt.trim()) {
      setAudioError("Escreva o roteiro no passo 3 primeiro.");
      return;
    }
    setAudioLoading(true);
    setAudioError("");
    try {
      const voiceName = voices.find((v) => v.voiceId === voiceId)?.name || "Voz";
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: prompt, voiceId, voiceName, settings: voiceSettings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao gerar voz");
      const duration = await getAudioDuration(data.audio);
      const label = `${voiceName} · ${Math.round(duration)}s · est ${voiceSettings.stability.toFixed(2)} · vel ${voiceSettings.speed.toFixed(2)}`;
      const item = { id: data.id, audio: data.audio, label, duration };
      setAudios((prev) => [item, ...prev]);
      setSelectedAudio(data.audio); // seleciona a mais recente por padrão
      setSelectedAudioDuration(duration);
    } catch (err) {
      setAudioError(err.message);
    } finally {
      setAudioLoading(false);
    }
  };

  // reaproveita um áudio já gerado (de "Minhas Criações" ou do modal de áudios salvos)
  const useSavedAudio = async (c) => {
    if (!c?.url) return;
    let duration = Number(c.duration) || 0;
    if (!duration) duration = await getAudioDuration(c.url);
    const label = c.prompt
      ? `Salvo · ${Math.round(duration)}s · ${c.prompt.slice(0, 40)}`
      : `Áudio salvo · ${Math.round(duration)}s`;
    setAudios((prev) =>
      prev.some((x) => x.audio === c.url) ? prev : [{ id: c.id, audio: c.url, label, duration }, ...prev]
    );
    setSelectedAudio(c.url);
    setSelectedAudioDuration(duration);
  };

  const reshapeScriptFn = async () => {
    if (!prompt.trim()) return;
    setReshapeLoading(true);
    try {
      const res = await fetch("/api/scripts/reshape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ script: prompt, currentSeconds: selectedAudioDuration, targetSeconds: 15 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao reescrever");
      setPrompt(data.script);
      // o roteiro mudou → a voz antiga não vale mais; força gerar de novo
      setSelectedAudio(null);
      setSelectedAudioDuration(0);
    } catch (err) {
      alert(err.message);
    } finally {
      setReshapeLoading(false);
    }
  };

  const generateScripts = async () => {
    const context = buildContext({ product, avatar, campaign });
    if (!context) {
      setScriptsError("Escolha ao menos um produto ou campanha pra dar contexto.");
      return;
    }
    setScriptsLoading(true);
    setScriptsError("");
    setScripts([]);
    try {
      const res = await fetch("/api/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          context,
          tone: product?.info?.tone || avatar?.settings?.voice || undefined,
          count: 3,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Falha ao gerar roteiros");
      setScripts(data.scripts || []);
    } catch (err) {
      setScriptsError(err.message);
    } finally {
      setScriptsLoading(false);
    }
  };

  const generateVideo = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipeline,
          modelId: selectedModel.id,
          prompt,
          settings: modelSettings,
          // usa a imagem composta (avatar+produto) se existir; senão, as fotos cruas
          images: composeImage ? [composeImage] : images,
          voiceId: isTalking ? voiceId : undefined,
          voiceSettings: isTalking ? voiceSettings : undefined,
          audio: isTalking ? selectedAudio : undefined, // áudio escolhido da lista
          audioDuration: isTalking ? selectedAudioDuration : undefined, // pra casar a duração do vídeo
          motionPrompt, // movimento da cena no Caminho B
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const job = { id: data.creationId, status: "processing", prompt };
      setJobs((prev) => [job, ...prev]);
      setLastGeneration(job);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <FiLoader className="w-6 h-6 animate-spin text-muted" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center gap-5 p-6 text-center">
        <h2 className="text-lg font-black tracking-tight text-foreground">Entre para gerar vídeos</h2>
        <p className="text-xs text-muted max-w-xs">Crie uma conta ou faça login para começar.</p>
        <button
          onClick={() => router.push("/login")}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary-500 text-white rounded-full font-bold text-xs hover:bg-primary-600 transition-all"
        >
          Entrar / Cadastrar <FiArrowUp className="rotate-90" />
        </button>
      </div>
    );
  }

  const updateSetting = (k, v) => setModelSettings((p) => ({ ...p, [k]: v }));

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 md:p-10 space-y-8">
        {/* Aviso: gerações rodando em segundo plano (preview fechado) */}
        {!lastGeneration && jobs.some((j) => j.status === "processing") && (
          <div className="flex items-center justify-center gap-2 text-[11px] text-muted">
            <FiLoader className="animate-spin" />
            {jobs.filter((j) => j.status === "processing").length} vídeo(s) gerando em segundo plano — aparecem aqui quando ficam prontos (e ficam salvos em Minhas Criações).
          </div>
        )}

        {/* Resultado */}
        {lastGeneration && (
          <div className="relative w-full max-w-sm mx-auto aspect-[9/16] max-h-[55vh] bg-glass-bg rounded-xl border border-glass-border shadow-2xl overflow-hidden flex items-center justify-center">
            {lastGeneration.status === "processing" ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
                <span className="text-[10px] font-black text-muted uppercase tracking-[0.3em] animate-pulse">Gerando...</span>
              </div>
            ) : lastGeneration.status === "failed" ? (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <FiAlertCircle className="text-rose-500 text-3xl" />
                <p className="text-[11px] text-muted">{lastGeneration.error || "Falhou"}</p>
              </div>
            ) : (
              <video src={lastGeneration.url} className="w-full h-full object-cover" autoPlay loop playsInline controls />
            )}
            <button
              onClick={() => setLastGeneration(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white flex items-center justify-center"
            >
              <FiX />
            </button>
          </div>
        )}

        {/* Passo 1: contexto */}
        <Section icon={FiTarget} title="1. Contexto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Selector label="Produto" icon={FiPackage} value={productId} onChange={setProductId} items={products} emptyHref="/products" router={router} />
            <Selector label="Avatar" icon={FiUser} value={avatarId} onChange={setAvatarId} items={avatars} emptyHref="/avatars" router={router} />
            <Selector label="Campanha" icon={FiTarget} value={campaignId} onChange={setCampaignId} items={campaigns} emptyHref="/campaigns" router={router} />
          </div>
          {images.length > 0 && (
            <div className="flex items-center gap-2 mt-3">
              <span className="text-[10px] text-muted font-bold uppercase tracking-widest">Referências:</span>
              {images.map((src, i) => (
                <img key={i} src={proxiedSrc(src)} className="w-8 h-8 rounded object-cover border border-glass-border" alt="" />
              ))}
            </div>
          )}
        </Section>

        {/* Passo 2: imagem do produto (composição via nano-banana) */}
        <Section icon={FiImage} title="2. Imagem com o produto">
          <p className="text-[11px] text-muted mb-3">
            Gera uma foto do avatar usando/segurando o produto. Essa imagem vira a base do vídeo.
          </p>
          <input
            value={scenePrompt}
            onChange={(e) => setScenePrompt(e.target.value)}
            placeholder="Direção opcional da cena (ex: na cozinha, segurando perto do rosto, sorrindo)"
            className="w-full px-3 py-2 bg-glass-bg border border-glass-border rounded-lg text-xs text-foreground placeholder-muted outline-none focus:border-primary-500/50 mb-3"
          />
          <button
            onClick={composeImageFn}
            disabled={composeLoading || (!avatarId && !productId)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-xs font-bold hover:bg-primary-600 transition-all disabled:opacity-50"
          >
            {composeLoading ? <FiLoader className="animate-spin" /> : <FiImage />}
            {composeImage ? "Gerar outra imagem" : "Criar imagem com IA"}
          </button>
          {composeError && <p className="text-[11px] text-rose-500 mt-2">{composeError}</p>}

          {composeImage && (
            <div className="mt-4">
              <img
                src={proxiedSrc(composeImage)}
                className="max-h-72 rounded-lg border border-glass-border"
                alt="Imagem composta"
              />
              <p className="text-[10px] text-muted mt-1">É essa imagem que será animada no vídeo.</p>
            </div>
          )}

          {/* Galeria de imagens já geradas — clique pra reutilizar */}
          {savedImages.length > 0 && (
            <div className="mt-5 pt-4 border-t border-glass-border">
              <p className="text-[10px] font-black uppercase tracking-widest text-muted mb-2">
                Imagens salvas (clique pra reutilizar)
              </p>
              <div className="flex gap-2 flex-wrap">
                {savedImages.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setComposeImage(img.url)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${composeImage === img.url ? "border-primary-500" : "border-glass-border hover:border-primary-500/40"}`}
                  >
                    <img src={proxiedSrc(img.url)} className="w-full h-full object-cover" alt="" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* Passo 3: roteiro */}
        <Section icon={FiEdit3} title="3. Roteiro">
          <button
            onClick={generateScripts}
            disabled={scriptsLoading}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-xs font-bold hover:bg-primary-600 transition-all disabled:opacity-50"
          >
            {scriptsLoading ? <FiLoader className="animate-spin" /> : <FiZap />}
            Gerar roteiros com IA
          </button>
          {scriptsError && <p className="text-[11px] text-rose-500 mt-2">{scriptsError}</p>}

          {scripts.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
              {scripts.map((s, i) => (
                <button
                  key={i}
                  onClick={() => setPrompt(s.script)}
                  className={`text-left p-3 rounded-lg border transition-all ${prompt === s.script ? "border-primary-500 bg-primary-500/5" : "border-glass-border hover:border-primary-500/40"}`}
                >
                  {s.hook && <p className="text-[11px] font-black text-foreground mb-1">{s.hook}</p>}
                  <p className="text-[11px] text-muted line-clamp-4">{s.script}</p>
                </button>
              ))}
            </div>
          )}

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="O roteiro escolhido aparece aqui (você pode editar) — ou escreva o seu."
            className="w-full h-24 mt-4 px-3 py-2 bg-glass-bg border border-glass-border rounded-lg text-xs text-foreground placeholder-muted outline-none focus:border-primary-500/50 resize-none"
          />
        </Section>

        {/* Passo 4: modo + modelo + gerar */}
        <Section icon={FiVideo} title="4. Modo & geração">
          {/* Voz — gera e ouve antes do vídeo (só nos modos falantes) */}
          {isTalking && (
            !voicesConfigured ? (
              <p className="text-[11px] text-amber-600 mb-4">
                ⚠️ ElevenLabs não configurado — adicione ELEVENLABS_API_KEY no .env.
              </p>
            ) : (
              <div className="mb-4 p-4 rounded-lg border border-glass-border bg-glass-bg space-y-3">
                <div className="flex items-center gap-2">
                  <FiMic className="text-primary-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-foreground">Voz</span>
                </div>
                <select
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value)}
                  className="w-full px-3 py-2 bg-glass-bg border border-glass-border rounded-lg text-xs text-foreground outline-none focus:border-primary-500/50"
                >
                  {voices.map((v) => (
                    <option key={v.voiceId} value={v.voiceId}>{v.name}</option>
                  ))}
                </select>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <VoiceSlider label="Estabilidade" value={voiceSettings.stability} onChange={(v) => setVoiceSettings((s) => ({ ...s, stability: v }))} />
                  <VoiceSlider label="Similaridade" value={voiceSettings.similarity_boost} onChange={(v) => setVoiceSettings((s) => ({ ...s, similarity_boost: v }))} />
                  <VoiceSlider label="Estilo" value={voiceSettings.style} onChange={(v) => setVoiceSettings((s) => ({ ...s, style: v }))} />
                  <VoiceSlider label="Velocidade" value={voiceSettings.speed} min={0.7} max={1.2} step={0.05} onChange={(v) => setVoiceSettings((s) => ({ ...s, speed: v }))} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={generateVoice}
                    disabled={audioLoading || !prompt.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg text-xs font-bold hover:bg-primary-600 transition-all disabled:opacity-50"
                  >
                    {audioLoading ? <FiLoader className="animate-spin" /> : <FiMic />}
                    {audios.length ? "Gerar mais uma voz" : "Gerar voz (ouvir antes)"}
                  </button>
                  {savedAudios.length > 0 && (
                    <button
                      onClick={() => setIsAudioModalOpen(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-glass-bg border border-glass-border text-foreground rounded-lg text-xs font-bold hover:border-primary-500/40 transition-all"
                    >
                      <FiFolder /> Escolher áudio salvo
                    </button>
                  )}
                </div>
                {audioError && <p className="text-[11px] text-rose-500">{audioError}</p>}

                {audios.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <p className="text-[10px] text-muted">Gere quantas quiser e escolha a melhor pro vídeo:</p>
                    {audios.map((a, i) => (
                      <div
                        key={a.id || i}
                        onClick={() => { setSelectedAudio(a.audio); setSelectedAudioDuration(a.duration || 0); }}
                        className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all ${selectedAudio === a.audio ? "border-primary-500 bg-primary-500/5" : "border-glass-border hover:border-primary-500/40"}`}
                      >
                        <div className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${selectedAudio === a.audio ? "border-primary-500" : "border-glass-border"}`}>
                          {selectedAudio === a.audio && <div className="w-2 h-2 rounded-full bg-primary-500" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-muted truncate mb-1">#{audios.length - i} · {a.label}</p>
                          <audio controls src={a.audio} className="w-full h-8" onClick={(e) => e.stopPropagation()} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          )}

          {/* Movimento da cena (só no Caminho B) */}
          {pipeline === "talking-b" && (
            <div className="mb-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted block mb-1.5">
                Movimento da cena
              </span>
              <textarea
                value={motionPrompt}
                onChange={(e) => setMotionPrompt(e.target.value)}
                placeholder="Ex: gesticulando com as mãos, sorrindo, leve zoom de câmera, andando pela cozinha"
                className="w-full h-16 px-3 py-2 bg-glass-bg border border-glass-border rounded-lg text-xs text-foreground placeholder-muted outline-none focus:border-primary-500/50 resize-none"
              />
            </div>
          )}

          {isTalking && (
            <p className="text-[11px] text-muted">
              O Kling anima a cena (use o campo “Movimento” acima pra pedir gestos/expressões) e o lip-sync sincroniza a boca com a voz. 2 etapas, ~3-4 min.
            </p>
          )}

          {isTalking && voicesConfigured && !selectedAudio && (
            <p className="text-[11px] text-amber-600 mt-3">
              Gere e escolha uma voz acima antes de gerar o vídeo.
            </p>
          )}

          {isTalking && selectedAudioDuration > 15 && (
            <div className="mt-3 p-3 rounded-lg border border-amber-500/40 bg-amber-500/5">
              <p className="text-[11px] text-amber-600 mb-2">
                ⚠️ A voz tem ~{Math.round(selectedAudioDuration)}s, mas o clipe vai no máx. 15s. Reescreva o roteiro pra caber e gere a voz de novo.
              </p>
              <button
                onClick={reshapeScriptFn}
                disabled={reshapeLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition-all disabled:opacity-50"
              >
                {reshapeLoading ? <FiLoader className="animate-spin" /> : <FiEdit3 />}
                Encurtar roteiro pra ~15s
              </button>
            </div>
          )}

          <button
            onClick={generateVideo}
            disabled={isGenerating || !prompt.trim() || (isTalking && voicesConfigured && !selectedAudio)}
            className="mt-4 flex items-center gap-2 px-6 py-3 bg-primary-500 text-white rounded-full text-xs font-black uppercase tracking-widest hover:bg-primary-600 transition-all disabled:opacity-50"
          >
            {isGenerating ? <FiLoader className="animate-spin" /> : <FiArrowUp />}
            Gerar vídeo
          </button>
        </Section>
      </div>

      {/* Modal de modelos */}
      <AnimatePresence>
        {isModelsModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsModelsModalOpen(false)}
              className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-3xl bg-white rounded-xl shadow-2xl p-6"
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {MODELS.map((model) => (
                  <div
                    key={model.id}
                    onClick={() => { setSelectedModel(model); setIsModelsModalOpen(false); }}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedModel.id === model.id ? "border-slate-900 ring-1 ring-slate-900 bg-slate-50" : "border-slate-200 hover:border-slate-400"}`}
                  >
                    <model.icon className="text-lg text-slate-700 mb-2" />
                    <h4 className="text-xs font-bold text-slate-900">{model.name}</h4>
                    <p className="text-[10px] text-slate-400 mt-1">{Object.keys(model.params).join(" • ")}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal de áudios salvos */}
      <AnimatePresence>
        {isAudioModalOpen && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsAudioModalOpen(false)}
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-2xl max-h-[80vh] flex flex-col bg-white rounded-xl shadow-2xl"
            >
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <FiMic className="text-primary-500" />
                  <h3 className="text-sm font-black text-slate-900">Áudios salvos</h3>
                </div>
                <button
                  onClick={() => setIsAudioModalOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-500"
                >
                  <FiX />
                </button>
              </div>
              <div className="p-5 overflow-y-auto custom-scrollbar grid grid-cols-1 sm:grid-cols-2 gap-3">
                {savedAudios.map((a) => {
                  const isSel = selectedAudio === a.url;
                  return (
                    <div
                      key={a.id}
                      className={`p-3 rounded-lg border transition-all ${isSel ? "border-primary-500 ring-1 ring-primary-500 bg-primary-50" : "border-slate-200 hover:border-slate-400"}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <FiPlay className="text-primary-500 text-xs flex-shrink-0" />
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {a.prompt ? a.prompt.split(" ").slice(0, 5).join(" ") : "Áudio"}
                          {a.duration ? ` · ${Math.round(a.duration)}s` : ""}
                        </p>
                      </div>
                      <p className="text-[10px] text-slate-400 line-clamp-2 mb-2 min-h-[26px]">
                        {a.prompt || "Sem descrição"}
                      </p>
                      <audio controls src={a.url} className="w-full h-8 mb-2" />
                      <button
                        onClick={async () => { await useSavedAudio(a); setIsAudioModalOpen(false); }}
                        className={`w-full py-1.5 rounded-lg text-[11px] font-bold transition-all ${isSel ? "bg-primary-500 text-white" : "bg-slate-900 text-white hover:bg-slate-700"}`}
                      >
                        {isSel ? "Selecionado" : "Selecionar"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VoiceSlider({ label, value, onChange, min = 0, max = 1, step = 0.05 }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-medium text-muted">{label}</span>
        <span className="text-[10px] font-bold text-foreground">{Number(value).toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 bg-glass-border rounded-full appearance-none cursor-pointer accent-primary-500"
      />
    </label>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-glass-bg border border-glass-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="text-primary-500" />
        <h2 className="text-xs font-black uppercase tracking-widest text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function Selector({ label, icon: Icon, value, onChange, items, emptyHref, router }) {
  return (
    <div>
      <span className="text-[10px] font-black uppercase tracking-widest text-muted flex items-center gap-1 mb-1.5">
        <Icon className="text-xs" /> {label}
      </span>
      {items.length === 0 ? (
        <button
          onClick={() => router.push(emptyHref)}
          className="w-full px-3 py-2 rounded-lg border border-dashed border-glass-border text-[11px] text-muted hover:text-foreground hover:border-primary-500/40 transition-all"
        >
          + Criar {label.toLowerCase()}
        </button>
      ) : (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 bg-glass-bg border border-glass-border rounded-lg text-xs text-foreground outline-none focus:border-primary-500/50"
        >
          <option value="">Nenhum</option>
          {items.map((it) => (
            <option key={it.id} value={it.id}>{it.name}</option>
          ))}
        </select>
      )}
    </div>
  );
}
