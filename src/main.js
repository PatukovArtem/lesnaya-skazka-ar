import './styles.css';

const markerUrl = '/markers/forest-guardian.svg';
let THREE = null;

const state = {
  ar: null,
  targetUrl: null,
  arRuntime: null,
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
        <button class="button button--primary" id="start-ar">Открыть камеру <span>↗</span></button>
      </div>

      <section class="how-to" aria-labelledby="how-to-title">
        <div class="how-to__heading">
          <p class="eyebrow">Как играть</p>
          <h2 id="how-to-title">Три простых шага</h2>
        </div>
        <ol class="steps">
          <li>
            <span>01</span>
            <div><strong>Откройте иллюстрацию</strong><p>Для проверки можно <a href="${markerUrl}" target="_blank" rel="noreferrer">показать тестовый маркер</a> на другом экране или распечатать его.</p></div>
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
          <button class="round-button" id="close-ar" aria-label="Закрыть камеру">×</button>
          <span>Лесная сказка</span>
        </header>
        <p class="scan-prompt" id="scan-prompt">Подготовка камеры…</p>
        <div class="scan-frame" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b></div>
        <p class="ar-disclaimer" id="ar-disclaimer">Камера используется только для распознавания иллюстрации</p>
      </div>
    </section>
  </main>
`;

const $ = (selector) => document.querySelector(selector);

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

async function compileTarget(source, statusElement) {
  await ensureArRuntime();
  if (!window.MINDAR?.IMAGE?.Compiler) {
    throw new Error('AR-движок не загрузился. Проверьте подключение к интернету и повторите попытку.');
  }
  statusElement.textContent = 'Готовлю иллюстрацию… 0%';
  const image = await loadImage(source);
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

function createMagic(anchorGroup) {
  const magic = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.14, 0.17, 48),
    new THREE.MeshBasicMaterial({ color: 0xf2ddbd, transparent: true, opacity: 0.86, side: THREE.DoubleSide }),
  );
  ring.position.set(0.02, 0.08, 0.035);
  magic.add(ring);

  const motes = [];
  for (let index = 0; index < 12; index += 1) {
    const mote = new THREE.Mesh(
      new THREE.CircleGeometry(0.024 + (index % 3) * 0.007, 14),
      new THREE.MeshBasicMaterial({ color: index % 2 ? 0xe0f0d7 : 0xf2ddbd, transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
    );
    const angle = (Math.PI * 2 * index) / 12;
    mote.position.set(Math.cos(angle) * 0.25, Math.sin(angle) * 0.16 + 0.03, 0.05);
    magic.add(mote);
    motes.push({ mote, angle, offset: index * 0.58 });
  }

  anchorGroup.add(magic);
  return (time) => {
    const t = time * 0.001;
    ring.rotation.z = t * 0.72;
    motes.forEach(({ mote, angle, offset }) => {
      const radius = 0.23 + Math.sin(t * 2.1 + offset) * 0.03;
      mote.position.x = Math.cos(angle + t * 0.4) * radius;
      mote.position.y = Math.sin(angle + t * 0.4) * (0.16 + Math.cos(t + offset) * 0.02) + 0.03;
      mote.rotation.z = -t;
    });
  };
}

function showRecognition(isFound) {
  $('#scan-prompt').textContent = isFound ? 'Изображение найдено' : 'Наведите камеру на иллюстрацию';
  $('.scan-frame').classList.toggle('is-found', isFound);
}

async function startAr() {
  const arView = $('#ar-view');
  const prompt = $('#scan-prompt');
  if (state.ar) return;

  arView.hidden = false;
  showRecognition(false);
  prompt.textContent = 'Подготовка камеры…';

  try {
    await ensureArRuntime();
    await requestMaxCameraPermission();
    const targetUrl = state.targetUrl || await compileTarget(markerUrl, prompt);
    prompt.textContent = 'Запускаю распознавание…';

    const MindARThree = window.MINDAR.IMAGE.MindARThree;
    const mindarThree = new MindARThree({
      container: $('#ar-stage'), imageTargetSrc: targetUrl, uiLoading: 'no', uiScanning: 'no', uiError: 'no',
      filterMinCF: 0.001, filterBeta: 1000, warmupTolerance: 3, missTolerance: 6,
    });
    const { renderer, scene, camera } = mindarThree;
    const anchor = mindarThree.addAnchor(0);
    const updateMagic = createMagic(anchor.group);
    anchor.onTargetFound = () => showRecognition(true);
    anchor.onTargetLost = () => showRecognition(false);
    await mindarThree.start();
    state.ar = { mindarThree, renderer };
    renderer.setAnimationLoop((time) => { updateMagic(time); renderer.render(scene, camera); });
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
    state.ar = null;
  }
  $('#ar-stage').replaceChildren();
  $('#ar-view').hidden = true;
  $('#ar-disclaimer').textContent = 'Камера используется только для распознавания иллюстрации';
}

$('#start-ar').addEventListener('click', startAr);
$('#close-ar').addEventListener('click', stopAr);
window.addEventListener('beforeunload', stopAr);
