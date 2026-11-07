// Studio photo : la caméra du téléphone avec un cadre de visée, pour des photos homogènes.
import { h, modal, toast } from './ui.js';

export async function studio(onShot) {
  let stream = null, facing = 'environment';
  const video = h('video', { autoplay: true, playsinline: true, muted: true });
  const guide = h('div', { class: 'studio-guide', html: `
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      <rect x="12" y="8" width="76" height="76" rx="4" fill="none" stroke="#fff" stroke-width=".6" stroke-dasharray="3 2"/>
      <ellipse cx="50" cy="80" rx="24" ry="4" fill="none" stroke="#FFD100" stroke-width=".7"/>
      <path d="M50 40v8M46 44h8" stroke="#fff" stroke-width=".6"/>
      <path d="M50 18 L72 30 L72 56 L50 68 L28 56 L28 30 Z M50 18 L50 44 M28 30 L50 44 L72 30" fill="none" stroke="#fff" stroke-width=".35" opacity=".55"/>
    </svg>` });
  const tip = h('p', { class: 'studio-tip' }, 'Posez le casse-tête sur un fond uni et clair, vu de trois quarts (trois faces visibles), calé sur l\'ellipse jaune. Même cadrage pour tous : la collection sera homogène.');
  const stage = h('div', { class: 'studio' }, video, guide);
  const shoot = h('button', { class: 'btn accent', type: 'button' }, 'Déclencher');
  const flip = h('button', { class: 'btn', type: 'button' }, 'Changer de caméra');
  const m = modal(h('div', { class: 'studio-box' }, h('h2', {}, 'Studio photo'), stage, tip, h('div', { class: 'row' }, shoot, flip)), {
    wide: true, label: 'Studio photo', onClose: () => stream?.getTracks().forEach((t) => t.stop()),
  });

  async function start() {
    stream?.getTracks().forEach((t) => t.stop());
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1920 } }, audio: false });
      video.srcObject = stream;
    } catch (e) {
      m.close();
      toast(location.protocol !== 'https:' && location.hostname !== 'localhost' ? 'La caméra exige une adresse https.' : 'Caméra inaccessible : autorisez-la dans le navigateur. Le bouton « Prendre une photo » reste disponible.', 'err');
    }
  }
  flip.onclick = () => { facing = facing === 'environment' ? 'user' : 'environment'; start(); };
  shoot.onclick = async () => {
    const vw = video.videoWidth, vh = video.videoHeight;
    if (!vw) return;
    // même recadrage que le cadre de visée : carré central de 76 %
    const side = Math.min(vw, vh), crop = side * 0.84;
    const c = new OffscreenCanvas(Math.round(crop), Math.round(crop));
    c.getContext('2d').drawImage(video, (vw - crop) / 2, Math.max(0, (vh - crop) / 2 - side * 0.04), crop, crop, 0, 0, c.width, c.height);
    const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.92 });
    m.close();
    onShot(blob);
  };
  start();
}
