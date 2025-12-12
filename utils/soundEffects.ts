/**
 * Plays a generated sound effect for feedback.
 * @param isCorrect true for a positive chime, false for a gentle encouraging sound.
 */
export const playFeedbackSound = (isCorrect: boolean) => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (isCorrect) {
      // Happy Chime: C5 -> E5 -> G5 (Major Triad)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, t); // C5
      osc.frequency.setValueAtTime(659.25, t + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, t + 0.2); // G5
      
      // Volume envelope
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.15, t + 0.05);
      gain.gain.setValueAtTime(0.15, t + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      
      osc.start(t);
      osc.stop(t + 0.6);
    } else {
      // Gentle "Try Again" Sound: A4 -> E4 (Minor drop)
      // Uses triangle wave for a warmer, slightly distinctive tone vs the sine wave voice
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, t); // A4
      osc.frequency.linearRampToValueAtTime(329.63, t + 0.3); // E4
      
      // Volume envelope
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.08, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      
      osc.start(t);
      osc.stop(t + 0.5);
    }
  } catch (e) {
    console.warn("Could not play feedback sound", e);
  }
};