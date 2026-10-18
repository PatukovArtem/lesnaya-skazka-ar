import './styles.css';

const markerUrl = '/markers/forest-guardian.svg';
let THREE = null;

const state = {
  ar: null,
  animationFrame: null,
  targetUrl: null,
  compiling: false,
  activeScreen: 'home',
  arRuntime: null,
};

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="app-shell">
    <section class="screen screen--home" data-screen="home">
      <header class="topbar">
        <div class="brand"><span class="brand__mark">✦</span><span>Живая карта</span></div>
        <span class="beta">AR · прототип</span>
      </header>

      <div class="hero">
        <p class="eyebrow">Карта, которая отвечает</p>
        <h1>Оживите<br /><em>историю</em></h1>
        <p class="hero__lead">Наведите камеру на иллюстрацию — и Лесной хранитель появится прямо на карте.</p>
        <button class="button button--primary" id="start-ar">Открыть камеру <span>↗</span></button>
      </div>

      <div class="orbit orbit--one"></div><div class="orbit orbit--two"></div>

      <section class="marker-card" aria-labelledby="marker-title">
        <div class="marker-card__image"><img src="${markerUrl}" alt="Иллюстрация Лесной хранитель для теста AR" /></div>
        <div class="marker-card__body">
          <div><p class="marker-card__kicker">Тестовый маркер · 01</p><h2 id="marker-title">Лесной хранитель</h2></div>
          <p>Откройте иллюстрацию на втором экране или распечатайте её, затем наведите камеру.</p>
          <div class="marker-card__actions">
            <a class="text-action" href="${markerUrl}" download="lesnoy-hranitel.svg">Скачать маркер ↓</a>
            <button class="text-action" id="open-guide">Как это работает</button>
          </div>
        </div>
      </section>

      <nav class="bottom-nav" aria-label="Навигация">
        <button class="bottom-nav__item is-active" data-route="home"><span>◈</span>Карта</button>
        <button class="bottom-nav__item" data-route="guide"><span>◌</span>Как играть</button>
        <button class="bottom-nav__item" data-route="admin"><span>⌘</span>Админ</button>
      </nav>
    </section>

    <section class="screen screen--guide" data-screen="guide" hidden>
      <header class="topbar"><button class="back" data-route="home">←</button><div class="brand">Как оживает карта</div></header>
      <div class="content-page">
        <p class="eyebrow">Инструкция</p><h2>Никаких QR‑кодов</h2>
        <ol class="steps">
          <li><span>1</span><div><strong>Откройте маркер</strong><p>Покажите «Лесного хранителя» на другом устройстве или распечатайте.</p></div></li>
          <li><span>2</span><div><strong>Разрешите камеру</strong><p>Доступ нужен только во время AR-сеанса. Видеопоток никуда не отправляется.</p></div></li>
          <li><span>3</span><div><strong>Держите картинку в рамке</strong><p>Когда приложение узнает иллюстрацию, над ней появятся световые руны.</p></div></li>
        </ol>
        <button class="button button--primary" id="guide-start-ar">Начать AR-сеанс <span>↗</span></button>
      </div>
    </section>

    <section class="screen screen--admin" data-screen="admin" hidden>
      <header class="topbar"><button class="back" data-route="home">←</button><div class="brand">Панель администратора</div></header>
      <div class="content-page">
        <p class="eyebrow">Макет следующей итерации</p><h2>Добавление живой точки</h2>
        <div class="admin-note"><span>⌘</span><p>В MAX эта панель будет открываться по команде <code>/admin</code> только для разрешённых администраторов.</p></div>
        <label class="upload-tile" for="marker-upload"><input id="marker-upload" type="file" accept="image/*" /><span>＋</span><strong>Загрузить иллюстрацию‑маркер</strong><small>PNG, JPG или SVG</small></label>
        <div class="form-preview" id="upload-preview" hidden></div>
        <button class="button button--secondary" id="compile-upload" disabled>Подготовить распознавание</button>
        <p class="fineprint" id="admin-status">Демо хранит данные только в браузере. Серверное сохранение и загрузка через бота — следующий этап.</p>
      </div>
    </section>

    <section class="ar-view" id="ar-view" aria-live="polite" hidden>
      <div class="ar-stage" id="ar-stage"></div>
      <div class="ar-ui">
        <header class="ar-ui__header"><button class="round-button" id="close-ar" aria-label="Закрыть камеру">×</button><span class="ar-ui__title">Лесной хранитель</span><span class="camera-dot">●</span></header>
        <div class="scan-frame"><i></i><i></i><i></i><i></i><b></b></div>
        <p class="scan-prompt" id="scan-prompt">Ищу иллюстрацию…</p>
        <button class="found-card" id="found-card" hidden><span class="found-card__icon">✦</span><span><small>Найдено</small><strong>Лесной хранитель</strong></span><span>→</span></button>
        <div class="ar-disclaimer" id="ar-disclaimer">Камера используется только для распознавания иллюстрации</div>
      </div>
    </section>

    <dialog class="info-dialog" id="info-dialog">
      <button class="dialog-close" id="close-info" aria-label="Закрыть">×</button>
      <div class="dialog-icon">✦</div><p class="eyebrow">Найдена точка · 01</p><h2>Лесной хранитель</h2>
      <p>Древо просыпается, когда путешественник находит путь через туманный перевал. Его свет указывает дорогу к следующей главе карты.</p>
      <div class="dialog-fact"><span>В награду</span><strong>Открыта история «Северная тропа»</strong></div>
      <button class="button button--primary" id="close-info-button">Продолжить путь</button>
    </dialog>
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

