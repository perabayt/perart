// perArt — etkilesimli 3D maket (three.js)
// Isik Blender Cycles ile kose basina pisirildi (gunes, gok, yansiyan isik, LED'ler);
// tarayici yalnizca pisirilmis isigi + parlak yuzey yansimalarini cizer, bu yuzden renderlara yakin gorunur.
// Fare: surukle = cevir, tekerlek = yakinlastir, sag tik = kaydir, cift tik = odaklan
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';

const S = 0.0295;                        // metre / plan pikseli
const p = (px, py, h = 0) => new THREE.Vector3((px - 78) * S, h, (py - 17) * S);
const MERKEZ = p(625, 430, 0);
const BINA = { x0: -0.3, x1: 32.0, z0: -0.3, z1: 22.3 };

const sahneEl = document.getElementById('ub-sahne');
const tuval = document.getElementById('ub-tuval');
const yuzdeEl = document.getElementById('ub-yuzde');
const cubukEl = document.getElementById('ub-cubuk');

// ------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ canvas: tuval, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
scene.background = new THREE.Color().setRGB(0.86, 0.86, 0.85, THREE.SRGBColorSpace);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;   // yalniz yansimalar icin
scene.environmentIntensity = 0.7;

const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 400);
const controls = new OrbitControls(camera, tuval);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.495;
controls.minDistance = 0.4;
controls.maxDistance = 110;
controls.screenSpacePanning = true;
controls.zoomToCursor = true;

// ------------------------------------------------------------ pisirilmis isik
// UV kanallari: uv=luv, uv1/uv2 = dis isik (rg, b), uv3/texcoord_4 = ic isik, texcoord_5/6 = urun 2. renk + lz
// glTF V eksenini ters yazar (v' = 1 - v): golgelendiricide geri cevrilir.
const ORTAK = { uIc: { value: 0 }, uIcK: { value: 0.72 }, uDisK: { value: 1.0 } };
const ISIK_PARCA = THREE.ShaderChunk.lights_fragment_maps
  .replace('iblIrradiance += getIBLIrradiance( geometryNormal );', '')
  .replace('#if defined( RE_IndirectDiffuse )', '#if defined( RE_IndirectDiffuse )\n\t\tirradiance += vBake * PI;');

const yukleyici = new THREE.TextureLoader();
const ATLAS = yukleyici.load('model/etiketler.jpg', t => { t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; gerekli = Math.max(gerekli, 3); });
ATLAS.colorSpace = THREE.SRGBColorSpace;
ATLAS.anisotropy = 8;
function foto(ad, olcek) {
  const ayar = (t, renkli) => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (renkli) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return {
    map: ayar(yukleyici.load(`model/doku/${ad}_renk.jpg`, () => { gerekli = Math.max(gerekli, 3); }), true),
    roughnessMap: ayar(yukleyici.load(`model/doku/${ad}_puruz.jpg`), false),
    normalMap: ayar(yukleyici.load(`model/doku/${ad}_normal.jpg`), false),
  };
}

