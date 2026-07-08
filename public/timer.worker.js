/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Bulletproof Background Timer Web Worker with Absolute Timestamp Delta Checks
// Keeps counting perfectly even if the worker thread is frozen or throttled by mobile OS.

let intervalId = null;
let targetEndTime = 0;
let timeLeftAtPause = 0;
let isPaused = false;

self.onmessage = function (e) {
  const { action, duration } = e.data;

  const tick = () => {
    if (isPaused) return;
    
    const now = Date.now();
    const currentLeft = Math.max(0, Math.ceil((targetEndTime - now) / 1000));
    
    self.postMessage({ type: 'tick', timeLeft: currentLeft });

    if (currentLeft <= 0) {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
      self.postMessage({ type: 'finished' });
    }
  };

  if (action === 'start') {
    isPaused = false;
    targetEndTime = Date.now() + (duration * 1000);
    
    if (intervalId) {
      clearInterval(intervalId);
    }
    
    // Immediate tick
    tick();

    intervalId = setInterval(tick, 1000);
  }

  if (action === 'pause') {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    isPaused = true;
    const now = Date.now();
    timeLeftAtPause = Math.max(0, Math.ceil((targetEndTime - now) / 1000));
    self.postMessage({ type: 'paused', timeLeft: timeLeftAtPause });
  }

  if (action === 'resume') {
    isPaused = false;
    // Recalculate target end time based on preserved remaining seconds
    targetEndTime = Date.now() + (timeLeftAtPause * 1000);
    
    if (intervalId) {
      clearInterval(intervalId);
    }
    
    tick();
    intervalId = setInterval(tick, 1000);
  }

  if (action === 'stop') {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
    isPaused = false;
    targetEndTime = 0;
    timeLeftAtPause = 0;
    self.postMessage({ type: 'stopped', timeLeft: 0 });
  }

  if (action === 'sync') {
    let currentLeft = 0;
    if (isPaused) {
      currentLeft = timeLeftAtPause;
    } else if (targetEndTime > 0) {
      currentLeft = Math.max(0, Math.ceil((targetEndTime - Date.now()) / 1000));
    }
    self.postMessage({ type: 'tick', timeLeft: currentLeft });
  }
};
