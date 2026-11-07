import './styles.css';
import { stories, storyById } from './stories.js';

const assetUrl = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
const targetFileUrl = assetUrl('markers/story-targets.mind');
let THREE = null;

const state = {
  ar: null,
  arRuntime: null,
  arStarting: false,
  arSession: 0,
  detectedStory: null,
  visibleStories: new Set(),
};

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="app-shell">
    <section class="screen screen--home">
      <header class="topbar">
        <p class="site-title">Лесная сказка</p>
      </header>

      <div class="hero">
        <p class="eyebrow">История начинается рядом</p>
        <h1>Оживите<br /><em>историю</em></h1>
        <p class="hero__lead">Наведите камеру на иллюстрацию на карте — и она начнёт двигаться прямо на экране.</p>
        <button class="button button--primary" id="start-ar" type="button">Открыть камеру <span>↗</span></button>
      </div>

      <section class="how-to" aria-labelledby="how-to-title">
        <div class="how-to__heading">
          <p class="eyebrow">Как играть</p>
          <h2 id="how-to-title">Три простых шага</h2>
        </div>
        <ol class="steps">
          <li>
            <span>01</span>
            <div><strong>Найдите иллюстрацию</strong><p>Выберите сказочную картинку на карте, которую хотите оживить.</p></div>
          </li>
          <li>
            <span>02</span>
            <div><strong>Откройте камеру</strong><p>Нажмите кнопку выше, чтобы запустить распознавание в браузере.</p></div>
          </li>
          <li>
            <span>03</span>
            <div><strong>Наведите на картинку</strong><p>Держите изображение внутри рамки — приложение узнает его и запустит анимацию.</p></div>
          </li>
        </ol>
      </section>
      <p class="privacy-note">Видеопоток не сохраняется и используется только для распознавания изображения.</p>
    </section>

    <section class="ar-view" id="ar-view" aria-live="polite" hidden>
      <div class="ar-stage" id="ar-stage"></div>
      <div class="ar-ui">
        <header class="ar-ui__header">
          <button class="round-button" id="close-ar" type="button" aria-label="Закрыть камеру">×</button>
          <span>Лесная сказка</span>
        </header>
        <p class="scan-prompt" id="scan-prompt">Подготовка камеры…</p>
        <div class="scan-frame" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b></div>
        <section class="character-info" id="character-info" aria-live="polite" hidden>
          <p class="character-info__eyebrow" id="character-region"></p>
          <h2 id="character-title"></h2>
          <p id="character-description"></p>
        </section>
        <p class="ar-disclaimer" id="ar-disclaimer">Камера используется только для распознавания иллюстрации</p>
      </div>
    </section>

  </main>
