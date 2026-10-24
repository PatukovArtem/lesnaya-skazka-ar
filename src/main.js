import './styles.css';
import { stories, storyById } from './stories.js';

const markerUrl = '/markers/baba-yaga-zimnyaya-izba.png';
const markerStory = storyById['baba-yaga-yaroslavl'];
const markerMaxDimension = 640;
let THREE = null;

const state = {
  ar: null,
  targetUrl: null,
  arRuntime: null,
  activeStory: null,
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
        <button class="library-trigger" id="open-library" type="button"><span>Герои карты</span><small>${stories.length} историй&nbsp; →</small></button>
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
            <div><strong>Включите камеру</strong><p>Нажмите кнопку выше и разрешите доступ только на время AR-сеанса.</p></div>
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

    <section class="overlay-view library-view" id="library-view" aria-labelledby="library-title" hidden>
      <header class="overlay-header">
        <button class="round-button" id="close-library" type="button" aria-label="Закрыть каталог">×</button>
        <span>Лесная сказка</span>
      </header>
      <div class="overlay-content">
        <p class="eyebrow">Герои карты</p>
        <h1 id="library-title">Легенды<br /><em>России</em></h1>
        <p class="overlay-lead">Выберите героя, чтобы посмотреть его историю и анимацию.</p>
        <div class="story-list" id="story-list"></div>
      </div>
    </section>

    <section class="overlay-view story-view" id="story-view" aria-labelledby="story-title" hidden>
      <header class="overlay-header">
        <button class="round-button" id="close-story" type="button" aria-label="Вернуться к каталогу">←</button>
        <span>Герои карты</span>
      </header>
      <div class="overlay-content story-content">
        <video class="story-video" id="story-video" controls playsinline preload="metadata"></video>
        <article class="story-copy">
          <p class="eyebrow" id="story-region"></p>
          <h1 id="story-title"></h1>
          <p id="story-description"></p>
        </article>
      </div>
    </section>
  </main>
`;

const $ = (selector) => document.querySelector(selector);

function setText(selector, value) {
  $(selector).textContent = value;
}

function renderStoryList() {
  $('#story-list').innerHTML = stories.map((story, index) => `
    <button class="story-row" type="button" data-story-id="${story.id}">
      <span>${String(index + 1).padStart(2, '0')}</span>
      <div><strong>${story.title}</strong><small>${story.region}</small></div>
      <i aria-hidden="true">↗</i>
    </button>
  `).join('');
}

function updateCharacterInfo(story) {
  setText('#character-region', story.region);
  setText('#character-title', story.title);
  setText('#character-description', story.description);
}

function openLibrary() {
  $('#library-view').hidden = false;
}

function closeLibrary() {
  closeStory();
  $('#library-view').hidden = true;
}

function openStory(story) {
  state.activeStory = story;
  setText('#story-region', story.region);
  setText('#story-title', story.title);
  setText('#story-description', story.description);
  const video = $('#story-video');
  video.src = story.video;
  video.load();
  $('#story-view').hidden = false;
  video.play().catch(() => {});
}

function closeStory() {
  const video = $('#story-video');
  video.pause();
  video.removeAttribute('src');
  video.load();
  $('#story-view').hidden = true;
  state.activeStory = null;
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

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Не удалось загрузить иллюстрацию-маркер.'));
    image.src = source;
  });
}

async function prepareMarkerImage(source) {
  const image = await loadImage(source);
  const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (largestSide <= markerMaxDimension) return image;

  const scale = markerMaxDimension / largestSide;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

async function compileTarget(source, statusElement) {
  await ensureArRuntime();
  if (!window.MINDAR?.IMAGE?.Compiler) {
    throw new Error('AR-движок не загрузился. Проверьте подключение к интернету и повторите попытку.');
  }
  statusElement.textContent = 'Готовлю иллюстрацию… 0%';
  const image = await prepareMarkerImage(source);
  const compiler = new window.MINDAR.IMAGE.Compiler();
  await compiler.compileImageTargets([image], (progress) => {
    statusElement.textContent = `Готовлю иллюстрацию… ${Math.round(progress)}%`;
  });
  const data = compiler.exportData();
  if (state.targetUrl) URL.revokeObjectURL(state.targetUrl);
  state.targetUrl = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
  return state.targetUrl;
}

async function requestMaxCameraPermission() {
  const manager = window.WebApp?.PermissionsManager;
  if (!manager) return;
  if (!manager.isInited) await manager.init();
  const result = await manager.requestAccess(['camera'], 'Чтобы оживить иллюстрацию на карте');
  if (!result?.camera?.appAccessGranted || !result?.camera?.systemAccessGranted) {
    throw new Error('Доступ к камере не выдан. Включите его в настройках MAX и устройства.');
  }
}

function createStoryVideo(anchorGroup, story) {
  const video = document.createElement('video');
  video.src = story.video;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = 'auto';

  const texture = new THREE.VideoTexture(video);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;

  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 9 / 16),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false }),
  );
  plane.renderOrder = 1;
  anchorGroup.add(plane);

  return {
    play() {
      video.play().catch(() => {});
    },
    pause() {
      video.pause();
    },
    dispose() {
      video.pause();
      video.removeAttribute('src');
      video.load();
      texture.dispose();
      plane.geometry.dispose();
      plane.material.dispose();
    },
  };
}

function showRecognition(isFound, videoOverlay) {
  $('#scan-prompt').textContent = isFound ? 'Изображение найдено' : 'Наведите камеру на иллюстрацию';
  $('.scan-frame').classList.toggle('is-found', isFound);
  $('#character-info').hidden = !isFound;
  if (isFound) videoOverlay?.play();
  else videoOverlay?.pause();
}

async function startAr() {
  const arView = $('#ar-view');
  const prompt = $('#scan-prompt');
  if (state.ar) return;

  arView.hidden = false;
  updateCharacterInfo(markerStory);
  showRecognition(false);
  prompt.textContent = 'Подготовка камеры…';

  try {
    const runtime = ensureArRuntime();
    const permission = requestMaxCameraPermission();
    await runtime;
    const target = state.targetUrl
      ? Promise.resolve(state.targetUrl)
      : compileTarget(markerUrl, prompt);
    const [, targetUrl] = await Promise.all([permission, target]);
    prompt.textContent = 'Запускаю распознавание…';

    const MindARThree = window.MINDAR.IMAGE.MindARThree;
    const mindarThree = new MindARThree({
      container: $('#ar-stage'), imageTargetSrc: targetUrl, uiLoading: 'no', uiScanning: 'no', uiError: 'no',
      filterMinCF: 0.001, filterBeta: 1000, warmupTolerance: 3, missTolerance: 6,
    });
    const { renderer, scene, camera } = mindarThree;
    const anchor = mindarThree.addAnchor(0);
    const videoOverlay = createStoryVideo(anchor.group, markerStory);
    anchor.onTargetFound = () => showRecognition(true, videoOverlay);
    anchor.onTargetLost = () => showRecognition(false, videoOverlay);
    await mindarThree.start();
    state.ar = { mindarThree, renderer, videoOverlay };
    renderer.setAnimationLoop(() => renderer.render(scene, camera));
  } catch (error) {
    console.error(error);
    prompt.textContent = error.message || 'Не удалось запустить AR.';
    $('#ar-disclaimer').textContent = 'Проверьте разрешение камеры и попробуйте ещё раз.';
  }
}

function stopAr() {
  if (state.ar) {
    state.ar.renderer.setAnimationLoop(null);
    state.ar.mindarThree.stop();
    state.ar.videoOverlay.dispose();
    state.ar = null;
  }
  $('#ar-stage').replaceChildren();
  $('#ar-view').hidden = true;
  $('#character-info').hidden = true;
  $('#ar-disclaimer').textContent = 'Камера используется только для распознавания иллюстрации';
}

function warmArRuntime() {
  const warmup = () => {
    ensureArRuntime().catch(() => {});
    loadImage(markerUrl).catch(() => {});
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(warmup, { timeout: 2500 });
  } else {
    window.setTimeout(warmup, 1200);
  }
}

renderStoryList();
updateCharacterInfo(markerStory);
$('#start-ar').addEventListener('click', startAr);
$('#close-ar').addEventListener('click', stopAr);
$('#open-library').addEventListener('click', openLibrary);
$('#close-library').addEventListener('click', closeLibrary);
$('#close-story').addEventListener('click', closeStory);
$('#story-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-story-id]');
  if (button) openStory(storyById[button.dataset.storyId]);
});
window.addEventListener('beforeunload', stopAr);
warmArRuntime();