function setScreen(name) {
  state.activeScreen = name;
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.hidden = screen.dataset.screen !== name;
  });
  document.querySelectorAll('[data-route]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.route === name);
  });
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
  state.compiling = true;
  statusElement.textContent = 'Готовлю изображение для распознавания… 0%';
  const image = await loadImage(source);
  const compiler = new window.MINDAR.IMAGE.Compiler();
  await compiler.compileImageTargets([image], (progress) => {
    statusElement.textContent = `Готовлю изображение для распознавания… ${Math.round(progress)}%`;
  });
  const data = compiler.exportData();
  if (state.targetUrl) URL.revokeObjectURL(state.targetUrl);
  state.targetUrl = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
  state.compiling = false;
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
    new THREE.MeshBasicMaterial({ color: 0xffd88b, transparent: true, opacity: 0.87, side: THREE.DoubleSide }),
  );
  ring.position.set(0.02, 0.08, 0.035);
  magic.add(ring);

  const runes = [];
  for (let index = 0; index < 12; index += 1) {
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.024 + (index % 3) * 0.007, 14),
      new THREE.MeshBasicMaterial({ color: index % 2 ? 0xd5ffb1 : 0xffe1a7, transparent: true, opacity: 0.95, side: THREE.DoubleSide }),
    );
    const angle = (Math.PI * 2 * index) / 12;
    dot.position.set(Math.cos(angle) * 0.25, Math.sin(angle) * 0.16 + 0.03, 0.05);
    magic.add(dot);
    runes.push({ dot, angle, offset: index * 0.58 });
  }

  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(0.31, 48),
    new THREE.MeshBasicMaterial({ color: 0x8affbe, transparent: true, opacity: 0.1, side: THREE.DoubleSide }),
  );
  halo.position.z = 0.012;
  magic.add(halo);
  anchorGroup.add(magic);

  return (time) => {
    const t = time * 0.001;
    ring.rotation.z = t * 0.85;
    halo.scale.setScalar(0.95 + Math.sin(t * 3) * 0.11);
    runes.forEach(({ dot, angle, offset }) => {
      const radius = 0.23 + Math.sin(t * 2.1 + offset) * 0.035;
      dot.position.x = Math.cos(angle + t * 0.45) * radius;
      dot.position.y = Math.sin(angle + t * 0.45) * (0.16 + Math.cos(t + offset) * 0.025) + 0.03;
      dot.rotation.z = -t;
    });
  };
}

