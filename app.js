const API = 'https:' + '//aihorde.net/api/v2/';
const TR = 'https:' + '//api.mymemory.translated.net/get?langpair=id|en&q=';
const EXP = 604800000;
let fSel = null, fUpSel = null;
const $ = id => document.getElementById(id);

$('fImg').onchange = e => {
  fSel = e.target.files.item(0);
  if (!fSel) return;
  const r = new FileReader();
  r.onload = v => { $('prev').src = v.target.result; $('prev').style.display = 'block'; $('bDel').style.display = 'inline-block'; $('mBox').style.display = 'block'; };
  r.readAsDataURL(fSel);
};
$('bDel').onclick = () => { fSel = null; $('fImg').value = ''; $('prev').style.display = 'none'; $('bDel').style.display = 'none'; $('mBox').style.display = 'none'; };

$('fUp').onchange = e => {
  fUpSel = e.target.files.item(0);
  if (!fUpSel) return;
  const r = new FileReader();
  r.onload = v => { $('prevUp').src = v.target.result; $('prevUp').style.display = 'block'; $('bDelUp').style.display = 'inline-block'; };
  r.readAsDataURL(fUpSel);
};
$('bDelUp').onclick = () => { fUpSel = null; $('fUp').value = ''; $('prevUp').style.display = 'none'; $('bDelUp').style.display = 'none'; };

async function keEn(t) {
  if (!t) return '';
  try { const r = await fetch(TR + encodeURIComponent(t)); const d = await r.json(); return d.responseData ? d.responseData.translatedText : t; } catch (e) { return t; }
}

async function pilihModelAktif() {
  try {
    const r = await fetch(API + 'status/models?type=image');
    const list = await r.json();
    const bagus = ['AlbedoBase XL (SDXL)', 'Juggernaut XL', 'DreamShaper', 'Deliberate'];
    const aktif = list.filter(m => m.count > 0 && bagus.some(b => m.name.includes(b))).map(m => m.name);
    return aktif.length ? aktif.slice(0, 3) : [];
  } catch (e) { return []; }
}

function openDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('RudyferdDB', 1);
    r.onupgradeneeded = e => e.target.result.createObjectStore('fotos', { keyPath: 'id', autoIncrement: true });
    r.onsuccess = e => res(e.target.result); r.onerror = e => rej(e);
  });
}

async function loadH() {
  const db = await openDB(), tx = db.transaction('fotos', 'readwrite'), st = tx.objectStore('fotos'), now = Date.now();
  const all = await new Promise(r => { const q = st.getAll(); q.onsuccess = () => r(q.result || []); });
  all.sort((a, b) => b.t - a.t);
  const ok = [];
  for (const x of all) { if (now - x.t >= EXP || ok.length >= 10) st.delete(x.id); else ok.push(x); }
  $('riwayat').innerHTML = ok.length ? ok.map(x => {
    const u = URL.createObjectURL(x.b), hr = Math.ceil((EXP - (now - x.t)) / 86400000);
    return `<div><img src="${u}"><span>${x.mp} MP • ${hr} hr</span><a class="btn-dl-sm" href="${u}" download="rf-${x.mp}MP-${x.id}.jpg">Download (${x.mp} MP)</a></div>`;
  }).join('') : 'Belum ada riwayat.';
}

async function saveH(b, mp) {
  const db = await openDB(), tx = db.transaction('fotos', 'readwrite');
  tx.objectStore('fotos').add({ b, mp, t: Date.now() }); tx.oncomplete = () => loadH();
}

function prepImg(f, w, h) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = e => {
      const i = new Image();
      i.onload = () => {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(i, 0, 0, w, h);
        const u = c.toDataURL('image/webp', 0.92); res(u.slice(u.indexOf(',') + 1));
      };
      i.src = e.target.result;
    };
    r.readAsDataURL(f);
  });
}

function prepProporsional(f) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = e => {
      const i = new Image();
      i.onload = () => {
        const maxSisi = 640, rasio = i.width / i.height;
        let w = i.width, h = i.height;
        if (w > maxSisi || h > maxSisi) {
          if (w >= h) { w = maxSisi; h = Math.round(maxSisi / rasio); }
          else { h = maxSisi; w = Math.round(maxSisi * rasio); }
        }
        w = Math.max(64, Math.round(w / 64) * 64);
        h = Math.max(64, Math.round(h / 64) * 64);
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(i, 0, 0, w, h);
        const u = c.toDataURL('image/webp', 0.94);
        res({ b64: u.slice(u.indexOf(',') + 1), w, h });
      };
      i.src = e.target.result;
    };
    r.readAsDataURL(f);
  });
}

