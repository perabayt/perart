// perArt — ana sahne: proje seçici + iki görüntüleyici
//  · AJWA maketleri: js/iso.js (AJWA projesinden; pişmiş ışıklı GLB'ler site/maket/)
//  · Süpermarket: viewer.js (yalnız seçilince yüklenir, ~40 MB)
const BILGI = {
  'ajwa-sultanahmet': ['Otel binası · Sultanahmet, İstanbul', 'AJWA Sultanahmet'],
  'ajwa-kapadokya': ['Otel ve arazi · Kapadokya', 'AJWA Cappadocia'],
  'deluxe-vertical-king': ['Otel odası · AJWA Sultanahmet', 'Deluxe Vertical King'],
  'supermarket': ['Süpermarket · 603 m²', 'Süpermarket'],
};
const sahne = document.getElementById('sahne');
const isoEl = document.getElementById('iso-sahne');
const ubEl = document.getElementById('ub-sahne');
const turEl = document.getElementById('sahne-tur');
const adEl = document.getElementById('sahne-ad');
const sekmeler = [...document.querySelectorAll('.secici-oge')];

let secili = null, aktif = null, sira = 0, isoMod = null, marketYuklendi = false;

async function sec(id, kaydir = false) {
  if (kaydir) document.getElementById('maketler').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  if (id === secili) return;
  secili = id;
  sekmeler.forEach(b => b.setAttribute('aria-selected', String(b.dataset.proje === id)));
  sahne.dataset.proje = id;
  [turEl.textContent, adEl.textContent] = BILGI[id];
  aktif?.kapat(); aktif = null;
  const n = ++sira;

  if (id === 'supermarket') {
    isoEl.hidden = true; ubEl.hidden = false;
    if (!marketYuklendi) { marketYuklendi = true; await import('./viewer.js'); }
    window.perartBaslat?.();
    return;
  }
  ubEl.hidden = true; isoEl.hidden = false;
  isoEl.innerHTML = '<p class="iso__yuk">Maket yükleniyor</p>';
  try {
    isoMod ??= await import('./js/iso.js');
    const x = await isoMod.kur(isoEl, id, 0, {
      gecerli: () => n === sira, dinamik: true, dpr: 1.6,
      pay: innerWidth < 761 ? 1.02 : 1.08,
    });
    if (!x) return;
    if (n !== sira) { x.kapat(); return; }
    aktif = x;
  } catch (e) {
    console.error(e);
    if (n === sira) isoEl.innerHTML = '<p class="iso__yuk">Maket yüklenemedi, sayfayı yenileyin</p>';
  }
}

sekmeler.forEach(b => b.addEventListener('click', () => sec(b.dataset.proje)));
document.querySelectorAll('.maket-ac').forEach(b => b.addEventListener('click', () => sec(b.dataset.proje, true)));

// ilk maket: sayfa yüklenir yüklenmez (yazı tipleri ve görseller önce)
const basla = () => sec('ajwa-sultanahmet');
if (document.readyState === 'complete') basla(); else addEventListener('load', basla, { once: true });

// ipucu ilk etkileşimde kaybolur
const ipucu = document.getElementById('sahne-ipucu');
sahne.addEventListener('pointerdown', () => ipucu.classList.add('gizli'), { once: true });
