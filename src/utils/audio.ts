/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Web Audio API Synthesizer to generate beautiful chime / alarm sounds on demand
// No external assets required. Highly reliable.

let audioCtx: AudioContext | null = null;
let alertInterval: any = null;
let silentAudioElement: HTMLAudioElement | null = null;

export function startSilentLoop() {
  try {
    if (!silentAudioElement) {
      silentAudioElement = new Audio();
      // Standard 1-second silent WAV base64
      silentAudioElement.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
      silentAudioElement.loop = true;
    }
    silentAudioElement.play().catch(err => {
      console.warn('Silent audio play blocked by browser autoplay policy:', err);
    });
  } catch (err) {
    console.warn('Failed to start silent loop:', err);
  }
}

export function stopSilentLoop() {
  try {
    if (silentAudioElement) {
      silentAudioElement.pause();
    }
  } catch (err) {
    console.warn('Failed to stop silent loop:', err);
  }
}

export function unlockAudio() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => {
        console.log('AudioContext successfully unlocked on user gesture');
      }).catch(err => {
        console.warn('Failed to resume AudioContext:', err);
      });
    }
  } catch (err) {
    console.warn('Web Audio API not supported or failed to init:', err);
  }
}

export function playAlarm() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    // Clear any existing alert loop
    if (alertInterval) {
      clearInterval(alertInterval);
    }

    // Play a dual-tone chime every 1.5 seconds
    const playChime = () => {
      if (!audioCtx) return;
      const t = audioCtx.currentTime;

      // First tone (higher pitch)
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, t); // A5
      osc1.frequency.exponentialRampToValueAtTime(1200, t + 0.3);
      
      gain1.gain.setValueAtTime(0.15, t);
      gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.8);

      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(t);
      osc1.stop(t + 0.8);

      // Second tone (warm chord harmony)
      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(554.37, t + 0.1); // C#5
      
      gain2.gain.setValueAtTime(0.1, t + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.9);

      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(t + 0.1);
      osc2.stop(t + 0.9);
    };

    playChime();
    alertInterval = setInterval(playChime, 1500);

  } catch (err) {
    console.error('Failed to play alarm via Web Audio API:', err);
  }
}

let escalatedInterval: any = null;

export function playEscalatedAlarm() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    if (escalatedInterval) {
      clearInterval(escalatedInterval);
    }

    const playEmergencyBeep = () => {
      if (!audioCtx) return;
      const t = audioCtx.currentTime;

      // High frequency piercing beep
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth'; // piercing saw wave
      osc.frequency.setValueAtTime(2500, t); // high 2.5kHz pitch

      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.25);
    };

    playEmergencyBeep();
    escalatedInterval = setInterval(playEmergencyBeep, 400); // Frequent urgent beep
  } catch (err) {
    console.error('Failed to play escalated alarm:', err);
  }
}

export function stopEscalatedAlarm() {
  if (escalatedInterval) {
    clearInterval(escalatedInterval);
    escalatedInterval = null;
  }
}

export function stopAlarm() {
  if (alertInterval) {
    clearInterval(alertInterval);
    alertInterval = null;
  }
  if (escalatedInterval) {
    clearInterval(escalatedInterval);
    escalatedInterval = null;
  }
}

export function playFiveSecondWarningChime() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const t = audioCtx.currentTime;
    
    // Create a gentle sweet chime sound using harmonized oscillators
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(659.25, t); // E5 frequency for a bright, pleasant tone
    
    gain1.gain.setValueAtTime(0.08, t); // Soft, gentle volume level
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.4); // quick decay to simulate a small bell strike
    
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    
    osc1.start(t);
    osc1.stop(t + 0.4);

    // Overtone harmony (B5 frequency) for a pleasant sparkling resonance
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(987.77, t); // Harmonic B5
    
    gain2.gain.setValueAtTime(0.04, t); // even softer
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);
    
    osc2.start(t);
    osc2.stop(t + 0.3);
    
  } catch (err) {
    console.error('Failed to play 5-second remaining warning chime:', err);
  }
}
