/* Basement Media Lab — 8-track multi-track recorder (Portastudio-style)
 * Record / overdub / layer clips. Not limited to one drum pattern playback.
 *
 * Mount: <div id="multiTrackDeck"></div>
 * Optional: window.DOSWAPZ_BEAT for "LAY BEAT" bounce from the drum machine.
 */
(function () {
  'use strict';

  var NUM_TRACKS = 8;
  var tracks = [];
  var ctx = null;
  var micStream = null;
  var micSource = null;
  var recordDest = null;
  var mediaRecorder = null;
  var recordChunks = [];
  var recording = false;
  var playing = false;
  var playSources = [];
  var playStartTime = 0;
  var meterTimer = null;
  var statusEl = null;

  function audio() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg || '';
  }

  function stamp() {
    var d = new Date();
    return (
      d.getFullYear() +
      String(d.getMonth() + 1).padStart(2, '0') +
      String(d.getDate()).padStart(2, '0') +
      '-' +
      String(d.getHours()).padStart(2, '0') +
      String(d.getMinutes()).padStart(2, '0')
    );
  }

  function fmtTime(sec) {
    if (!sec || !isFinite(sec)) return '0:00';
    var s = Math.max(0, Math.floor(sec));
    var m = Math.floor(s / 60);
    s = s % 60;
    return m + ':' + String(s).padStart(2, '0');
  }

  function longestDuration() {
    var max = 0;
    tracks.forEach(function (t) {
      if (t.buffer && t.buffer.duration > max) max = t.buffer.duration;
    });
    return max;
  }

  function anySolo() {
    return tracks.some(function (t) {
      return t.solo && t.buffer;
    });
  }

  function trackAudible(t) {
    if (!t.buffer) return false;
    if (t.mute) return false;
    // Don't monitor the track you're replacing while recording
    if (recording && t.armed) return false;
    if (anySolo() && !t.solo) return false;
    return true;
  }

  function updateTrackUI(i) {
    var t = tracks[i];
    var row = document.querySelector('.mt-row[data-track="' + i + '"]');
    if (!row) return;
    row.classList.toggle('mt-armed', !!t.armed);
    row.classList.toggle('mt-has-clip', !!t.buffer);
    row.classList.toggle('mt-mute', !!t.mute);
    row.classList.toggle('mt-solo', !!t.solo);
    var armBtn = row.querySelector('.mt-arm');
    if (armBtn) {
      armBtn.classList.toggle('is-on', !!t.armed);
      var compactArm =
        !!(row.closest && row.closest('.mt-is-compact')) ||
        !!(document.getElementById('multiTrackDeck') &&
          document.getElementById('multiTrackDeck').classList.contains('mt-is-compact'));
      armBtn.textContent = t.armed
        ? compactArm
          ? '●'
          : '● REC'
        : compactArm
          ? '○'
          : '○ ARM';
    }
    var muteBtn = row.querySelector('.mt-mute-btn');
    if (muteBtn) muteBtn.classList.toggle('is-on', !!t.mute);
    var soloBtn = row.querySelector('.mt-solo-btn');
    if (soloBtn) soloBtn.classList.toggle('is-on', !!t.solo);
    var info = row.querySelector('.mt-info');
    if (info) {
      info.textContent = t.buffer
        ? fmtTime(t.buffer.duration) + (t.name ? ' · ' + t.name : '')
        : 'empty';
    }
    var wave = row.querySelector('.mt-wave');
    if (wave && t.buffer) drawWave(wave, t.buffer, t.color);
    else if (wave) {
      var c = wave.getContext('2d');
      c.clearRect(0, 0, wave.width, wave.height);
    }
  }

  function drawWave(canvas, buffer, color) {
    var w = canvas.width;
    var h = canvas.height;
    var c = canvas.getContext('2d');
    c.fillStyle = '#0a0510';
    c.fillRect(0, 0, w, h);
    var data = buffer.getChannelData(0);
    var step = Math.max(1, Math.floor(data.length / w));
    c.strokeStyle = color || '#ff66cc';
    c.lineWidth = 1;
    c.beginPath();
    var mid = h / 2;
    for (var x = 0; x < w; x++) {
      var min = 1;
      var max = -1;
      var start = x * step;
      for (var j = 0; j < step && start + j < data.length; j++) {
        var v = data[start + j];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      c.moveTo(x, mid + min * mid * 0.9);
      c.lineTo(x, mid + max * mid * 0.9);
    }
    c.stroke();
  }

  function stopPlayback() {
    playSources.forEach(function (s) {
      try {
        s.stop();
      } catch (e) {}
    });
    playSources = [];
    playing = false;
    var btn = document.getElementById('mtPlayBtn');
    if (btn) btn.textContent = '▶ PLAY ALL';
    document.querySelectorAll('.mt-row').forEach(function (r) {
      r.classList.remove('mt-playing');
    });
  }

  function playAll(fromSec) {
    stopPlayback();
    var ac = audio();
    var startAt = ac.currentTime + 0.05;
    var offset = fromSec || 0;
    var any = false;
    tracks.forEach(function (t, i) {
      if (!trackAudible(t)) return;
      any = true;
      var src = ac.createBufferSource();
      src.buffer = t.buffer;
      var g = ac.createGain();
      g.gain.value = typeof t.gain === 'number' ? t.gain : 0.9;
      src.connect(g);
      g.connect(ac.destination);
      try {
        src.start(startAt, offset);
      } catch (e) {
        src.start(startAt);
      }
      playSources.push(src);
      var row = document.querySelector('.mt-row[data-track="' + i + '"]');
      if (row) row.classList.add('mt-playing');
    });
    if (!any) {
      setStatus('No clips to play — arm a track and record, or LAY BEAT onto a track.');
      return;
    }
    playing = true;
    playStartTime = startAt - offset;
    var btn = document.getElementById('mtPlayBtn');
    if (btn) btn.textContent = '■ STOP';
    setStatus('Playing mix · ' + tracks.filter(function (t) { return trackAudible(t); }).length + ' tracks');
    var dur = longestDuration() - offset;
    if (dur > 0) {
      setTimeout(function () {
        if (playing) stopPlayback();
      }, dur * 1000 + 80);
    }
  }

  async function ensureMic() {
    if (micStream) return micStream;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Mic not supported in this browser');
    }
    micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });
    return micStream;
  }

  function blobToBuffer(blob) {
    return blob.arrayBuffer().then(function (ab) {
      return audio().decodeAudioData(ab.slice(0));
    });
  }

  async function stopRecording() {
    if (!recording || !mediaRecorder) return;
    return new Promise(function (resolve) {
      mediaRecorder.onstop = async function () {
        recording = false;
        var recBtn = document.getElementById('mtRecordBtn');
        if (recBtn) {
          recBtn.classList.remove('is-recording');
          recBtn.textContent = '● RECORD';
        }
        if (meterTimer) {
          clearInterval(meterTimer);
          meterTimer = null;
        }
        var blob = new Blob(recordChunks, {
          type: mediaRecorder.mimeType || 'audio/webm'
        });
        recordChunks = [];
        var armed = tracks
          .map(function (t, i) {
            return t.armed ? i : -1;
          })
          .filter(function (i) {
            return i >= 0;
          });
        if (!armed.length) {
          setStatus('Record finished but no track was armed.');
          resolve();
          return;
        }
        try {
          var buffer = await blobToBuffer(blob);
          armed.forEach(function (i) {
            tracks[i].buffer = buffer;
            tracks[i].blob = blob;
            tracks[i].name = 'take-' + stamp();
            tracks[i].armed = false;
            updateTrackUI(i);
          });
          setStatus(
            'Recorded ' +
              fmtTime(buffer.duration) +
              ' onto track(s) ' +
              armed.map(function (n) {
                return n + 1;
              }).join(', ') +
              ' · hit PLAY ALL to hear the mix'
          );
        } catch (err) {
          console.error(err);
          setStatus('Could not decode recording — try Chrome/Edge.');
        }
        resolve();
      };
      try {
        mediaRecorder.stop();
      } catch (e) {
        recording = false;
        resolve();
      }
    });
  }

  async function startRecording() {
    var armedIdx = [];
    tracks.forEach(function (t, i) {
      if (t.armed) armedIdx.push(i);
    });
    if (!armedIdx.length) {
      setStatus('Arm a track first (click ○ on TR1–TR8) then hit ● RECORD.');
      return;
    }
    if (!window.MediaRecorder) {
      setStatus('MediaRecorder not supported — use Chrome or Edge.');
      return;
    }
    try {
      await ensureMic();
    } catch (err) {
      setStatus('Mic blocked — click the lock icon in the address bar → allow microphone.');
      return;
    }

    audio();
    // Hear other (non-armed) tracks while overdubbing
    var others = tracks.some(function (t, i) {
      return t.buffer && !t.armed && trackAudible(t);
    });
    if (others && !playing) playAll(0);

    recordChunks = [];
    var mime = '';
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) mime = 'audio/webm;codecs=opus';
    else if (MediaRecorder.isTypeSupported('audio/webm')) mime = 'audio/webm';
    else if (MediaRecorder.isTypeSupported('audio/mp4')) mime = 'audio/mp4';
    try {
      mediaRecorder = mime
        ? new MediaRecorder(micStream, { mimeType: mime })
        : new MediaRecorder(micStream);
    } catch (e) {
      mediaRecorder = new MediaRecorder(micStream);
    }
    mediaRecorder.ondataavailable = function (e) {
      if (e.data && e.data.size) recordChunks.push(e.data);
    };
    mediaRecorder.start(100);
    recording = true;
    var recBtn = document.getElementById('mtRecordBtn');
    if (recBtn) {
      recBtn.classList.add('is-recording');
      recBtn.textContent = '■';
    }
    var trackList = armedIdx
      .map(function (n) {
        return n + 1;
      })
      .join(', ');
    setStatus(
      '● RECORDING → TR' +
        trackList +
        (others ? ' · other tracks playing (overdub)' : ' · speak/sing into mic') +
        ' · click ● again to stop'
    );
  }

  async function toggleRecord() {
    if (recording) await stopRecording();
    else await startRecording();
  }

  /* 10 distinct sample beats — random pick on ★ SAMPLE after clear */
  var SAMPLE_BEATS = [
    {
      id: 1,
      name: 'BOOM BAP',
      bpm: 92,
      pattern: {
        kick: [1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
        clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        ch: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0],
        oh: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        ltom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
        mtom: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
        rim: [0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0]
      }
    },
    {
      id: 2,
      name: 'TRAP HATS',
      bpm: 140,
      pattern: {
        kick: [1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
        ch: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
        oh: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
        ltom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        mtom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
        rim: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0]
      }
    },
    {
      id: 3,
      name: 'LOFI SWING',
      bpm: 84,
      pattern: {
        kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        ch: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
        oh: [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1],
        ltom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
        mtom: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        rim: [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]
      }
    },
    {
      id: 4,
      name: 'FOUR ON FLOOR',
      bpm: 124,
      pattern: {
        kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        ch: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        oh: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
        ltom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        mtom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        rim: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0]
      }
    },
    {
      id: 5,
      name: 'DNB BREAK',
      bpm: 174,
      pattern: {
        kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        ch: [1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1],
        oh: [0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
        ltom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
        mtom: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        rim: [0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0]
      }
    },
    {
      id: 6,
      name: 'REGGAETON',
      bpm: 96,
      pattern: {
        kick: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        clap: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
        ch: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        oh: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        ltom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
        mtom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0],
        rim: [0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0]
      }
    },
    {
      id: 7,
      name: 'PHONK',
      bpm: 130,
      pattern: {
        kick: [1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        clap: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0],
        ch: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
        oh: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        ltom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
        mtom: [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        rim: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
      }
    },
    {
      id: 8,
      name: 'HALFTIME',
      bpm: 70,
      pattern: {
        kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
        snare: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
        clap: [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
        ch: [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1],
        oh: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ltom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        mtom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
        rim: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0]
      }
    },
    {
      id: 9,
      name: 'AFROBEAT',
      bpm: 105,
      pattern: {
        kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        clap: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
        ch: [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1],
        oh: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0],
        ltom: [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        mtom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
        rim: [0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0]
      }
    },
    {
      id: 10,
      name: 'STRIPPED 808',
      bpm: 100,
      pattern: {
        kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0],
        snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        clap: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        ch: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
        oh: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
        ltom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        mtom: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        rim: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0]
      }
    }
  ];

  var lastSampleId = -1;

  function pickRandomSample() {
    if (SAMPLE_BEATS.length === 1) return SAMPLE_BEATS[0];
    var pick;
    var guard = 0;
    do {
      pick = SAMPLE_BEATS[Math.floor(Math.random() * SAMPLE_BEATS.length)];
      guard++;
    } while (pick.id === lastSampleId && guard < 12);
    lastSampleId = pick.id;
    return pick;
  }

  /** Synthesize a sample beat into OfflineAudioContext and park it on a track */
  async function layBeatOnTrack(trackIndex, sampleOrNull) {
    var i = typeof trackIndex === 'number' ? trackIndex : 0;
    var sample = sampleOrNull || SAMPLE_BEATS[0];
    setStatus('Rendering ' + sample.name + ' → track ' + (i + 1) + '…');
    try {
      var sampleRate = 44100;
      var bpm = sample.bpm || 96;
      var steps = 16;
      var bars = 4;
      var stepDur = 60 / bpm / 4;
      var barDur = steps * stepDur;
      var total = bars * barDur + 0.4;
      var OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      var offline = new OfflineCtx(2, Math.ceil(sampleRate * total), sampleRate);

      function env(ac, t, a, d, g) {
        var n = ac.createGain();
        n.gain.setValueAtTime(0.0001, t);
        n.gain.exponentialRampToValueAtTime(g, t + a);
        n.gain.exponentialRampToValueAtTime(0.0001, t + d);
        return n;
      }
      function kick(ac, t) {
        var o = ac.createOscillator();
        var g = env(ac, t, 0.002, 0.42, 1.0);
        o.type = 'sine';
        o.frequency.setValueAtTime(165, t);
        o.frequency.exponentialRampToValueAtTime(42, t + 0.09);
        o.connect(g);
        g.connect(ac.destination);
        o.start(t);
        o.stop(t + 0.45);
      }
      function noise(ac, t, dur, freq, gain, open) {
        var len = Math.floor(ac.sampleRate * dur);
        var buf = ac.createBuffer(1, len, ac.sampleRate);
        var d = buf.getChannelData(0);
        for (var n = 0; n < len; n++) {
          d[n] = (Math.random() * 2 - 1) * Math.pow(1 - n / len, open ? 1.2 : 2.4);
        }
        var src = ac.createBufferSource();
        src.buffer = buf;
        var f = ac.createBiquadFilter();
        f.type = open ? 'highpass' : 'bandpass';
        f.frequency.value = freq;
        var g = env(ac, t, 0.001, dur * 0.9, gain);
        src.connect(f);
        f.connect(g);
        g.connect(ac.destination);
        src.start(t);
        src.stop(t + dur + 0.02);
      }
      function tom(ac, t, freq) {
        var o = ac.createOscillator();
        var g = env(ac, t, 0.002, 0.22, 0.65);
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, t);
        o.frequency.exponentialRampToValueAtTime(freq * 0.55, t + 0.08);
        o.connect(g);
        g.connect(ac.destination);
        o.start(t);
        o.stop(t + 0.25);
      }
      function rim(ac, t) {
        var o = ac.createOscillator();
        var g = env(ac, t, 0.001, 0.06, 0.45);
        o.type = 'square';
        o.frequency.value = 820;
        o.connect(g);
        g.connect(ac.destination);
        o.start(t);
        o.stop(t + 0.08);
      }

      var pattern = sample.pattern;

      for (var bar = 0; bar < bars; bar++) {
        for (var s = 0; s < steps; s++) {
          var t = bar * barDur + s * stepDur;
          if (pattern.kick[s]) kick(offline, t);
          if (pattern.snare[s]) noise(offline, t, 0.18, 1800, 0.8, false);
          if (pattern.clap[s]) {
            [0, 0.012, 0.024].forEach(function (off) {
              noise(offline, t + off, 0.05, 1600, 0.5, false);
            });
          }
          if (pattern.ch[s]) noise(offline, t, 0.04, 7000, 0.2, true);
          if (pattern.oh[s]) noise(offline, t, 0.14, 7000, 0.32, true);
          if (pattern.ltom[s]) tom(offline, t, 110);
          if (pattern.mtom[s]) tom(offline, t, 165);
          if (pattern.rim[s]) rim(offline, t);
        }
      }

      var rendered = await offline.startRendering();
      tracks[i].buffer = rendered;
      tracks[i].blob = null;
      tracks[i].name = sample.name + ' · ' + bpm + 'bpm';
      tracks[i].armed = false;
      updateTrackUI(i);
      setStatus(
        'SAMPLE ' +
          sample.id +
          '/10 · ' +
          sample.name +
          ' @ ' +
          bpm +
          ' BPM → TRACK ' +
          (i + 1) +
          ' (' +
          fmtTime(rendered.duration) +
          '). Arm TR2+ and RECORD to overdub.'
      );
    } catch (err) {
      console.error(err);
      setStatus('Could not lay beat — browser blocked offline audio.');
    }
  }

  async function loadRandomSample(trackIndex) {
    var sample = pickRandomSample();
    await layBeatOnTrack(typeof trackIndex === 'number' ? trackIndex : 0, sample);
  }

  /** Render whatever is currently on the beat maker into a track */
  async function layFromBeatMaker(trackIndex) {
    var i = typeof trackIndex === 'number' ? trackIndex : 0;
    if (window.DOSWAPZ_BEAT && typeof window.DOSWAPZ_BEAT.getPattern === 'function') {
      try {
        if (window.DOSWAPZ_BEAT.stop) window.DOSWAPZ_BEAT.stop();
      } catch (e) {}
      var p = window.DOSWAPZ_BEAT.getPattern();
      if (!p || !p.grid) {
        setStatus('Beat maker has no pattern — ★ SAMPLE first.');
        return;
      }
      var has = false;
      Object.keys(p.grid).forEach(function (k) {
        if (p.grid[k] && p.grid[k].some(function (v) { return !!v; })) has = true;
      });
      if (!has) {
        setStatus('Beat maker is empty — program pads or ★ SAMPLE first.');
        throw new Error('empty pattern');
      }
      await layBeatOnTrack(i, {
        id: 0,
        name: 'BEAT MAKER',
        bpm: p.bpm || 96,
        pattern: p.grid
      });
      return;
    }
    await loadRandomSample(i);
  }

  function layBufferOnTrack(trackIndex, buffer, name) {
    var i = typeof trackIndex === 'number' ? trackIndex : 0;
    if (!buffer) {
      setStatus('No MIDI clip to lay.');
      return;
    }
    if (i < 0 || i >= tracks.length) i = 0;
    tracks[i].buffer = buffer;
    tracks[i].blob = null;
    tracks[i].name = name || 'MIDI';
    tracks[i].armed = false;
    updateTrackUI(i);
    setStatus((name || 'MIDI') + ' → TRACK ' + (i + 1) + ' (' + fmtTime(buffer.duration) + ')');
  }

  function clearTrack(i) {
    tracks[i].buffer = null;
    tracks[i].blob = null;
    tracks[i].name = '';
    tracks[i].armed = false;
    updateTrackUI(i);
    setStatus('Track ' + (i + 1) + ' cleared');
  }

  function downloadTrack(i) {
    var t = tracks[i];
    if (!t.buffer && !t.blob) {
      setStatus('Track ' + (i + 1) + ' is empty');
      return;
    }
    if (t.blob) {
      var url = URL.createObjectURL(t.blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'doswapz-track' + (i + 1) + '-' + stamp() + '.webm';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 3000);
      setStatus('Downloaded track ' + (i + 1));
      return;
    }
    // WAV from buffer
    var buffer = t.buffer;
    var channels = buffer.numberOfChannels;
    var sampleRate = buffer.sampleRate;
    var samples = buffer.length;
    var blockAlign = channels * 2;
    var dataSize = samples * blockAlign;
    var out = new ArrayBuffer(44 + dataSize);
    var view = new DataView(out);
    var offset = 0;
    function wstr(s) {
      for (var k = 0; k < s.length; k++) view.setUint8(offset + k, s.charCodeAt(k));
      offset += s.length;
    }
    wstr('RIFF');
    view.setUint32(offset, 36 + dataSize, true);
    offset += 4;
    wstr('WAVE');
    wstr('fmt ');
    view.setUint32(offset, 16, true);
    offset += 4;
    view.setUint16(offset, 1, true);
    offset += 2;
    view.setUint16(offset, channels, true);
    offset += 2;
    view.setUint32(offset, sampleRate, true);
    offset += 4;
    view.setUint32(offset, sampleRate * blockAlign, true);
    offset += 4;
    view.setUint16(offset, blockAlign, true);
    offset += 2;
    view.setUint16(offset, 16, true);
    offset += 2;
    wstr('data');
    view.setUint32(offset, dataSize, true);
    offset += 4;
    var chData = [];
    for (var c = 0; c < channels; c++) chData.push(buffer.getChannelData(c));
    for (var s = 0; s < samples; s++) {
      for (var ch = 0; ch < channels; ch++) {
        var sample = Math.max(-1, Math.min(1, chData[ch][s]));
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
        offset += 2;
      }
    }
    var blob = new Blob([out], { type: 'audio/wav' });
    var u = URL.createObjectURL(blob);
    var a2 = document.createElement('a');
    a2.href = u;
    a2.download = 'doswapz-track' + (i + 1) + '-' + stamp() + '.wav';
    document.body.appendChild(a2);
    a2.click();
    a2.remove();
    setTimeout(function () {
      URL.revokeObjectURL(u);
    }, 3000);
    setStatus('Downloaded track ' + (i + 1) + ' as WAV');
  }

  var COLORS = [
    '#ff66cc',
    '#00ff41',
    '#ffff00',
    '#66ccff',
    '#cc88ff',
    '#ff8800',
    '#88ff88',
    '#ff4444'
  ];

  function buildUI() {
    var root = document.getElementById('multiTrackDeck');
    if (!root) return;
    var compact =
      root.classList.contains('mt-compact') ||
      !!(root.closest && root.closest('.studio-tracks'));

    tracks = [];
    for (var i = 0; i < NUM_TRACKS; i++) {
      tracks.push({
        buffer: null,
        blob: null,
        armed: false,
        mute: false,
        solo: false,
        gain: 0.9,
        name: '',
        color: COLORS[i]
      });
    }

    var waveW = compact ? 120 : 220;
    var waveH = compact ? 22 : 36;
    var html = '';
    if (!compact) {
      html +=
        '<div class="mt-banner">8-TRACK MULTI-TRACK RECORDER · overdub layers · not just one beat loop</div>';
    }
    html +=
      '<div class="mt-transport">' +
      '<button type="button" class="mt-btn mt-play" id="mtPlayBtn" title="Play mix">▶' +
      (compact ? '' : ' PLAY') +
      '</button>' +
      '<button type="button" class="mt-btn mt-rec" id="mtRecordBtn" title="Record armed track">●' +
      (compact ? '' : ' RECORD') +
      '</button>' +
      '<button type="button" class="mt-btn mt-sample" id="mtSampleBtn" title="Random sample beat → TR1">★' +
      (compact ? '' : ' SAMPLE') +
      '</button>' +
      '<button type="button" class="mt-btn mt-beat" id="mtLayBeatBtn" title="Lay current/default beat → TR1">⬇' +
      (compact ? ' TR1' : ' LAY → TR1') +
      '</button>' +
      '<button type="button" class="mt-btn" id="mtStopBtn">STOP</button>' +
      '<button type="button" class="mt-btn" id="mtClearAllBtn">' +
      (compact ? 'CLR' : 'CLEAR ALL') +
      '</button>' +
      '<span class="mt-status" id="mtStatus">' +
      (compact
        ? '★ SAMPLE / arm / ● rec'
        : 'CLEAR → ★ SAMPLE (10 styles) · arm + RECORD overdub') +
      '</span>' +
      '</div>';
    if (!compact) {
      html +=
        '<div class="mt-help">' +
        '<strong>How:</strong> 1) <em>★ SAMPLE</em> loads 1 of 10 random beats onto TR1. ' +
        '2) <em>○ ARM</em> track 2. 3) <em>● RECORD</em> mic overdub. 4) <em>▶ PLAY</em> full mix.' +
        '</div>';
    }
    html += '<div class="mt-tracks">';

    for (var n = 0; n < NUM_TRACKS; n++) {
      html +=
        '<div class="mt-row" data-track="' +
        n +
        '" style="--mt-color:' +
        COLORS[n] +
        '">' +
        '<div class="mt-num" style="color:' +
        COLORS[n] +
        '">' +
        (compact ? String(n + 1) : 'TR ' + (n + 1)) +
        '</div>' +
        '<button type="button" class="mt-arm" data-i="' +
        n +
        '">' +
        (compact ? '○' : '○ ARM') +
        '</button>' +
        '<button type="button" class="mt-mute-btn" data-i="' +
        n +
        '">M</button>' +
        '<button type="button" class="mt-solo-btn" data-i="' +
        n +
        '">S</button>' +
        '<canvas class="mt-wave" width="' +
        waveW +
        '" height="' +
        waveH +
        '" data-i="' +
        n +
        '"></canvas>' +
        '<div class="mt-info">empty</div>' +
        (compact
          ? ''
          : '<label class="mt-gain-wrap">LVL <input type="range" class="mt-gain" data-i="' +
            n +
            '" min="0" max="100" value="90"></label>') +
        '<button type="button" class="mt-dl" data-i="' +
        n +
        '" title="Download">⬇</button>' +
        '<button type="button" class="mt-clr" data-i="' +
        n +
        '" title="Clear">✕</button>' +
        '</div>';
    }
    html += '</div>';
    root.innerHTML = html;
    if (compact) root.classList.add('mt-is-compact');
    statusEl = document.getElementById('mtStatus');

    root.addEventListener('click', function (e) {
      var arm = e.target.closest('.mt-arm');
      if (arm) {
        var ai = parseInt(arm.getAttribute('data-i'), 10);
        tracks[ai].armed = !tracks[ai].armed;
        // only one armed track at a time feels more tape-like for overdubs
        if (tracks[ai].armed) {
          tracks.forEach(function (t, idx) {
            if (idx !== ai) t.armed = false;
            updateTrackUI(idx);
          });
        } else updateTrackUI(ai);
        setStatus(
          tracks[ai].armed
            ? 'Track ' + (ai + 1) + ' armed · hit ● RECORD to capture mic'
            : 'Track ' + (ai + 1) + ' disarmed'
        );
        return;
      }
      var mute = e.target.closest('.mt-mute-btn');
      if (mute) {
        var mi = parseInt(mute.getAttribute('data-i'), 10);
        tracks[mi].mute = !tracks[mi].mute;
        updateTrackUI(mi);
        return;
      }
      var solo = e.target.closest('.mt-solo-btn');
      if (solo) {
        var si = parseInt(solo.getAttribute('data-i'), 10);
        tracks[si].solo = !tracks[si].solo;
        updateTrackUI(si);
        return;
      }
      var clr = e.target.closest('.mt-clr');
      if (clr) {
        clearTrack(parseInt(clr.getAttribute('data-i'), 10));
        return;
      }
      var dl = e.target.closest('.mt-dl');
      if (dl) {
        downloadTrack(parseInt(dl.getAttribute('data-i'), 10));
        return;
      }
      if (e.target.id === 'mtPlayBtn') {
        if (playing) stopPlayback();
        else playAll(0);
        return;
      }
      if (e.target.id === 'mtStopBtn') {
        if (recording) stopRecording();
        stopPlayback();
        setStatus('Stopped');
        return;
      }
      if (e.target.id === 'mtRecordBtn') {
        toggleRecord();
        return;
      }
      if (e.target.id === 'mtSampleBtn') {
        if (recording) stopRecording();
        stopPlayback();
        loadRandomSample(0);
        return;
      }
      if (e.target.id === 'mtLayBeatBtn') {
        if (recording) stopRecording();
        stopPlayback();
        // Prefer current beat-maker pattern; fallback to sample pack #1
        layFromBeatMaker(0).catch(function () {
          layBeatOnTrack(0, SAMPLE_BEATS[0]);
        });
        return;
      }
      if (e.target.id === 'mtClearAllBtn') {
        if (recording) stopRecording();
        stopPlayback();
        tracks.forEach(function (_, idx) {
          clearTrack(idx);
        });
        setStatus('All 8 tracks cleared · hit ★ SAMPLE for a random beat (10 styles)');
      }
    });

    root.addEventListener('input', function (e) {
      if (!e.target.classList.contains('mt-gain')) return;
      var gi = parseInt(e.target.getAttribute('data-i'), 10);
      tracks[gi].gain = (parseInt(e.target.value, 10) || 0) / 100;
    });

    tracks.forEach(function (_, idx) {
      updateTrackUI(idx);
    });
  }

  // styles injected once
  function injectStyles() {
    if (document.getElementById('mtDeckStyles')) return;
    var s = document.createElement('style');
    s.id = 'mtDeckStyles';
    s.textContent =
      '#multiTrackDeck{font-family:VT323,Courier New,monospace;}' +
      '.mt-banner{color:#ffaa00;letter-spacing:3px;font-size:15px;margin-bottom:10px;border:1px solid #664400;padding:6px 10px;background:#120800;}' +
      '.mt-transport{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:12px;}' +
      '.mt-btn{font-family:inherit;font-size:16px;letter-spacing:2px;border:2px solid #ff66cc;background:#12001a;color:#ff66cc;padding:6px 12px;cursor:pointer;}' +
      '.mt-btn:hover{background:#1a0033;color:#fff;}' +
      '.mt-play{border-color:#00ff41;color:#00ff41;}' +
      '.mt-rec{border-color:#ff2244;color:#ff4466;}' +
      '.mt-rec.is-recording{background:#400010;animation:mtBlink 0.6s step-end infinite;}' +
      '.mt-beat{border-color:#ffaa00;color:#ffaa00;}' +
      '.mt-sample{border-color:#66ccff;color:#66ccff;}' +
      '.mt-sample:hover{background:#001a2a;color:#aaddff;}' +
      '@keyframes mtBlink{50%{opacity:0.45}}' +
      '.mt-status{flex:1 1 200px;color:#9988aa;font-size:14px;letter-spacing:1px;min-width:160px;}' +
      '.mt-help{font-size:14px;color:#8877aa;line-height:1.4;margin-bottom:14px;padding:8px 10px;border:1px dashed #442266;}' +
      '.mt-help strong{color:#ffaa00;}' +
      '.mt-help em{color:#66ccff;font-style:normal;}' +
      '.mt-tracks{display:flex;flex-direction:column;gap:6px;}' +
      '.mt-row{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:8px;border:1px solid #333;background:#0a0610;}' +
      '.mt-row.mt-armed{border-color:#ff2244;box-shadow:0 0 12px rgba(255,40,60,0.25);}' +
      '.mt-row.mt-has-clip{border-color:#553377;}' +
      '.mt-row.mt-playing{outline:1px solid #00ff41;}' +
      '.mt-num{width:42px;font-size:16px;letter-spacing:1px;flex-shrink:0;}' +
      '.mt-arm,.mt-mute-btn,.mt-solo-btn,.mt-dl,.mt-clr{font-family:inherit;font-size:14px;letter-spacing:1px;border:1px solid #555;background:#140a1a;color:#ccc;padding:4px 8px;cursor:pointer;}' +
      '.mt-arm.is-on{border-color:#ff2244;color:#ff4466;background:#2a0010;}' +
      '.mt-mute-btn.is-on,.mt-solo-btn.is-on{border-color:#ffaa00;color:#ffaa00;}' +
      '.mt-wave{flex:1 1 160px;max-width:280px;height:36px;background:#050208;border:1px solid #222;}' +
      '.mt-info{min-width:90px;font-size:13px;color:#888;}' +
      '.mt-gain-wrap{font-size:12px;color:#777;display:flex;align-items:center;gap:4px;}' +
      '.mt-gain{width:70px;}' +
      '@media(max-width:640px){.mt-wave{max-width:100%;width:100%;order:10;}}' +
      /* Compact board (right/bottom of studio) */
      '#multiTrackDeck.mt-is-compact .mt-transport{gap:5px;margin-bottom:8px;}' +
      '#multiTrackDeck.mt-is-compact .mt-btn{font-size:12px;padding:3px 6px;letter-spacing:0;border-width:1px;}' +
      '#multiTrackDeck.mt-is-compact .mt-status{font-size:11px;flex:1 1 100%;min-width:0;}' +
      '#multiTrackDeck.mt-is-compact .mt-tracks{gap:3px;}' +
      '#multiTrackDeck.mt-is-compact .mt-row{gap:4px;padding:4px 5px;flex-wrap:nowrap;}' +
      '#multiTrackDeck.mt-is-compact .mt-num{width:16px;font-size:12px;text-align:center;}' +
      '#multiTrackDeck.mt-is-compact .mt-arm,#multiTrackDeck.mt-is-compact .mt-mute-btn,' +
      '#multiTrackDeck.mt-is-compact .mt-solo-btn,#multiTrackDeck.mt-is-compact .mt-dl,' +
      '#multiTrackDeck.mt-is-compact .mt-clr{font-size:11px;padding:2px 5px;min-width:22px;}' +
      '#multiTrackDeck.mt-is-compact .mt-wave{flex:1 1 auto;width:100%;max-width:none;height:22px;}' +
      '#multiTrackDeck.mt-is-compact .mt-info{min-width:0;flex:0 1 52px;font-size:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}';
    document.head.appendChild(s);
  }

  function boot() {
    injectStyles();
    buildUI();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.DOSWAPZ_MULTITRACK = {
    layBeatOnTrack: layBeatOnTrack,
    layFromBeatMaker: layFromBeatMaker,
    layBufferOnTrack: layBufferOnTrack,
    loadRandomSample: loadRandomSample,
    sampleBeats: SAMPLE_BEATS,
    playAll: playAll,
    stop: function () {
      if (recording) stopRecording();
      stopPlayback();
    }
  };
})();
