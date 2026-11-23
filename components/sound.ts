// Sounds. Off by default; the audio context is created lazily after a user gesture.
// Spin: public/audio/spin.mp3 (1 s, played at 75% speed) loops from the pull until the result shows. Result: a tiny synthesized chime.
let ctx: AudioContext | null = null;

function ac() {
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new C();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, slideTo?: number) {
  const c = ac(), t = c.currentTime + delay;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + dur);
}

// ---- spin loop
const SPIN_URL = "/audio/spin.mp3";
const SPIN_GAIN = 0.8;
const SPIN_RATE = 0.75;   // a little slower and deeper, as approved for this clip
let spinBuf: Promise<AudioBuffer | null> | null = null;
let loopEnd = 0;          // end of the audible part: the clip's quiet tail is skipped so the loop has no gap
let spinSrc: { src: AudioBufferSourceNode; gain: GainNode } | null = null;

function loadSpin() {
  if (!spinBuf) {
    spinBuf = fetch(SPIN_URL)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => ac().decodeAudioData(b))
      .then((buf) => { loopEnd = audibleEnd(buf); return buf; })
      .catch(() => { spinBuf = null; return null; });   // try again next time
  }
  return spinBuf;
}

function audibleEnd(buf: AudioBuffer) {
  const d = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
  let z = d.length - 1;
  while (z > 0 && Math.abs(d[z]) < peak * 0.05) z--;
  return (z + 1) / buf.sampleRate;
}

function spinStop() {
  if (!spinSrc || !ctx) return;
  const { src, gain } = spinSrc, t = ctx.currentTime;
  spinSrc = null;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(0, t + 0.12);      // short fade, no click
  src.stop(t + 0.13);
}

async function spinStart() {
  spinStop();
  const buf = await loadSpin();
  if (!buf) return;
  const c = ac();
  const src = c.createBufferSource(), gain = c.createGain();
  src.buffer = buf;
  src.playbackRate.value = SPIN_RATE;
  src.loop = true;                                       // repeats until the result shows (sfx.end)
  src.loopStart = 0;
  src.loopEnd = loopEnd || buf.duration;
  gain.gain.setValueAtTime(0, c.currentTime);
  gain.gain.linearRampToValueAtTime(SPIN_GAIN, c.currentTime + 0.03);   // soft start, no click
  src.connect(gain).connect(c.destination);
  src.start();
  spinSrc = { src, gain };
}

/** Must run inside a tap/click/key handler: phones (iPhone Safari above all) only allow sound to start there.
 *  Creates/resumes the audio context and plays one silent sample, which unlocks audio for the rest of the visit. */
function unlock() {
  try {
    // iOS 17+: treat this as media playback, so the ring/silent switch doesn't mute it
    const nav = navigator as unknown as { audioSession?: { type: string } };
    if (nav.audioSession) nav.audioSession.type = "playback";
  } catch { /* not supported */ }
  const c = ac();
  const b = c.createBuffer(1, 1, 22050), src = c.createBufferSource();
  src.buffer = b;
  src.connect(c.destination);
  src.start(0);
  void loadSpin();
}

export const sfx = {
  unlock,
  /** Call when sound is switched on, so the spin sound is ready before the first pull. */
  preload: () => { void loadSpin(); },
  start: () => { void spinStart(); },
  /** All reels have stopped (or the spin was cancelled). */
  end: spinStop,
  stop: () => { tone(140, 0.14, "square", 0.08, 0, 60); tone(900, 0.06, "triangle", 0.05); },
};
