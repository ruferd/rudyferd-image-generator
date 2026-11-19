const API = 'https:' + '//aihorde.net/api/v2/generate/';
const TR = 'https:' + '//api.mymemory.translated.net/get?langpair=id|en&q=';
const EXP = 604800000;
let fSel = null;
const $ = id => document.getElementById(id);

$('fImg').onchange = e => {
  fSel = e.target.files.item(0);
  if (!fSel) return;
  const r = new FileReader();
  r.onload = v => {
    $('prev').src = v.target.result;
    $('prev').style.display = 'block';
    $('bDel').style.display = 'inline-block';
    $('mBox').style.display = 'block';
  };
  r.readAsDataURL(fSel);
};

$('bDel').onclick = () => {
  fSel = null; $('fImg').value = '';
  $('prev').style.display = 'none';
  $('bDel').style.display = 'none';
  $('mBox').style.display = 'none';
};

async function keEn(t) {
  if (!t) return '';
  try {
    const r = await fetch(TR + encodeURIComponent(t));
    const d = await r.json();
    return d.responseData ? d.responseData.translatedText : t;
  } catch (e) { return t; }
}

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('RudyferdDB', 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore('fotos', { keyPath: 'id', autoIncrement: true });
    r.onsuccess = e => res(e.target.result);
    r.onerror = e => rej(e);
  });
}

async function loadH() {
  const db = await openDB(), tx = db.transaction('fotos', 'readwrite'), st = tx.objectStore('fotos'), now = Date.now();
  const all = await new Promise(r => { const q = st.getAll(); q.onsuccess = () => r(q.result || []); });
  all.sort((a, b) => b.t - a.t);
  const ok = [];
  for (const x of all) {
    if (now - x.t >= EXP || ok.length >= 10) st.delete(x.id);
    else ok.push(x);
  }
  $('riwayat').innerHTML = ok.length ? ok.map(x => {
    const u = URL.createObjectURL(x.b);
    const hr = Math.ceil((EXP - (now - x.t)) / 86400000);
    return `<div><img src="${u}"><span>${x.mp} MP • ${hr} hr</span><a class="btn-dl-sm" href="${u}" download="rf-${x.mp}MP-${x.id}.jpg">Download (${x.mp} MP)</a></div>`;
  }).join('') : 'Belum ada riwayat.';
}

async function saveH(b, mp) {
  const db = await openDB(), tx = db.transaction('fotos', 'readwrite');
  tx.objectStore('fotos').add({ b, mp, t: Date.now() });
  tx.oncomplete = () => loadH();
}

function prepImg(f, w, h) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = e => {
      const i = new Image();
      i.onload = () => {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(i, 0, 0, w, h);
        const u = c.toDataURL('image/webp', 0.88);
        res(u.slice(u.indexOf(',') + 1));
      };
      i.src = e.target.result;
    };
    r.readAsDataURL(f);
  });
}

function upRes(url, s) {
  return new Promise(res => {
    const i = new Image(); i.crossOrigin = 'anonymous';
    i.onload = () => {
      const w = Math.round(i.width * s), h = Math.round(i.height * s);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage(i, 0, 0, w, h);
      c.toBlob(b => res({ u: URL.createObjectURL(b), b, w, h, mp: ((w * h) / 1e6).toFixed(1) }), 'image/jpeg', 0.92);
    };
    i.src = url;
  });
}

$('bRun').onclick = async () => {
  const pAsli = $('prm').value.trim(), prof = $('profesi').value;
  if (!pAsli && !prof) return alert('Isi perintah atau pilih pekerjaan!');
  const [w, h] = $('rasio').value.split(',').map(Number), s = parseFloat($('res').value), g = $('gaya').value;
  const safeW = Math.min(w, 640), safeH = Math.min(h, 640);
  $('bRun').disabled = true; $('hasil').innerHTML = ''; $('stat').innerText = 'Menerjemahkan...';
  try {
    const pEn = await keEn(pAsli), gab = [pEn, prof, g].filter(Boolean).join(', ');
    const neg = 'blurry, low quality, distorted, duplicate, multiple people, bad anatomy, bad face, ugly, text';
    $('stat').innerText = 'Memproses: ' + (pEn || prof);
    const pay = {
      prompt: gab + ' ### ' + neg,
      params: { width: safeW, height: safeH, steps: 25, cfg_scale: 7.5, sampler_name: 'k_dpmpp_2m', karras: true, n: 1 },
      nsfw: false
    };
    if (fSel) {
      pay.source_image = await prepImg(fSel, safeW, safeH);
      pay.source_processing = 'img2img';
      pay.params.denoising_strength = $('mode').value === 'wajah' ? 0.65 : 0.45;
    }
    const r = await fetch(API + 'async', { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': '0000000000' }, body: JSON.stringify(pay) });
    const j = await r.json();
    if (!j.id) throw new Error(j.errors ? JSON.stringify(j.errors) : (j.message || 'Gagal antrean'));
    while (true) {
      await new Promise(r => setTimeout(r, 3500));
      const c = await (await fetch(API + 'status/' + j.id)).json();
      if (c.done && c.generations && c.generations.length) {
        $('stat').innerText = 'Meningkatkan resolusi...';
        const raw = c.generations.shift().img, hd = await upRes(raw.startsWith('http') ? raw : 'data:image/webp;base64,' + raw, s);
        $('hasil').innerHTML = `<img src="${hd.u}"><div style="font-size:12px;color:#aaa;margin-top:5px">${hd.w}x${hd.h} px (~${hd.mp} MP)</div><a class="btn-dl" href="${hd.u}" download="rf-${hd.mp}MP.jpg">Simpan (${hd.mp} MP)</a>`;
        await saveH(hd.b, hd.mp); $('stat').innerText = 'Selesai!'; break;
      }
      $('stat').innerText = `Antrean: ${c.queue_position || 0} (estimasi ${c.wait_time || 20} dtk)`;
    }
  } catch (e) { $('stat').innerText = 'Gagal: ' + e.message; } finally { $('bRun').disabled = false; }
};
loadH();