function pisirilmis(m, urun = null) {
  m.onBeforeCompile = sh => {
    sh.uniforms.uIc = ORTAK.uIc; sh.uniforms.uIcK = ORTAK.uIcK; sh.uniforms.uDisK = ORTAK.uDisK;
    if (urun) sh.uniforms.tAtlas = { value: ATLAS };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec2 bLd1; attribute vec2 bLd2; attribute vec2 bLi1; attribute vec2 bLi2;
        uniform float uIc; uniform float uIcK; uniform float uDisK;
        varying vec3 vBake;
        ${urun ? 'attribute vec2 pRG; attribute vec2 pBL; attribute vec2 pUV; attribute vec2 pTile; varying vec2 vRG; varying vec2 vBL; varying vec2 vPUV; varying float vTile;' : ''}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 ld = vec3(bLd1.x, 1.0 - bLd1.y, bLd2.x);
        vec3 li = vec3(bLi1.x, 1.0 - bLi1.y, bLi2.x);
        vBake = mix(ld * uDisK, li * uIcK, uIc) * 4.0;
        ${urun ? 'vRG = pRG; vBL = pBL; vPUV = pUV; vTile = pTile.x;' : ''}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vBake;
        ${urun ? 'varying vec2 vRG; varying vec2 vBL; varying vec2 vPUV; varying float vTile; uniform sampler2D tAtlas;' : ''}`)
      .replace('#include <lights_fragment_maps>', ISIK_PARCA);
    if (urun) sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 c1 = diffuseColor.rgb;
          vec3 c2 = vec3(vRG.x, 1.0 - vRG.y, vBL.x);
          float lz = 1.0 - vBL.y;
          float band = step(0.30, lz) * step(lz, 0.72);
          float cap = step(1.0, lz);
          vec3 col = mix(c1, c2, max(band, cap));
          ${urun === 'etiket' ? `
          // 8x8 etiket atlasi (Blender'daki atlas_rengi ile ayni kural); tile >= 64: yalniz sise govde bandi
          if (vTile > -0.5) {
            float bandli = step(63.5, vTile);
            float t = vTile - bandli * 64.0;
            float sut = floor(mod(t + 0.5, 8.0)); float sat = floor((t + 0.5) / 8.0);
            float vb = (lz - 0.30) / 0.33;
            float v = clamp(mix(lz, vb, bandli), 0.006, 0.994);
            float u = clamp(vPUV.x, 0.004, 0.996);
            vec3 ac = texture2D(tAtlas, vec2((sut + u) / 8.0, 1.0 - (sat + 1.0) / 8.0 + v / 8.0)).rgb;
            float ic = step(0.30, lz) * step(lz, 0.63);
            float goster = (1.0 - step(1.0, lz)) * ((1.0 - bandli) + bandli * ic);
            col = mix(col, ac, goster);
          }` : ''}
          diffuseColor.rgb = col;
        }`);
  };
  m.customProgramCacheKey = () => 'pisir-' + (urun || 'duz');
  return m;
}

// ------------------------------------------------------------ dokular (kod ile uretilir)
function tuvalDoku(boyut, ciz, srgb = true) {
  const c = document.createElement('canvas'); c.width = c.height = boyut;
  ciz(c.getContext('2d'), boyut);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const rnd = (a => () => (a = (a * 16807) % 2147483647) / 2147483647)(7);

function karoDoku(n, renk, derz, cesit, derzPx) {
  return tuvalDoku(1024, (g, s) => {
    const k = s / n;
    g.fillStyle = derz; g.fillRect(0, 0, s, s);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = 1 + (rnd() - 0.5) * cesit;
      g.fillStyle = `rgb(${renk.map(c => Math.min(255, c * v) | 0).join(',')})`;
      g.fillRect(i * k + derzPx, j * k + derzPx, k - 2 * derzPx, k - 2 * derzPx);
    }
    const im = g.getImageData(0, 0, s, s), d = im.data;
    for (let q = 0; q < d.length; q += 4) { const e = (rnd() - 0.5) * 6; d[q] += e; d[q + 1] += e; d[q + 2] += e; }
    g.putImageData(im, 0, 0);
  });
}
function karoPuruz(n, derzPx, deger, derzDeger) {
  return tuvalDoku(512, (g, s) => {
    const k = s / n;
    g.fillStyle = `rgb(${derzDeger},${derzDeger},${derzDeger})`; g.fillRect(0, 0, s, s);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = deger + (rnd() - 0.5) * 18;
      g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(i * k + derzPx / 2, j * k + derzPx / 2, k - derzPx, k - derzPx);
    }
  }, false);
}
const zeminDoku = karoDoku(4, [204, 201, 194], '#8f8c86', 0.035, 1.5);      // 4x4 karo = 2.4 m
const zeminPuruz = karoPuruz(4, 2, 30, 170);
const depoDoku = karoDoku(1, [143, 145, 148], '#7d7e80', 0.0, 1);
const kaldirimDoku = karoDoku(8, [168, 166, 158], '#6e6d68', 0.07, 2.5);
const asfaltDoku = tuvalDoku(512, (g, s) => {
  g.fillStyle = '#2c2c2e'; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 26000; i++) { const v = 30 + rnd() * 40; g.fillStyle = `rgb(${v},${v},${v + 2})`; g.fillRect(rnd() * s, rnd() * s, 1.6, 1.6); }
});
function ahsapDoku(r, gg, b) {
  return tuvalDoku(512, (g, s) => {
    g.fillStyle = `rgb(${r},${gg},${b})`; g.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y++) {
      const v = Math.sin(y * 0.09 + Math.sin(y * 0.013) * 4) * 0.5 + 0.5;
      const k = 0.82 + v * 0.18 + (rnd() - 0.5) * 0.05;
      g.fillStyle = `rgba(${r * k | 0},${gg * k | 0},${b * k | 0},0.9)`; g.fillRect(0, y, s, 1);
    }
    for (let i = 0; i < 70; i++) { g.fillStyle = 'rgba(60,35,15,0.10)'; g.fillRect(0, rnd() * s, s, 1 + rnd() * 2); }
  });
}

