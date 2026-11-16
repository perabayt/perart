// perArt — sayfa etkilesimleri: belirme, ust bar, karsilastirma, sekmeler, sayaclar, isik kutusu, form
(() => {
  const azHareket = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- belirme (ekrana girince)
  const belirler = document.querySelectorAll('.belir, .kahraman-gorsel');
  if ('IntersectionObserver' in window && !azHareket) {
    const io = new IntersectionObserver(girdiler => {
      girdiler.forEach(g => {
        if (!g.isIntersecting) return;
        const el = g.target;
        const kardes = [...el.parentElement.children].filter(c => c.classList.contains('belir'));
        el.style.transitionDelay = Math.min(kardes.indexOf(el), 5) * 70 + 'ms';
        el.classList.add('gorundu');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    belirler.forEach(el => io.observe(el));
  } else {
    belirler.forEach(el => el.classList.add('gorundu'));
  }

  // ---- ust bar cizgisi
  const ust = document.getElementById('ust');
  const kaydir = () => ust.classList.toggle('kaydi', scrollY > 8);
  addEventListener('scroll', kaydir, { passive: true }); kaydir();

  // ---- plan / maket karsilastirma
  const k = document.getElementById('karsilastir');
  if (k) {
    const girdi = k.querySelector('.k-girdi');
    const ayarla = v => k.style.setProperty('--k', v + '%');
    girdi.addEventListener('input', () => ayarla(girdi.value));
    ayarla(girdi.value);
  }

  // ---- kusbakisi sekmeleri
  const sekmeler = document.querySelectorAll('[data-iso]');
  const isoResim = document.getElementById('iso-resim');
  const isoDugme = document.getElementById('iso-dugme');
  sekmeler.forEach(b => b.addEventListener('click', () => {
    const ad = b.dataset.iso;
    sekmeler.forEach(x => x.setAttribute('aria-selected', String(x === b)));
    isoResim.style.opacity = 0;
    const yeni = new Image();
    yeni.src = `img/${ad}.jpg`;
    const goster = () => {
      isoResim.srcset = `img/${ad}-k.jpg 1200w, img/${ad}.jpg 2400w`;
      isoResim.src = `img/${ad}.jpg`;
      isoResim.style.opacity = 1;
    };
    yeni.decode ? yeni.decode().then(goster, goster) : (yeni.onload = goster);
    isoDugme.dataset.buyut = `img/${ad}.jpg`;
    isoDugme.dataset.yazi = 'Kuşbakışı: ' + b.textContent.trim().toLowerCase();
  }));

  // ---- sayaclar
  const sayaclar = document.querySelectorAll('[data-say]');
  if ('IntersectionObserver' in window && !azHareket) {
    const io2 = new IntersectionObserver(g => g.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target, hedef = +el.dataset.say, t0 = performance.now();
      const adim = t => {
        const p = Math.min(1, (t - t0) / 1100), q = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(hedef * q);
        if (p < 1) requestAnimationFrame(adim);
      };
      requestAnimationFrame(adim);
      io2.unobserve(el);
    }), { threshold: 0.6 });
    sayaclar.forEach(el => io2.observe(el));
  }

  // ---- isik kutusu
  const kutu = document.getElementById('isik-kutusu');
  const kResim = kutu.querySelector('img');
  const kYazi = kutu.querySelector('figcaption');
  const liste = [...document.querySelectorAll('[data-buyut]')];
  let sira = 0, onceki = null;
  const ac = i => {
    sira = (i + liste.length) % liste.length;
    const el = liste[sira];
    kResim.src = el.dataset.buyut;
    kResim.alt = el.dataset.yazi || '';
    kYazi.textContent = el.dataset.yazi || '';
    if (kutu.hidden) { onceki = document.activeElement; kutu.hidden = false; document.body.style.overflow = 'hidden'; kutu.querySelector('.ik-kapat').focus(); }
  };
  const kapat = () => { kutu.hidden = true; document.body.style.overflow = ''; onceki && onceki.focus(); };
  liste.forEach((el, i) => el.addEventListener('click', () => ac(i)));
  kutu.querySelector('.ik-kapat').addEventListener('click', kapat);
  kutu.querySelector('.ik-onceki').addEventListener('click', () => ac(sira - 1));
  kutu.querySelector('.ik-sonraki').addEventListener('click', () => ac(sira + 1));
  kutu.addEventListener('click', e => { if (e.target === kutu) kapat(); });
  document.addEventListener('keydown', e => {
    if (kutu.hidden) return;
    if (e.key === 'Escape') kapat();
    if (e.key === 'ArrowRight') ac(sira + 1);
    if (e.key === 'ArrowLeft') ac(sira - 1);
  });

  // ---- iletisim formu
  // ILETISIM_EPOSTA dolunca form, kullanicinin e-posta programinda hazir bir taslak acar.
  const ILETISIM_EPOSTA = '';
  const form = document.getElementById('form');
  const durum = document.getElementById('form-durum');
  form.addEventListener('submit', e => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(form));
    if (!v.ad.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.eposta)) {
      durum.textContent = 'Lütfen adınızı ve geçerli bir e-posta adresi yazın.';
      return;
    }
    if (!ILETISIM_EPOSTA) {
      durum.textContent = 'İletişim adresimiz çok yakında burada olacak. İlginiz için teşekkürler.';
      return;
    }
    const govde = `Ad: ${v.ad}\nFirma: ${v.firma}\nE-posta: ${v.eposta}\n\n${v.not}`;
    location.href = `mailto:${ILETISIM_EPOSTA}?subject=${encodeURIComponent('perArt maket talebi')}&body=${encodeURIComponent(govde)}`;
    durum.textContent = 'E-posta programınızda talebiniz hazırlandı; plan dosyanızı ekleyip gönderebilirsiniz.';
  });
})();
