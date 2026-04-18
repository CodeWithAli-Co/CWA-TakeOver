// ───────────────────────────────────────────────────────────────────
// Voice identity — best-effort operator-voice filter.
//
// IMPORTANT: This is NOT a security mechanism. It's a coarse filter
// that rejects voices with pitch/timbre far outside the enrolled
// operator's profile. It'll stop most unintended activations from
// other people speaking in the room, a podcast playing nearby, etc.
// It can be defeated by anyone trying. Use role-based auth for real
// security.
//
// Feature vector (7 dims): fundamental-frequency mean, F0 standard
// deviation, energy mean, spectral-centroid mean, zero-crossing rate,
// and two band-energy ratios. Enrollment averages this over ~5s of
// speech. Verification uses cosine similarity.
// ───────────────────────────────────────────────────────────────────

export type VoicePrintVector = number[]; // length 7

const FEATURE_LENGTH = 7;
const ENROLL_DURATION_MS = 5000;

/** Record audio for `durationMs`, return the raw Float32 mono samples + sampleRate. */
async function recordSamples(
  durationMs: number
): Promise<{ samples: Float32Array; sampleRate: number } | null> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return null;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const ac = new AudioContext();
  const src = ac.createMediaStreamSource(stream);
  const processor = ac.createScriptProcessor(4096, 1, 1);
  const chunks: Float32Array[] = [];
  src.connect(processor);
  processor.connect(ac.destination);
  processor.onaudioprocess = (e) => {
    chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
  };
  await new Promise((r) => setTimeout(r, durationMs));
  processor.disconnect();
  src.disconnect();
  stream.getTracks().forEach((t) => t.stop());
  await ac.close().catch(() => {});
  // Concatenate chunks
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.length;
  }
  return { samples: out, sampleRate: ac.sampleRate };
}

// ── Feature extraction ────────────────────────────────────────────

/** Estimate fundamental frequency via autocorrelation on a single frame. */
function estimateF0(frame: Float32Array, sampleRate: number): number {
  const size = frame.length;
  let rms = 0;
  for (let i = 0; i < size; i++) rms += frame[i] * frame[i];
  rms = Math.sqrt(rms / size);
  if (rms < 0.01) return 0; // silent frame

  let lastPositive = -1;
  const minLag = Math.floor(sampleRate / 500); // 500Hz ceiling
  const maxLag = Math.floor(sampleRate / 60);  // 60Hz floor
  let bestLag = -1;
  let bestCorr = 0;
  for (let lag = minLag; lag < maxLag && lag < size; lag++) {
    let corr = 0;
    for (let i = 0; i < size - lag; i++) {
      corr += frame[i] * frame[i + lag];
    }
    corr = corr / (size - lag);
    if (corr > 0 && corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
    if (corr > 0) lastPositive = lag;
  }
  void lastPositive;
  if (bestLag === -1) return 0;
  return sampleRate / bestLag;
}

/** Compute zero-crossing rate. */
function zcr(frame: Float32Array): number {
  let z = 0;
  for (let i = 1; i < frame.length; i++) {
    if ((frame[i - 1] < 0 && frame[i] >= 0) || (frame[i - 1] >= 0 && frame[i] < 0)) z++;
  }
  return z / frame.length;
}

/** Rough spectral centroid via DFT magnitude over N bins. */
function spectralFeatures(frame: Float32Array, sampleRate: number): {
  centroid: number;
  lowMidRatio: number;
  midHighRatio: number;
} {
  const N = 512;
  const mag = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < frame.length; n++) {
      const theta = (2 * Math.PI * k * n) / frame.length;
      re += frame[n] * Math.cos(theta);
      im -= frame[n] * Math.sin(theta);
    }
    mag[k] = Math.sqrt(re * re + im * im);
  }
  let weighted = 0;
  let total = 0;
  for (let k = 0; k < N; k++) {
    const f = (k * sampleRate) / (2 * frame.length);
    weighted += f * mag[k];
    total += mag[k];
  }
  const centroid = total > 0 ? weighted / total : 0;
  // Band energies (low: 0-500Hz, mid: 500-2000Hz, high: 2000-4000Hz)
  let low = 0, mid = 0, high = 0;
  for (let k = 0; k < N; k++) {
    const f = (k * sampleRate) / (2 * frame.length);
    const m = mag[k];
    if (f < 500) low += m;
    else if (f < 2000) mid += m;
    else if (f < 4000) high += m;
  }
  return {
    centroid,
    lowMidRatio: mid > 0 ? low / mid : 0,
    midHighRatio: high > 0 ? mid / high : 0,
  };
}

/** Extract feature vector from a recording. */
export function extractFeatures(
  samples: Float32Array,
  sampleRate: number
): VoicePrintVector {
  const frameSize = Math.floor(sampleRate * 0.04); // 40ms
  const hop = Math.floor(frameSize / 2);
  const f0s: number[] = [];
  const energies: number[] = [];
  const centroids: number[] = [];
  const zcrs: number[] = [];
  const lowMids: number[] = [];
  const midHighs: number[] = [];
  for (let i = 0; i + frameSize < samples.length; i += hop) {
    const frame = samples.subarray(i, i + frameSize);
    const f0 = estimateF0(frame, sampleRate);
    if (f0 === 0) continue; // skip silent frames
    f0s.push(f0);
    let e = 0;
    for (let j = 0; j < frame.length; j++) e += frame[j] * frame[j];
    energies.push(Math.sqrt(e / frame.length));
    const sp = spectralFeatures(frame, sampleRate);
    centroids.push(sp.centroid);
    lowMids.push(sp.lowMidRatio);
    midHighs.push(sp.midHighRatio);
    zcrs.push(zcr(frame));
  }
  if (f0s.length < 4) {
    // Not enough speech — return empty-ish vector
    return new Array(FEATURE_LENGTH).fill(0);
  }
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const std = (a: number[], m: number) =>
    Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length);
  const f0Mean = mean(f0s);
  return [
    f0Mean,
    std(f0s, f0Mean),
    mean(energies),
    mean(centroids),
    mean(zcrs),
    mean(lowMids),
    mean(midHighs),
  ];
}

export function normalize(v: VoicePrintVector): VoicePrintVector {
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (norm === 0) return v;
  return v.map((x) => x / norm);
}

export function cosineSimilarity(a: VoicePrintVector, b: VoicePrintVector): number {
  if (a.length !== b.length) return 0;
  const na = normalize(a);
  const nb = normalize(b);
  let dot = 0;
  for (let i = 0; i < na.length; i++) dot += na[i] * nb[i];
  return dot;
}

/** Record and derive a voice print. Returns null on failure. */
export async function enrollVoice(): Promise<VoicePrintVector | null> {
  const rec = await recordSamples(ENROLL_DURATION_MS);
  if (!rec) return null;
  const v = extractFeatures(rec.samples, rec.sampleRate);
  // Reject if the recording was mostly silence.
  const sum = v.reduce((s, x) => s + Math.abs(x), 0);
  if (sum < 10) return null;
  return v;
}

/** Short snapshot-based verify — samples ~1.2s of ambient audio and compares. */
export async function verifyVoice(
  enrolled: VoicePrintVector,
  threshold: number
): Promise<{ score: number; pass: boolean } | null> {
  const rec = await recordSamples(1200);
  if (!rec) return null;
  const v = extractFeatures(rec.samples, rec.sampleRate);
  const score = cosineSimilarity(enrolled, v);
  return { score, pass: score >= threshold };
}