function showRecognition(isFound) {
  $('#scan-prompt').textContent = isFound ? 'Лесной хранитель проснулся' : 'Ищу иллюстрацию…';
  $('#found-card').hidden = !isFound;
  $('.scan-frame').classList.toggle('is-found', isFound);
}

async function startAr() {
  const arView = $('#ar-view');
  const prompt = $('#scan-prompt');
  if (state.ar) return;

  arView.hidden = false;
  showRecognition(false);
  prompt.textContent = 'Готовлю камеру…';

  try {
    await ensureArRuntime();
    await requestMaxCameraPermission();
    const targetUrl = state.targetUrl || await compileTarget(markerUrl, prompt);
    prompt.textContent = 'Запускаю распознавание…';

    const MindARThree = window.MINDAR.IMAGE.MindARThree;
    const mindarThree = new MindARThree({
      container: $('#ar-stage'),
      imageTargetSrc: targetUrl,
      uiLoading: 'no',
      uiScanning: 'no',
      uiError: 'no',
      filterMinCF: 0.001,
      filterBeta: 1000,
      warmupTolerance: 3,
      missTolerance: 6,
    });
    const { renderer, scene, camera } = mindarThree;
    const anchor = mindarThree.addAnchor(0);
    const updateMagic = createMagic(anchor.group);
    anchor.onTargetFound = () => showRecognition(true);
    anchor.onTargetLost = () => showRecognition(false);
    await mindarThree.start();

    state.ar = { mindarThree, renderer };
    renderer.setAnimationLoop((time) => {
      updateMagic(time);
      renderer.render(scene, camera);
    });
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

function openInfo() {
  const dialog = $('#info-dialog');
  if (typeof dialog.showModal === 'function') dialog.showModal();
}

function closeInfo() {
  $('#info-dialog').close();
}

let uploadedMarker = null;

function configureAdminUpload() {
  const input = $('#marker-upload');
  const preview = $('#upload-preview');
  const compileButton = $('#compile-upload');
  const adminStatus = $('#admin-status');

  input.addEventListener('change', () => {
    const file = input.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      adminStatus.textContent = 'Выберите изображение в формате PNG, JPG или SVG.';
      return;
    }
    if (uploadedMarker) URL.revokeObjectURL(uploadedMarker);
    uploadedMarker = URL.createObjectURL(file);
    preview.hidden = false;
    preview.innerHTML = `<img src="${uploadedMarker}" alt="Предпросмотр загруженного маркера" /><span>${file.name}</span>`;
    compileButton.disabled = false;
    adminStatus.textContent = 'Изображение готово. Подготовьте его для распознавания, затем откройте AR-камеру.';
  });

  compileButton.addEventListener('click', async () => {
    if (!uploadedMarker || state.compiling) return;
    try {
      compileButton.disabled = true;
      await compileTarget(uploadedMarker, adminStatus);
      adminStatus.textContent = 'Маркер подготовлен локально. Нажмите «Открыть камеру» на главном экране для проверки.';
      compileButton.textContent = 'Маркер готов ✓';
    } catch (error) {
      adminStatus.textContent = error.message || 'Подготовить маркер не удалось.';
      compileButton.disabled = false;
    }
  });
}

document.querySelectorAll('[data-route]').forEach((button) => {
  button.addEventListener('click', () => setScreen(button.dataset.route));
});
$('#start-ar').addEventListener('click', startAr);
$('#guide-start-ar').addEventListener('click', startAr);
$('#open-guide').addEventListener('click', () => setScreen('guide'));
$('#close-ar').addEventListener('click', stopAr);
$('#found-card').addEventListener('click', openInfo);
$('#close-info').addEventListener('click', closeInfo);
$('#close-info-button').addEventListener('click', closeInfo);
configureAdminUpload();

window.addEventListener('beforeunload', stopAr);
