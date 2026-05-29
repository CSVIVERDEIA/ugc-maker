/**
 * Text-to-speech via ElevenLabs.
 * Converte o roteiro em voz (MP3) e devolve como data URI, que serve direto
 * como input de áudio pros modelos do Replicate (omni-human, sync/lipsync).
 */

// Voz padrão (Rachel) caso nenhuma seja escolhida.
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

export async function synthesizeSpeech({ text, voiceId, settings, apiKey }) {
  const key = apiKey || process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY não configurada");

  const vid = voiceId || DEFAULT_VOICE;

  // voice_settings controlam a naturalidade. Valores 0-1 (speed 0.7-1.2).
  const s = settings || {};
  const voice_settings = {
    stability: s.stability ?? 0.5,
    similarity_boost: s.similarity_boost ?? 0.75,
    style: s.style ?? 0.0,
    use_speaker_boost: true,
    speed: s.speed ?? 1.0,
  };

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${vid}`, {
    method: "POST",
    headers: {
      "xi-api-key": key,
      "content-type": "application/json",
      accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text,
      // multilingual_v2 fala português bem.
      model_id: "eleven_multilingual_v2",
      voice_settings,
    }),
  });

  if (!res.ok) {
    throw new Error(`ElevenLabs falhou: ${res.status} ${await res.text()}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  return `data:audio/mpeg;base64,${buf.toString("base64")}`;
}

export async function listVoices(apiKey) {
  const key = apiKey || process.env.ELEVENLABS_API_KEY;
  if (!key) return [];
  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": key },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.voices || []).map((v) => ({ voiceId: v.voice_id, name: v.name }));
}