function prosesAkhir(url, targetMP) {
  return new Promise(res => {
    const i = new Image(); i.crossOrigin = 'anonymous';
    i.onload = () => {
      const rasioAsli = i.width / i.height;
      let w = i.width, h = i.height;
      if ((w * h) / 1e6 < targetMP) { h = Math.round(Math.sqrt((targetMP * 1e6) / rasioAsli)); w = Math.round(h * rasioAsli); }
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
      x.drawImage(i, 0, 0, w, h);
      c.toBlob(b => res({ u: URL.createObjectURL(b), b, w, h, mp: ((w * h) / 1e6).toFixed(1) }), 'image/jpeg', 0.95);
    };
    i.src = url;
  });
}

async function jalankanHorde(pay, targetMP, labelProses) {
  $('bRun').disabled = true; $('bUpscale').disabled = true; $('hasil').innerHTML = '';
  try {
    const r = await fetch(API + 'generate/async', { method: 'POST', headers: { 'Content-Type': 'application/json', 'apikey': '0000000000' }, body: JSON.stringify(pay) });
    const j = await r.json();
    if (!j.id) throw new Error(j.errors ? JSON.stringify(j.errors) : (j.message || 'Gagal antrean'));
    while (true) {
      await new Promise(r => setTimeout(r, 3500));
      const c = await (await fetch(API + 'generate/status/' + j.id)).json();
      if (c.done && c.generations && c.generations.length) {
        $('stat').innerText = 'Menyelesaikan resolusi tinggi...';
        const raw = c.generations.shift().img, hd = await prosesAkhir(raw.startsWith('http') ? raw : 'data:image/webp;base64,' + raw, targetMP);
        $('hasil').innerHTML = `<img src="${hd.u}"><div style="font-size:12px;color:#aaa;margin-top:5px">${hd.w}x${hd.h} px (~${hd.mp} MP • ${labelProses})</div><a class="btn-dl" href="${hd.u}" download="rf-${hd.mp}MP.jpg">Simpan (${hd.mp} MP)</a>`;
        await saveH(hd.b, hd.mp); $('stat').innerText = 'Selesai!'; break;
      }
      $('stat').innerText = `${labelProses}... Antrean: ${c.queue_position || 0} (estimasi ${c.wait_time || 25} dtk)`;
    }
  } catch (e) { $('stat').innerText = 'Gagal: ' + e.message; }
  finally { $('bRun').disabled = false; $('bUpscale').disabled = false; }
}

$('bUpscale').onclick = async () => {
  if (!fUpSel) return alert('Pilih foto yang ingin di-upscale dulu!');
  const targetMP = parseInt($('skalaUp').value);
  $('stat').innerText = 'Menyiapkan foto untuk AI Real-ESRGAN...';
  const prep = await prepProporsional(fUpSel);
  const pay = {
    prompt: 'high resolution, ultra sharp, crisp details, clean texture, masterpiece',
    source_image: prep.b64,
    source_processing: 'img2img',
    params: {
      width: prep.w, height: prep.h, steps: 20, cfg_scale: 7,
      denoising_strength: 0.12, sampler_name: 'k_dpmpp_2m', karras: true, n: 1,
      post_processing: ['RealESRGAN_x4plus']
    },
    nsfw: false
  };
  await jalankanHorde(pay, targetMP, 'AI Upscale');
};

$('bRun').onclick = async () => {
  const pAsli = $('prm').value.trim(), prof = $('profesi').value;
  if (!pAsli && !prof) return alert('Isi perintah atau pilih pekerjaan!');
  const [w, h] = $('rasio').value.split(',').map(Number), targetMP = parseInt($('res').value), g = $('gaya').value;
  const safeW = Math.min(w, 640), safeH = Math.min(h, 640);
  $('stat').innerText = 'Mencari model AI terbaik...';
  const [pEn, modelsAktif] = await Promise.all([keEn(pAsli), pilihModelAktif()]);
  const gab = [pEn, prof, g].filter(Boolean).join(', ');
  const neg = 'blurry, low quality, distorted, duplicate, bad anatomy, deformed, ugly, text, watermark';
  const pay = {
    prompt: gab + ' ### ' + neg,
    params: { width: safeW, height: safeH, steps: 28, cfg_scale: 7.5, sampler_name: 'k_dpmpp_2m', karras: true, n: 1, post_processing: targetMP >= 4 ? ['RealESRGAN_x4plus'] : [] },
    nsfw: false
  };
  if (modelsAktif.length) pay.models = modelsAktif;
  if (fSel) {
    pay.source_image = await prepImg(fSel, safeW, safeH);
    pay.source_processing = 'img2img';
    pay.params.denoising_strength = $('mode').value === 'wajah' ? 0.48 : 0.35;
  }
  await jalankanHorde(pay, targetMP, 'AI Generate');
};

loadH();