// ------------------------------------------------------------ malzemeler
const sr = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
const std = (renk, roughness, metalness = 0, ek = {}) => pisirilmis(new THREE.MeshStandardMaterial({ color: sr(...renk), roughness, metalness, ...ek }));
const tex = (ek) => pisirilmis(new THREE.MeshStandardMaterial(ek));
const MAT = {
  raf: std([0.92, 0.92, 0.90], 0.32), arka: std([0.80, 0.80, 0.79], 0.45), koyu: std([0.22, 0.23, 0.25], 0.45),
  antrasit: std([0.12, 0.125, 0.13], 0.35, 0.35), krom: std([0.92, 0.92, 0.93], 0.12, 0.85), celik: std([0.78, 0.78, 0.78], 0.28, 0.75),
  beyaz: std([0.94, 0.94, 0.93], 0.22), ic: std([0.86, 0.88, 0.90], 0.35), lastik: std([0.03, 0.03, 0.03], 0.65),
  siyah: std([0.03, 0.03, 0.035], 0.35), kirmizi: std([0.72, 0.08, 0.07], 0.35), beton: std([0.62, 0.61, 0.58], 0.8),
  paspas: std([0.20, 0.20, 0.21], 1), karton: std([0.62, 0.46, 0.30], 0.85), turuncu: std([0.95, 0.42, 0.06], 0.4),
  kasa_govde: std([0.20, 0.21, 0.23], 0.4), tabela: std([0.10, 0.36, 0.30], 0.4), yazi: std([0.97, 0.97, 0.95], 0.4),
  taban: std([0.92, 0.91, 0.88], 0.7), cizgi: std([0.95, 0.95, 0.93], 0.6), tavan: std([0.14, 0.14, 0.15], 0.85),
  asfalt: tex({ ...foto('asfalt'), roughness: 1.0, normalScale: new THREE.Vector2(0.8, 0.8) }),
  zemin: tex({ map: zeminDoku, roughnessMap: zeminPuruz, roughness: 1, envMapIntensity: 1.2 }),
  depo_zemin: tex({ ...foto('depo'), color: sr(0.62, 0.63, 0.64).multiplyScalar(1.4), roughness: 0.55, normalScale: new THREE.Vector2(0.3, 0.3) }),
  kaldirim: tex({ ...foto('kaldirim'), color: new THREE.Color(1.3, 1.3, 1.3), roughness: 1.0 }),
  ahsap: tex({ ...foto('ahsap'), color: new THREE.Color(3.0, 2.6, 2.05), roughness: 1.0, normalScale: new THREE.Vector2(0.25, 0.25) }),
  ahsap_acik: tex({ ...foto('ahsap'), color: new THREE.Color(3.9, 3.5, 2.9), roughness: 1.0, normalScale: new THREE.Vector2(0.25, 0.25) }),
  kasa_ahsap: tex({ ...foto('ahsap'), color: new THREE.Color(3.3, 2.9, 2.3), roughness: 0.8, normalScale: new THREE.Vector2(0.2, 0.2) }),
  pet: new THREE.MeshPhysicalMaterial({ color: 0xe6f4ff, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.35, envMapIntensity: 1.5, depthWrite: false }),
  duvar: tex({ vertexColors: true, roughness: 0.85 }),
  panel: tex({ vertexColors: true, roughness: 0.45 }),
  urun: pisirilmis(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38 }), 'etiket'),
  meyve: pisirilmis(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42 }), 'meyve'),
  cam: new THREE.MeshPhysicalMaterial({ color: 0xf2fbf8, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.12, envMapIntensity: 1.4, depthWrite: false, side: THREE.DoubleSide }),
  cam_dolap: new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.02, metalness: 0, transparent: true, opacity: 0.08, envMapIntensity: 1.2, depthWrite: false, side: THREE.DoubleSide }),
  led: new THREE.MeshBasicMaterial({ color: sr(1.0, 0.97, 0.92).multiplyScalar(2.5) }),
  led_soguk: new THREE.MeshBasicMaterial({ color: sr(0.92, 0.96, 1.0).multiplyScalar(2.2) }),
  tavan_led: new THREE.MeshBasicMaterial({ color: sr(1.0, 0.96, 0.90).multiplyScalar(4) }),
  ekran: new THREE.MeshBasicMaterial({ color: sr(0.20, 0.42, 0.85).multiplyScalar(1.4) }),
};

