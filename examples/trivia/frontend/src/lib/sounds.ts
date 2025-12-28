/**
 * Sound effects for the trivia game using Web Audio API
 * Generates sounds programmatically - no audio files needed
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume: number = 0.3
) {
  const ctx = getAudioContext();
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

  // Fade out to avoid clicks
  gainNode.gain.setValueAtTime(volume, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + duration);
}

/**
 * Kitchen timer tick - plays when 10 seconds or less remaining
 */
export function playTimerTick() {
  playTone(800, 0.08, "square", 0.15);
}

/**
 * Urgent timer tick - plays when 5 seconds or less remaining
 */
export function playTimerUrgent() {
  const ctx = getAudioContext();

  // Double beep for urgency
  playTone(1000, 0.06, "square", 0.2);
  setTimeout(() => {
    playTone(1200, 0.06, "square", 0.2);
  }, 80);
}

/**
 * Time expired buzzer
 */
export function playTimeExpired() {
  const ctx = getAudioContext();

  // Descending buzz
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(400, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);

  gainNode.gain.setValueAtTime(0.25, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.3);
}

/**
 * Correct answer chime
 */
export function playCorrect() {
  const ctx = getAudioContext();

  // Ascending triumphant notes
  const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
  notes.forEach((freq, i) => {
    setTimeout(() => {
      playTone(freq, 0.15, "sine", 0.25);
    }, i * 100);
  });
}

/**
 * Wrong answer sound
 */
export function playWrong() {
  const ctx = getAudioContext();

  // Descending minor notes
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = "triangle";
  oscillator.frequency.setValueAtTime(350, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.25);

  gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.25);
}

/**
 * Answer submitted whoosh
 */
export function playSubmit() {
  const ctx = getAudioContext();

  // Quick ascending swoosh
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(300, ctx.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.1);

  gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

  oscillator.start(ctx.currentTime);
  oscillator.stop(ctx.currentTime + 0.1);
}

/**
 * Game start fanfare
 */
export function playGameStart() {
  const notes = [392, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
  notes.forEach((freq, i) => {
    setTimeout(() => {
      playTone(freq, 0.2, "sine", 0.2);
    }, i * 120);
  });
}

/**
 * New question appear
 */
export function playQuestionStart() {
  playTone(600, 0.1, "sine", 0.15);
  setTimeout(() => {
    playTone(800, 0.15, "sine", 0.15);
  }, 100);
}

/**
 * Victory/celebration for winner
 */
export function playVictory() {
  const melody = [
    { freq: 523.25, delay: 0 },     // C5
    { freq: 659.25, delay: 100 },   // E5
    { freq: 783.99, delay: 200 },   // G5
    { freq: 1046.5, delay: 350 },   // C6
    { freq: 783.99, delay: 500 },   // G5
    { freq: 1046.5, delay: 650 },   // C6
  ];

  melody.forEach(({ freq, delay }) => {
    setTimeout(() => {
      playTone(freq, 0.18, "sine", 0.2);
    }, delay);
  });
}
