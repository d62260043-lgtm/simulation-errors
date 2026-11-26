const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// Голос: aidar или baya (baya звучит чуть спокойнее/старше)
const SPEAKER = process.env.TTS_SPEAKER || 'baya';

async function tts(text, tmp, outWav) {
  const rawWav = path.join(tmp, 'raw_' + Date.now() + '.wav');
  const txtFile = path.join(tmp, 'say_' + Date.now() + '.txt');
  fs.writeFileSync(txtFile, text);

  // 1. Вызов Silero через Python
  const r = spawnSync('python3', [
    path.join(__dirname, 'tts_silero.py'),
    txtFile,
    rawWav,
    SPEAKER
  ], { encoding: 'utf8' });

  if (r.status !== 0) {
    throw new Error('Silero fail: ' + String(r.stderr || '').slice(-500));
  }

  if (!fs.existsSync(rawWav) || fs.statSync(rawWav).size < 5000) {
    throw new Error('Silero пусто');
  }

  // 2. Лёгкая обработка (чуть замедлить, чтобы звучало спокойнее)
  // Убрали понижение тона, чтобы не было «демона»
  const r2 = spawnSync('ffmpeg', [
    '-y', '-i', rawWav,
    '-af', 'atempo=0.92,apad=pad_dur=0.6',
    '-ar', '44100', '-ac', '1', outWav
  ], { encoding: 'utf8' });

  if (r2.status !== 0) {
    throw new Error('ffmpeg fail: ' + String(r2.stderr || '').slice(-500));
  }

  console.log('голос: Silero (' + SPEAKER + '), atempo 0.92');
  return outWav;
}

module.exports = { tts };