const TAVAN_MAT = {
  tavan: new THREE.MeshBasicMaterial({ color: sr(0.22, 0.22, 0.23) }),
  antrasit: new THREE.MeshBasicMaterial({ color: sr(0.07, 0.07, 0.08) }),
  beyaz: new THREE.MeshBasicMaterial({ color: sr(0.80, 0.80, 0.79) }),
  koyu: new THREE.MeshBasicMaterial({ color: sr(0.18, 0.18, 0.19) }),
};

// kutu izdusumu UV (ahsap ve karo dokulari icin)
function kutuUV(geo, olcek, dunya) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  const v = new THREE.Vector3(), n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(dunya);
    n.fromBufferAttribute(nor, i);
    const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z);
    let a, b;
    if (ay >= ax && ay >= az) { a = v.x; b = v.z; } else if (ax >= az) { a = v.z; b = v.y; } else { a = v.x; b = v.y; }
    uv[i * 2] = a / olcek; uv[i * 2 + 1] = b / olcek;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
}
const UV_OLCEK = { zemin: 2.4, depo_zemin: 2.0, kaldirim: 1.6, asfalt: 3.0, ahsap: 0.9, ahsap_acik: 0.9, kasa_ahsap: 0.7 };

// ------------------------------------------------------------ yukleme
const duvarlar = [];
const tavanlar = [];
const draco = new DRACOLoader().setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/libs/draco/gltf/');
const loader = new GLTFLoader().setDRACOLoader(draco);
let model = null;
const ad_ = (g, n) => g.attributes[n];

// Model (~39 MB) sayfa acilinca degil, ziyaretci isteyince yuklenir.
let basladi = false, bekleyenBakis = 'maket_gb';
const MODEL_MB = 39.9;
function baslat(bakis) {
  if (bakis) bekleyenBakis = bakis;
  if (basladi) return;
  basladi = true;
  sahneEl.classList.add('yukleniyor');
loader.load('model/market.glb', gltf => {
  model = gltf.scene;
  model.updateMatrixWorld(true);
  model.traverse(o => {
    if (o.userData && o.userData.duvar && (o.userData.nx || o.userData.ny)) duvarlar.push(o);
    if (/^Tavan/.test(o.name) || /^Tavan/.test(o.parent?.name || '')) tavanlar.push(o);
    if (!o.isMesh) return;
    const ad = ((o.material && o.material.name) || '').replace(/\.\d+$/, '');   // Blender 'asfalt.001' gibi ekler koyabiliyor
    const g = o.geometry;
    if (ad_(g, 'uv1')) {
      g.setAttribute('bLd1', g.attributes.uv1); g.setAttribute('bLd2', g.attributes.uv2);
      g.setAttribute('bLi1', g.attributes.uv1); g.setAttribute('bLi2', g.attributes.uv2);   // ic isik = dis isik kopyasi
    }
    if (ad === 'urun' || ad === 'meyve') {
      g.setAttribute('pRG', g.attributes.uv3);
      g.setAttribute('pBL', g.attributes.texcoord_4);
      g.setAttribute('pUV', g.attributes.uv);
      g.setAttribute('pTile', g.attributes.texcoord_5 || new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2).fill(-1), 2));
    }
    if (UV_OLCEK[ad]) kutuUV(g, UV_OLCEK[ad], o.matrixWorld);
    // tavan dis isikta pisirilmedi (gizliydi): sabit tonla cizilir
    o.material = (tavanlar.includes(o) && TAVAN_MAT[ad]) || MAT[ad] || o.material;
  });
  for (const k of ['cizgi', 'paspas']) { MAT[k].polygonOffset = true; MAT[k].polygonOffsetFactor = -2; MAT[k].polygonOffsetUnits = -2; }
  scene.add(model);
  scene.add(ayna);
  sahneEl.classList.add('hazir');
  bak(bekleyenBakis, 0);
  gerekli = 90;
}, e => {
  const mb = e.loaded / 1e6;
  const y = Math.min(100, Math.round(mb / MODEL_MB * 100));
  yuzdeEl.textContent = y + '%'; cubukEl.style.width = y + '%';
}, err => {
  console.error(err);
  sahneEl.querySelector('.ub-yukleniyor span').textContent = 'Model yüklenemedi, sayfayı yenileyip tekrar deneyin';
});
}
document.getElementById('ub-baslat')?.addEventListener('click', () => baslat());

