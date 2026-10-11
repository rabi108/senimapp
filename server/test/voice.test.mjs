import { test } from "node:test";
import assert from "node:assert/strict";
import { ttsCostMicro, sttCostMicro, wordAccuracy, estimateSpeechSeconds } from "../src/voice.js";

const p = { sttAudioIn: 1.25, sttTextIn: 1.25, sttOut: 5, sttPerMinFallback: 0.003, ttsTextIn: 0.6, ttsPerMin: 0.015 };

test("speech-to-text cost from token usage", () => {
  // 15 s of audio is roughly 150 audio tokens; plus a 60-token prompt and a 20-token transcript
  const usage = { type: "tokens", input_tokens: 210, output_tokens: 20, input_token_details: { audio_tokens: 150, text_tokens: 60 } };
  assert.equal(sttCostMicro(usage, 15, p), Math.ceil(150 * 1.25 + 60 * 1.25 + 20 * 5)); // 363 micro-dollars = $0.000363
});

test("speech-to-text cost falls back to duration", () => {
  assert.equal(sttCostMicro({ type: "duration", seconds: 30 }, 0, p), 1500); // half a minute at $0.003/min
  assert.equal(sttCostMicro(null, 15, p), 750);
});

test("text-to-speech cost is estimated from length", () => {
  const text = "An orbit is the curved path something in space takes around another object.".repeat(2); // 26 words ≈ 10.4 s
  const micro = ttsCostMicro(text, p);
  assert.ok(micro > 2500 && micro < 2800, `got ${micro}`); // ≈ $0.0026
  assert.equal(Math.round(estimateSpeechSeconds("one two three four five")), 2);
});

test("word accuracy ignores case, punctuation and order", () => {
  assert.equal(wordAccuracy("What is an orbit?", "what is an orbit"), 1);
  assert.equal(wordAccuracy("Что такое затмение?", "Что такое затмение"), 1);
  assert.equal(wordAccuracy("What is an orbit?", "What is a robot"), 0.5);
});