`;

const $ = (selector) => document.querySelector(selector);
let characterInfoHideTimer = null;

function setText(selector, value) {
  $(selector).textContent = value;
}

function updateCharacterInfo(story) {
  setText('#character-region', story.region);
  setText('#character-title', story.title);
  setText('#character-description', story.description);
}

function revealCharacterInfo() {
  const info = $('#character-info');
  window.clearTimeout(characterInfoHideTimer);
  if (!info.hidden) {
    info.classList.add('is-visible');
    return;
  }

  info.hidden = false;
  info.classList.remove('is-visible');
  requestAnimationFrame(() => requestAnimationFrame(() => info.classList.add('is-visible')));
}

function concealCharacterInfo(immediately = false) {
  const info = $('#character-info');
  window.clearTimeout(characterInfoHideTimer);
  info.classList.remove('is-visible');
  if (immediately || info.hidden) {
    info.hidden = true;
    return;
  }

  characterInfoHideTimer = window.setTimeout(() => {
    if (!info.classList.contains('is-visible')) info.hidden = true;
  }, 420);
}

async function ensureArRuntime() {
  if (!state.arRuntime) {
    state.arRuntime = (async () => {
      await import('mind-ar-ts/dist/mindar-image.prod.js');
      await import('mind-ar-ts/dist/mindar-image-three.prod.js');
      THREE = await import('three');
    })();
  }
  await state.arRuntime;
}

function createMagicDustTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  const glow = context.createRadialGradient(48, 48, 0, 48, 48, 48);
  glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
  glow.addColorStop(0.16, 'rgba(255, 246, 191, 1)');
  glow.addColorStop(0.42, 'rgba(244, 197, 88, 0.72)');
  glow.addColorStop(1, 'rgba(244, 197, 88, 0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 96, 96);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function easeOutCubic(value) {
  return 1 - (1 - value) ** 3;
}

function createStoryVideo(anchorGroup, story, dustTexture) {
  const video = document.createElement('video');
  video.src = story.video;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'metadata';

  const texture = new THREE.VideoTexture(video);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;

  const markerWidth = story.markerSize.width;
  const markerHeight = story.markerSize.height;
  const videoMaterial = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.DoubleSide,
    toneMapped: false,
    depthWrite: false,
    transparent: true,
    opacity: 0,
  });
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, markerHeight / markerWidth),
    videoMaterial,
  );
  plane.renderOrder = 1;
  plane.position.z = 0.01;
  plane.visible = false;
  anchorGroup.add(plane);

  const particleCount = 42;
  const particlePositions = new Float32Array(particleCount * 3);
  const particleOrigins = Array.from({ length: particleCount }, (_, index) => {
    const angle = index * 2.399963229728653 + (index % 5) * 0.19;
    const radius = 0.18 + ((index * 37) % 100) / 100 * 0.95;
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius * (markerHeight / markerWidth),
      z: 0.035 + (index % 4) * 0.006,
    };
  });
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
  const dustMaterial = new THREE.PointsMaterial({
    map: dustTexture,
    color: 0xffdf82,
    size: 0.065,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });
  const dust = new THREE.Points(dustGeometry, dustMaterial);
  dust.renderOrder = 2;
  dust.visible = false;
  anchorGroup.add(dust);

  let effectPhase = 'hidden';
  let phaseStartedAt = 0;
  let isVideoFrameReady = false;
  let playbackToken = 0;
  let frameCallbackId = null;

  const setDust = (spread, opacity) => {
    particleOrigins.forEach((origin, index) => {
      const offset = index * 3;
      particlePositions[offset] = origin.x * spread;
      particlePositions[offset + 1] = origin.y * spread;
      particlePositions[offset + 2] = origin.z;
    });
    dustGeometry.attributes.position.needsUpdate = true;
    dustMaterial.opacity = opacity;
  };

  const beginReveal = (now) => {
    effectPhase = 'reveal';
    phaseStartedAt = now;
    plane.visible = true;
  };

  const markVideoFrameReady = (token) => {
    if (token !== playbackToken || effectPhase === 'hidden') return;
    isVideoFrameReady = true;
  };

  const fitVideoToMarker = () => {
    const markerRatio = markerWidth / markerHeight;
    const videoRatio = video.videoWidth / video.videoHeight;
    if (!videoRatio) return;

    texture.repeat.set(1, 1);
    texture.offset.set(0, 0);

    if (videoRatio > markerRatio) {
      const visibleWidth = markerRatio / videoRatio;
      texture.repeat.x = visibleWidth;
      texture.offset.x = (1 - visibleWidth) / 2;
    } else {
      const visibleHeight = videoRatio / markerRatio;
      texture.repeat.y = visibleHeight;
      texture.offset.y = (1 - visibleHeight) / 2;
    }
    texture.needsUpdate = true;
  };

  video.addEventListener('loadedmetadata', fitVideoToMarker, { once: true });

  return {
    play() {
      playbackToken += 1;
      const token = playbackToken;
      effectPhase = 'gather';
      phaseStartedAt = performance.now();
      isVideoFrameReady = false;
      plane.visible = false;
      videoMaterial.opacity = 0;
      dust.visible = true;
      setDust(1.08, 0.88);

      const waitForFirstFrame = () => {
        if (token !== playbackToken) return;
        if (typeof video.requestVideoFrameCallback === 'function') {
          frameCallbackId = video.requestVideoFrameCallback(() => {
            frameCallbackId = null;
            markVideoFrameReady(token);
          });
        } else {
          requestAnimationFrame(() => markVideoFrameReady(token));
        }
      };

      video.addEventListener('playing', waitForFirstFrame, { once: true });
      video.play().then(() => {
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) waitForFirstFrame();
      }).catch(() => {
        if (token === playbackToken) {
          effectPhase = 'hidden';
          dust.visible = false;
        }
      });
    },
    pause() {
      playbackToken += 1;
      if (frameCallbackId !== null && typeof video.cancelVideoFrameCallback === 'function') {
        video.cancelVideoFrameCallback(frameCallbackId);
      }
      frameCallbackId = null;
      video.pause();
      effectPhase = 'hidden';
      plane.visible = false;
      videoMaterial.opacity = 0;
      dust.visible = false;
    },
    update(now) {
      if (effectPhase === 'hidden' || effectPhase === 'shown') return;

      if (effectPhase === 'gather') {
        const progress = Math.min((now - phaseStartedAt) / 420, 1);
        setDust(1.08 - easeOutCubic(progress) * 1.02, 0.88);
        if (progress === 1) {
          if (isVideoFrameReady) beginReveal(now);
          else {
            effectPhase = 'waiting';
            phaseStartedAt = now;
          }
        }
        return;
      }

      if (effectPhase === 'waiting') {
        const shimmer = 0.05 + Math.sin(now / 90) * 0.018;
        setDust(shimmer, 0.94);
        if (isVideoFrameReady) beginReveal(now);
        return;
      }

      const progress = Math.min((now - phaseStartedAt) / 620, 1);
      const eased = easeOutCubic(progress);
      setDust(0.05 + eased * 1.2, 0.94 * (1 - eased));
      videoMaterial.opacity = Math.min(progress / 0.36, 1);
      if (progress === 1) {
        dust.visible = false;
        videoMaterial.opacity = 1;
        effectPhase = 'shown';
      }
    },
    dispose() {
      this.pause();
      video.removeAttribute('src');
      video.load();
      texture.dispose();
      plane.geometry.dispose();
      videoMaterial.dispose();
      dustGeometry.dispose();
      dustMaterial.dispose();
    },
  };
}

function resetRecognition() {
  state.visibleStories = new Set();
  state.detectedStory = null;
  $('#scan-prompt').textContent = 'Наведите камеру на иллюстрацию';
  $('.scan-frame').classList.remove('is-found');
  concealCharacterInfo();
}

function showRecognition(story, videoOverlay) {
  state.visibleStories.add(story.id);
  state.detectedStory = story;
  updateCharacterInfo(story);
  $('#scan-prompt').textContent = 'Изображение найдено';
  $('.scan-frame').classList.add('is-found');
  revealCharacterInfo();
  videoOverlay.play();
}

function hideRecognition(story, videoOverlay) {
  videoOverlay.pause();
  state.visibleStories.delete(story.id);

  if (state.visibleStories.size === 0) {
    resetRecognition();
    return;
  }

  if (state.detectedStory?.id === story.id) {
    const nextStoryId = [...state.visibleStories].pop();
    const nextStory = storyById[nextStoryId];
    state.detectedStory = nextStory;
    updateCharacterInfo(nextStory);
  }
}

async function startAr() {
  const arView = $('#ar-view');
  const prompt = $('#scan-prompt');
  if (state.ar || state.arStarting) return;
  state.arStarting = true;
  const sessionId = state.arSession + 1;
  state.arSession = sessionId;

  arView.hidden = false;
  resetRecognition();
  prompt.textContent = 'Подготовка камеры…';

  try {
    const runtime = ensureArRuntime();
    await runtime;
    if (sessionId !== state.arSession) return;
    prompt.textContent = 'Запускаю распознавание…';

    const MindARThree = window.MINDAR.IMAGE.MindARThree;
    const mindarThree = new MindARThree({
      container: $('#ar-stage'), imageTargetSrc: targetFileUrl, uiLoading: 'no', uiScanning: 'no', uiError: 'no',
      // MindAR uses this value as the number of entries from the target file to inspect,
      // not merely as a simultaneous-tracking limit. It must cover every illustration.
      maxTrack: stories.length, filterMinCF: 0.001, filterBeta: 1000, warmupTolerance: 3, missTolerance: 6,
    });
    const { renderer, scene, camera } = mindarThree;
    const dustTexture = createMagicDustTexture();
    const videoOverlays = stories.map((story, index) => {
      const anchor = mindarThree.addAnchor(index);
      const videoOverlay = createStoryVideo(anchor.group, story, dustTexture);
      anchor.onTargetFound = () => showRecognition(story, videoOverlay);
      anchor.onTargetLost = () => hideRecognition(story, videoOverlay);
      return videoOverlay;
    });
    await mindarThree.start();
    if (sessionId !== state.arSession) {
      mindarThree.stop();
      videoOverlays.forEach((videoOverlay) => videoOverlay.dispose());
      dustTexture.dispose();
      return;
    }
    state.ar = { mindarThree, renderer, videoOverlays, dustTexture };
    renderer.setAnimationLoop((now) => {
      videoOverlays.forEach((videoOverlay) => videoOverlay.update(now));
      renderer.render(scene, camera);
    });
  } catch (error) {
    if (sessionId !== state.arSession) return;
    console.error(error);
    prompt.textContent = error.message || 'Не удалось запустить AR.';
    $('#ar-disclaimer').textContent = 'Проверьте доступность камеры в браузере и попробуйте ещё раз.';
  } finally {
    if (sessionId === state.arSession) state.arStarting = false;
  }
}

function stopAr() {
  state.arSession += 1;
  state.arStarting = false;
  if (state.ar) {
    state.ar.renderer.setAnimationLoop(null);
    state.ar.mindarThree.stop();
    state.ar.videoOverlays.forEach((videoOverlay) => videoOverlay.dispose());
    state.ar.dustTexture.dispose();
    state.ar = null;
  }
  $('#ar-stage').replaceChildren();
  $('#ar-view').hidden = true;
  resetRecognition();
  concealCharacterInfo(true);
  $('#ar-disclaimer').textContent = 'Камера используется только для распознавания иллюстрации';
}

function warmArRuntime() {
  const warmup = () => {
    ensureArRuntime().catch(() => {});
    fetch(targetFileUrl, { cache: 'force-cache' }).catch(() => {});
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warmup, { timeout: 2500 });
  } else {
    window.setTimeout(warmup, 1200);
  }
}

$('#start-ar').addEventListener('click', startAr);
$('#close-ar').addEventListener('click', stopAr);
window.addEventListener('beforeunload', stopAr);
warmArRuntime();