// ------------------------------------------------------------ cilali zemin yansimasi (yalniz iceride)
const ZEMIN_PX = [[78, 17], [1030, 17], [1030, 756], [500, 657], [300, 563], [78, 397]];
const ayna = (() => {
  const sekil = new THREE.Shape(ZEMIN_PX.map(([x, y]) => new THREE.Vector2((x - 78) * S, -(y - 17) * S)));
  const r = new Reflector(new THREE.ShapeGeometry(sekil), {
    textureWidth: 1024, textureHeight: 1024, clipBias: 0.003,
    shader: {
      name: 'ZeminYansima',
      uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, opak: { value: 0.16 } },
      vertexShader: `uniform mat4 textureMatrix; varying vec4 vUv;
        void main() { vUv = textureMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D tDiffuse; uniform float opak; varying vec4 vUv;
        void main() { vec4 c = texture2DProj(tDiffuse, vUv); gl_FragColor = vec4(c.rgb, opak);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    },
  });
  r.material.transparent = true;
  r.material.depthWrite = false;
  r.rotation.x = -Math.PI / 2;
  r.position.y = 0.004;
  r.visible = false;
  r.renderOrder = 1;
  return r;
})();

// ------------------------------------------------------------ bakislar
const BAKIS = {
  maket_gb: { yon: [-135, 33], uzak: 58 },
  maket_gd: { yon: [-45, 33], uzak: 58 },
  tepeden: { yon: [-90, 89.5], uzak: 62 },
  giris: { kam: p(230, 470, 1.65), hedef: p(600, 230, 1.0) },
  reyon: { kam: p(567, 470, 1.62), hedef: p(567, 140, 1.25) },
  manav: { kam: p(275, 330, 1.6), hedef: p(110, 150, 0.95) },
  firin: { kam: p(790, 128, 1.6), hedef: p(690, 66, 1.0) },
  sogutucu: { kam: p(905, 440, 1.6), hedef: p(950, 200, 1.1) },
  kasa: { kam: p(445, 415, 1.65), hedef: p(470, 545, 0.85) },
  depo: { kam: p(1100, 540, 1.7), hedef: p(1090, 330, 1.0) },
};
function bakisKonum(ad) {
  const b = BAKIS[ad];
  if (b.kam) return { kam: b.kam.clone(), hedef: b.hedef.clone() };
  const az = THREE.MathUtils.degToRad(b.yon[0]), el = THREE.MathUtils.degToRad(b.yon[1]);
  const d = new THREE.Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), -Math.sin(az) * Math.cos(el));
  const hedef = MERKEZ.clone();
  const oran = Math.max(1, 1.55 / Math.max(0.3, camera.aspect));
  return { kam: hedef.clone().addScaledVector(d, b.uzak * oran), hedef };
}
let anim = null;
function git(kam, hedef, sure = 1300) {
  anim = { t0: performance.now(), sure, k0: camera.position.clone(), h0: controls.target.clone(), k1: kam, h1: hedef };
  gerekli = 120;
}
function bak(ad, sure = 1300) {
  const { kam, hedef } = bakisKonum(ad);
  document.querySelectorAll('[data-bakis]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.bakis === ad)));
  if (sure === 0) { camera.position.copy(kam); controls.target.copy(hedef); controls.update(); gerekli = Math.max(gerekli, 3); return; }
  git(kam, hedef, sure);
}
document.querySelectorAll('[data-bakis]').forEach(b => b.addEventListener('click', () => {
  if (!model) { baslat(b.dataset.bakis); return; }
  bak(b.dataset.bakis);
}));

// cift tik: tiklanan noktaya odaklan
const ray = new THREE.Raycaster();
tuval.addEventListener('dblclick', e => {
  if (!model) return;
  const r = tuval.getBoundingClientRect();
  const m = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(m, camera);
  const vurus = ray.intersectObject(model, true).find(h => h.object.visible && !h.object.material.transparent);
  if (!vurus) return;
  const hedef = vurus.point;
  const yon = camera.position.clone().sub(controls.target);
  const uz = Math.max(2.5, Math.min(yon.length() * 0.45, 14));
  git(hedef.clone().addScaledVector(yon.normalize(), uz), hedef.clone(), 900);
});

// ------------------------------------------------------------ duvar kesiti + tavan + ic/dis isik
let icerde = null, icHedef = 0, fovHedef = 32;
function guncelleKesit() {
  const c = camera.position;
  const ic = c.y < 3.7 && c.x > BINA.x0 && c.x < BINA.x1 && c.z > BINA.z0 && c.z < BINA.z1;
  const dx = c.x - controls.target.x, dz = c.z - controls.target.z;
  const L = Math.hypot(dx, dz) || 1;
  const bx = dx / L, by = -dz / L;                        // Blender duzlemine cevir
  for (const w of duvarlar) {
    const n = Math.hypot(w.userData.nx, w.userData.ny);
    const kes = !ic && (w.userData.nx * bx + w.userData.ny * by) / n > 0.25;
    w.scale.y = kes ? 1.15 / w.userData.h : 1;
  }
  if (ic !== icerde) {
    icerde = ic;
    for (const t of tavanlar) t.visible = ic;
    ayna.visible = ic;
    icHedef = ic ? 1 : 0;
    fovHedef = ic ? 58 : 32;           // iceride renderlardaki genis aci (18-20 mm)
    sahneEl.classList.toggle('icerde', ic);
  }
}

function boyutla() {
  const w = sahneEl.clientWidth, h = sahneEl.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  gerekli = Math.max(gerekli, 2);
}
new ResizeObserver(boyutla).observe(sahneEl);

// ------------------------------------------------------------ dongu (yalniz gerektiginde cizer)
let gerekli = 2;
controls.addEventListener('change', () => { gerekli = Math.max(gerekli, 2); });
controls.addEventListener('start', () => { anim = null; sahneEl.classList.add('dokundu'); });
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function dongu(now) {
  requestAnimationFrame(dongu);
  if (anim) {
    const t = Math.min(1, (now - anim.t0) / anim.sure), e = ease(t);
    camera.position.lerpVectors(anim.k0, anim.k1, e);
    controls.target.lerpVectors(anim.h0, anim.h1, e);
    if (t >= 1) anim = null;
    gerekli = Math.max(gerekli, 2);
  }
  const u = ORTAK.uIc;
  if (Math.abs(u.value - icHedef) > 0.001) { u.value += (icHedef - u.value) * 0.12; gerekli = Math.max(gerekli, 2); }
  if (Math.abs(camera.fov - fovHedef) > 0.05) { camera.fov += (fovHedef - camera.fov) * 0.12; camera.updateProjectionMatrix(); gerekli = Math.max(gerekli, 2); }
  controls.update();
  if (camera.position.y < 0.25) camera.position.y = 0.25;
  if (!model) return;
  if (gerekli <= 0) return;
  gerekli--;
  guncelleKesit();
  renderer.render(scene, camera);
}
requestAnimationFrame(dongu);

// gelistirme yardimcilari (yerel test)
window.perartBak = bak;
window.perartBaslat = baslat;

window.perartAyar = ORTAK;
window.perartRenderer = renderer;
window.perartKare = (w = 1600, h = 1000) => new Promise(res => {
  const pr = renderer.getPixelRatio();
  renderer.setPixelRatio(1); renderer.setSize(w, h, false);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  if (Math.abs(ORTAK.uIc.value - icHedef) > 0) ORTAK.uIc.value = icHedef;
  guncelleKesit(); ORTAK.uIc.value = icHedef; camera.fov = fovHedef; camera.updateProjectionMatrix(); renderer.render(scene, camera);
  tuval.toBlob(b => { renderer.setPixelRatio(pr); boyutla(); gerekli = 3; res(b); }, 'image/jpeg', 0.9);
});

// tam ekran
document.getElementById('ub-tam').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else sahneEl.requestFullscreen?.();
});
