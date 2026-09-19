/* Nostalgic music box: five original little tunes, synthesised live with Web Audio (no audio files, nothing downloaded).
   Tunes take turns in a shuffled order (never the same one twice in a row, and a different first tune from last visit),
   each in a randomly chosen key, so it rarely sounds the same twice.
   Browsers only allow sound after the visitor taps or clicks, so play() arms itself and starts on the first tap. */
(() => {
  "use strict";
  const LOOKAHEAD = 0.3, GAP_BEATS = 2;
  const CH = { // [bass, chord tones...]
    C: [48, 60, 64, 67], G: [43, 59, 62, 67], F: [41, 60, 65, 69], Am: [45, 60, 64, 69], E: [40, 59, 64, 68]
  };
  // melody: [midi, beats] (0 = rest). chords: one per bar.
  const TUNES = [
    { name: "Music-box waltz", bpm: 92, meter: 3, sound: "box",
      chords: ["C", "G", "C", "G", "F", "C", "G", "C", "C", "G", "G", "Am", "F", "C", "G", "C"],
      melody: [[76, 1], [79, 1], [84, 1], [83, 2], [81, 1], [79, 1], [76, 1], [77, 1], [79, 3],
        [81, 1], [84, 1], [81, 1], [79, 2], [76, 1], [74, 1], [76, 1], [77, 1], [76, 3],
        [76, 1], [79, 1], [84, 1], [86, 2], [84, 1], [83, 1], [81, 1], [79, 1], [81, 3],
        [77, 1], [81, 1], [79, 1], [76, 2], [72, 1], [74, 1], [79, 1], [71, 1], [72, 3]] },
    { name: "Sleepy lullaby", bpm: 76, meter: 4, sound: "celesta",
      chords: ["C", "Am", "F", "G", "C", "Am", "G", "C"],
      melody: [[67, 2], [76, 2], [74, 1], [72, 1], [69, 2], [72, 1], [74, 1], [77, 2], [76, 2], [74, 2],
        [67, 2], [76, 1], [79, 1], [81, 2], [76, 2], [77, 1], [76, 1], [74, 1], [71, 1], [72, 4]] },
    { name: "Skipping to the park", bpm: 112, meter: 4, sound: "box",
      chords: ["C", "F", "G", "C", "C", "F", "G", "C"],
      melody: [[72, .5], [76, .5], [79, .5], [76, .5], [84, 1], [79, 1],
        [81, .5], [79, .5], [77, .5], [81, .5], [84, 2],
        [83, .5], [81, .5], [79, .5], [74, .5], [79, 1], [83, 1],
        [84, 1], [79, 1], [76, 2],
        [76, .5], [77, .5], [79, .5], [81, .5], [79, 1], [76, 1],
        [77, .5], [79, .5], [81, .5], [84, .5], [81, 2],
        [79, 1], [86, 1], [83, .5], [81, .5], [79, 1],
        [84, 3], [0, 1]] },
    { name: "Rainy window", bpm: 80, meter: 3, sound: "celesta",
      chords: ["Am", "F", "C", "G", "Am", "F", "E", "Am"],
      melody: [[81, 1], [84, 1], [88, 1], [86, 2], [84, 1], [76, 1], [79, 1], [84, 1], [83, 3],
        [81, 1], [83, 1], [84, 1], [81, 2], [77, 1], [80, 1], [83, 1], [76, 1], [81, 3]] },
    { name: "Carousel ride", bpm: 132, meter: 3, sound: "flute",
      chords: ["C", "C", "G", "G", "F", "C", "G", "C"],
      melody: [[79, .5], [81, .5], [79, 1], [76, 1], [84, 2], [79, 1],
        [86, .5], [84, .5], [83, 1], [79, 1], [74, 2], [0, 1],
        [77, .5], [79, .5], [81, 1], [84, 1], [88, 2], [84, 1],
        [83, 1], [86, 1], [83, 1], [84, 2], [0, 1]] }
  ];
  const KEYS = [-3, -2, 0, 0, 2, 3]; // semitone shifts: same tune, different colour

  // iPhones keep Web Audio quiet unless the page has also started a media element, so a tiny silent
  // looping clip is started on the same tap. It also keeps the sound alive when switching apps.
  const SILENT = "data:audio/mpeg;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjYwLjE2LjEwMAAAAAAAAAAAAAAA//NwwAAAAAAAAAAAAEluZm8AAAAPAAAAEgAAAo0AUVFRUVFcXFxcXFxmZmZmZnBwcHBwcHp6enp6hISEhISEj4+Pj4+ZmZmZmZmjo6Ojo66urq6urri4uLi4uMLCwsLCzMzMzMzM1tbW1tbh4eHh4eHr6+vr6/X19fX19f//////AAAAAExhdmM2MC4zMQAAAAAAAAAAAAAAACQDzAAAAAAAAAKNGWyvZwAAAAAAAAAAAAAAAAD/8xDEAAAAA0gAAAAATEFNRTMuMTAwVVVVVf/zEsQNAAADSAAAAABVVVVVVVVVVVVVVVVVVf/zEMQbAAADSAAAAABVVVVVVVVVVVVVVVVV//MQxCgAAANIAAAAAFVVVVVVVVVVVVVVVVX/8xDENQAAA0gAAAAAVVVVVVVVVVVVVVVVVf/zEMRCAAADSAAAAABVVVVVVVVVVVVVVVVV//MQxE8AAANIAAAAAFVVVVVVVVVVVVVVVVX/8xDEXAAAA0gAAAAAVVVVVVVVVVVVVVVVVf/zEMRpAAADSAAAAABVVVVVVVVVVVVVVVVV//MSxHYAAANIAAAAAFVVVVVVVVVVVVVVVVVV//MQxIQAAANIAAAAAFVVVVVVVVVVVVVVVVX/8xDEkQAAA0gAAAAAVVVVVVVVVVVVVVVVVf/zEMSeAAADSAAAAABVVVVVVVVVVVVVVVVV//MQxKsAAANIAAAAAFVVVVVVVVVVVVVVVVX/8xDEuAAAA0gAAAAAVVVVVVVVVVVVVVVVVf/zEMTFAAADSAAAAABVVVVVVVVVVVVVVVVV//MQxNIAAANIAAAAAFVVVVVVVVVVVVVVVVX/8xLE3wAAA0gAAAAAVVVVVVVVVVVVVVVVVVU=";
  let keeper = null;
  function keepAlive() {
    try {
      if (!keeper) { keeper = new Audio(SILENT); keeper.loop = true; keeper.volume = 0.001; keeper.setAttribute("playsinline", ""); }
      keeper.play().catch(() => {});
    } catch { /* ignore */ }
  }
  let ctx = null, master = null, timer = null;
  let wanted = false, armed = false;
  let cur = null; // { tune, shift, start, beat, events, idx, total }
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  const pickShift = () => KEYS[(Math.random() * KEYS.length) | 0];
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
  };
  let order = [], lastTune = +(store.get("pm:lastTune") ?? -1);
  function nextTuneIndex() {
    if (!order.length) {
      order = TUNES.map((_, i) => i);
      for (let i = order.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [order[i], order[j]] = [order[j], order[i]]; }
      if (order[0] === lastTune) order.push(order.shift()); // never the same tune twice in a row
    }
    lastTune = order.shift(); store.set("pm:lastTune", String(lastTune));
    return lastTune;
  }

  function voice(t, midi, dur, gain, type, decay, attack = 0.01) {
    const o = ctx.createOscillator(), g = ctx.createGain(), end = t + Math.max(dur, decay);
    o.type = type; o.frequency.value = hz(midi);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    o.connect(g).connect(master);
    o.start(t); o.stop(end + 0.05);
  }
  const SOUNDS = {
    box(t, m, d) { voice(t, m, d, 0.22, "sine", 1.6); voice(t, m + 12, d, 0.05, "triangle", 0.5); },
    celesta(t, m, d) { voice(t, m, d, 0.2, "sine", 2.2); voice(t, m + 24, d, 0.03, "sine", 0.35); },
    flute(t, m, d) { voice(t, m, d * 0.9, 0.12, "triangle", d * 0.9, 0.06); voice(t, m + 12, d * 0.9, 0.02, "sine", d * 0.9, 0.06); }
  };

  function load(when) {
    const tune = TUNES[nextTuneIndex()], shift = pickShift(), beat = 60 / tune.bpm, events = [];
    let b = 0;
    for (const [m, d] of tune.melody) { if (m) events.push({ at: b, kind: "note", m: m + shift, d }); b += d; }
    tune.chords.forEach((name, bar) => {
      const ch = CH[name].map(n => n + shift), t0 = bar * tune.meter;
      events.push({ at: t0, kind: "bass", m: ch[0], d: tune.meter - 1 });
      const offs = tune.meter === 4 ? [1, 3] : [1, 2];
      if (tune.meter === 4) events.push({ at: t0 + 2, kind: "bass", m: ch[0] + 7, d: 1 });
      for (const k of offs) for (const n of ch.slice(1)) events.push({ at: t0 + k, kind: "chord", m: n, d: 0.4 });
    });
    events.sort((a, b2) => a.at - b2.at);
    cur = { tune, beat, events, idx: 0, start: when, total: tune.chords.length * tune.meter };
  }
  function schedule() {
    const until = ctx.currentTime + LOOKAHEAD;
    for (;;) {
      const { events, beat, start } = cur;
      while (cur.idx < events.length && start + events[cur.idx].at * beat < until) {
        const e = events[cur.idx++], t = Math.max(start + e.at * beat, ctx.currentTime);
        if (e.kind === "note") SOUNDS[cur.tune.sound](t, e.m, e.d * beat);
        else if (e.kind === "bass") voice(t, e.m, e.d * beat, 0.12, "sine", 1.8);
        else voice(t, e.m, e.d, 0.025, "triangle", 0.45);
      }
      const nextStart = start + (cur.total + GAP_BEATS) * beat;
      if (cur.idx >= events.length && nextStart < until) load(nextStart); else break;
    }
  }
  function begin() {
    keepAlive();
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      ctx = new AC();
      const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3200; // warm, old-tape feel
      master = ctx.createGain(); master.gain.value = 0;
      master.connect(lp).connect(ctx.destination);
    }
    ctx.resume().then(() => {
      if (!wanted || muted()) return;
      const now = ctx.currentTime + 0.1;
      load(now);
      master.gain.cancelScheduledValues(now);
      master.gain.setValueAtTime(0.0001, now);
      master.gain.linearRampToValueAtTime(0.5, now + 1.5);
      clearInterval(timer); timer = setInterval(schedule, 60); schedule();
      sync();
      // If the sound never actually starts (iPhone side switch on silent, or audio blocked), say so once.
      const t0 = ctx.currentTime;
      setTimeout(() => {
        if (!timer) return;
        if (ctx.state !== "running" || ctx.currentTime - t0 < 0.2) window.PM_TOAST?.("🔇 No music? Check your phone's silent switch.");
      }, 1200);
    }).catch(() => {});
  }
  function onGesture(e) {
    if (e.target.closest?.("#musicBtn")) return; // the button handles itself
    disarm(); if (wanted) begin();
  }
  function arm() { if (armed) return; armed = true; addEventListener("pointerdown", onGesture, true); addEventListener("keydown", onGesture, true); }
  function disarm() { armed = false; removeEventListener("pointerdown", onGesture, true); removeEventListener("keydown", onGesture, true); }
  const playing = () => !!(ctx && timer && ctx.state === "running");
  const muted = () => store.get("pm:music") === "off";
  const setMuted = v => store.set("pm:music", v ? "off" : "on");

  function fadeOut() {
    if (!ctx || !timer) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0.0001, now + 0.6);
    const t = timer; timer = null;
    setTimeout(() => { clearInterval(t); if (!timer) ctx.suspend().catch(() => {}); }, 700);
  }
  function play() {
    wanted = true;
    if (!muted() && !playing()) {
      if (ctx && ctx.state !== "closed" && navigator.userActivation?.hasBeenActive) begin();
      else { arm(); if (navigator.userActivation?.hasBeenActive) begin(); }
    }
    sync();
  }
  function stop() { wanted = false; disarm(); fadeOut(); try { keeper?.pause(); } catch { /* ignore */ } sync(); }

  /* ---------- the floating 🎵 button ---------- */
  let btn = null;
  function sync() {
    if (!btn) return;
    btn.hidden = !wanted;
    const on = wanted && !muted();
    btn.setAttribute("aria-pressed", String(on));
    btn.textContent = on ? "🎵" : "🔇";
    btn.title = on ? `Music on${cur && playing() ? `: ${cur.tune.name}` : ""} (tap to mute)` : "Music off (tap to play)";
    btn.classList.toggle("waiting", on && !playing());
  }
  function mount() {
    btn = document.getElementById("musicBtn"); if (!btn) return;
    btn.addEventListener("click", () => {
      if (muted() || !playing()) { setMuted(false); disarm(); begin(); }
      else { setMuted(true); fadeOut(); }
      sync();
    });
    setInterval(sync, 1000);
    sync();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();

  window.PM_MUSIC = { play, stop, tunes: TUNES.map(t => t.name), now: () => cur && playing() ? cur.tune.name : "" };
})();
