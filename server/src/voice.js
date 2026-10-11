// Voice: speech-to-text for questions and text-to-speech for answers.
// Recordings are processed in memory only and never stored or logged.

export const STT_LANGS = { en: "en", kk: "kk", ru: "ru" };

/** Words that help the transcriber spell the course vocabulary correctly. */
export const STT_PROMPT = "A Grade 7 student asks a question about space: orbit, axis, rotate, tilted, solar system, planet, eclipse, solar eclipse, lunar eclipse, reflect, naked eye, telescope, probe, Mercury, Venus, Earth, Mars, moon, sun.";

export const TTS_INSTRUCTIONS = "Speak slowly and clearly in a warm, friendly teacher's voice for 12-year-old students who are learning English.";

/** Rough speech length: about 2.5 words per second at a slow, clear pace. */
export function estimateSpeechSeconds(text) {
  const words = String(text).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, words / 2.5);
}

/** Text-to-speech cost in micro-dollars: text input tokens plus audio priced per minute (estimated). */
export function ttsCostMicro(text, p) {
  const inputTokens = Math.ceil(String(text).length / 4);
  return Math.ceil((inputTokens * p.ttsTextIn / 1e6 + (estimateSpeechSeconds(text) / 60) * p.ttsPerMin) * 1e6);
}

/**
 * Speech-to-text cost in micro-dollars from the usage the API returns (token-billed models), else from the
 * audio length. Token prices are USD per 1M tokens, so tokens × price is already in micro-dollars.
 */
export function sttCostMicro(usage, seconds, p) {
  if (usage && usage.type === "tokens") {
    const audio = usage.input_token_details?.audio_tokens ?? usage.input_tokens ?? 0;
    const text = usage.input_token_details?.text_tokens ?? 0;
    return Math.ceil((audio * p.sttAudioIn + text * p.sttTextIn + (usage.output_tokens || 0) * p.sttOut));
  }
  const secs = usage && usage.type === "duration" ? usage.seconds : seconds;
  return Math.ceil((Math.max(1, secs) / 60) * p.sttPerMinFallback * 1e6);
}

const normWords = (s) => String(s).toLowerCase().replace(/[’']/g, "").match(/[\p{L}\p{N}]+/gu) || [];

/** Share of the expected words that appear in the transcript (0..1). Simple, order-insensitive. */
export function wordAccuracy(expected, got) {
  const want = normWords(expected), have = new Set(normWords(got));
  if (!want.length) return 1;
  return want.filter((w) => have.has(w)).length / want.length;
}

/** Spoken test questions for the teacher's voice self-test: one from the book and one not, per language. */
export const VOICE_SELFTEST = [
  { text: "What is an orbit?", lang: "en", expect: "answer" },
  { text: "Who won the football match yesterday?", lang: "en", expect: "decline" },
  { text: "Что такое затмение?", lang: "ru", expect: "answer" },
  { text: "Какая погода будет завтра?", lang: "ru", expect: "decline" },
  { text: "Ай неге жарқырайды?", lang: "kk", expect: "answer" },
  { text: "Кеше футболда кім жеңді?", lang: "kk", expect: "decline" }
];
