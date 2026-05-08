let audioCtx: AudioContext | null = null;

export function ensureAudio(): void {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
}

/** 구간 전환 시 짧은 스팅 (메인 루프에서 존 변화에만 호출). */
export function playThemeSting(zone: number): void {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(120 + zone * 32, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.07, now + 0.04);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
  osc.connect(gain).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.34);
}
