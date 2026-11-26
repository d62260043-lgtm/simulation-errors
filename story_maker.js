const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { tts } = require('./tools/tts');

const TMP = '/tmp/story_ep1';
const W = 1080, H = 1920, FPS = 30;

function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64 });
  if (r.status !== 0) {
    console.log('CMD FAIL: ' + cmd + ' ' + args.join(' '));
    console.log(r.stderr.slice(-2000));
    throw new Error(cmd + ' fail');
  }
  return r;
}

const ff = a => run('ffmpeg', a);
const dur = f => parseFloat(String(run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).stdout).trim());
const tf = (n, t) => { const p = path.join(TMP, n); fs.writeFileSync(p, t); return p; };

(async () => {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });

  const ep = JSON.parse(fs.readFileSync('episode_1.json', 'utf8'));
  const videoSegs = [];
  const audioSegs = [];

  for (let i = 0; i < ep.scenes.length; i++) {
    const s = ep.scenes[i];
    console.log(`[Сцена ${i+1}/${ep.scenes.length}] Озвучка...`);
    
    // 1. Озвучка (все эффекты голоса теперь внутри tts.js)
    const rawWav = TMP + `/v${i}.wav`;
    await tts(s.text, TMP, rawWav);
    
    const padWav = TMP + `/vp${i}.wav`;
    ff(['-y', '-i', rawWav, '-ar', '44100', '-ac', '1', padWav]);
    
    audioSegs.push(padWav);
    const sDur = dur(padWav);

    // 2. Видео
    const imgPath = path.join(TMP, `img_${i}.jpg`);
    fs.copyFileSync(s.image, imgPath); 

    const out = TMP + `/s${i}.mp4`;
    
    let zoomExpr = "1"; 
    if (s.zoom === 'in') zoomExpr = "min(1.15,1+0.0008*on)";
    if (s.zoom === 'out') zoomExpr = "max(1,1.15-0.0008*on)";
    if (s.zoom === 'slow') zoomExpr = "min(1.08,1+0.0003*on)";

    let vf = `scale=4000:-1,zoompan=z='${zoomExpr}':d=1:s=${W}x${H}:fps=${FPS}`;
    
    if (s.zoom === 'shake') {
       vf = `scale=4000:-1,zoompan=z='min(1.2,1+0.002*sin(on/2))':d=1:s=${W}x${H}:fps=${FPS}`;
    }

    const lines = s.text.match(/.{1,25}(\s|$)/g) || [s.text];
    const txtFile = tf(`sub${i}.txt`, lines.join('\n'));

    let filterComplex = `[0:v]${vf},drawtext=expansion=none:fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:textfile=${txtFile}:fontcolor=white:fontsize=60:line_spacing=15:box=1:boxcolor=black@0.7:boxborderw=25:x=(w-text_w)/2:y=h-500[vf]`;

    ff(['-y', '-loop', '1', '-i', imgPath, '-filter_complex', filterComplex, '-map', '[vf]', 
        '-t', sDur.toFixed(2), '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-r', String(FPS), out]);
    
    videoSegs.push(out);
  }

  const vlist = tf('vlist.txt', videoSegs.map(f => `file '${f}'`).join('\n'));
  const alist = tf('alist.txt', audioSegs.map(f => `file '${f}'`).join('\n'));
  
  ff(['-y', '-f', 'concat', '-safe', '0', '-i', vlist, '-c', 'copy', TMP + '/main.mp4']);
  ff(['-y', '-f', 'concat', '-safe', '0', '-i', alist, '-c:a', 'pcm_s16le', TMP + '/voice.wav']);

  ff(['-y', '-i', TMP + '/main.mp4', '-i', TMP + '/voice.wav', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest', 'episode_1_final.mp4']);
  console.log('ГОТОВО! Видео сохранено как episode_1_final.mp4');
})();
