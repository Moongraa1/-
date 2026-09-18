/* =========================================================
   ШПИОН: ЛОЖНАЯ ЛОКАЦИЯ
   Чистый ES6 JavaScript, без библиотек
   ========================================================= */

"use strict";

/* ===== КОНСТАНТЫ ===== */
const MIN_PLAYERS = 3;
const MAX_PLAYERS = 12;
const STORAGE_KEY = "spy_custom_locations_v1";

/* ===== ПРЕСЕТЫ КАТЕГОРИЙ (минимум 5 пар в каждой) ===== */
const DEFAULT_CATEGORIES = {
  places: {
    name: "Заведения и места",
    pairs: [
      ["Пляж", "Аквапарк"],
      ["Ресторан", "Столовая"],
      ["Больница", "Поликлиника"],
      ["Школа", "Университет"],
      ["Кинотеатр", "Театр"],
      ["Библиотека", "Книжный магазин"],
      ["Бар", "Ночной клуб"]
    ]
  },
  transport: {
    name: "Транспорт",
    pairs: [
      ["Самолёт", "Вертолёт"],
      ["Поезд", "Электричка"],
      ["Автобус", "Троллейбус"],
      ["Метро", "Трамвай"],
      ["Корабль", "Яхта"],
      ["Такси", "Маршрутка"]
    ]
  },
  nature: {
    name: "Природа и отдых",
    pairs: [
      ["Лес", "Парк"],
      ["Горы", "Холмы"],
      ["Река", "Озеро"],
      ["Море", "Океан"],
      ["Пустыня", "Степь"],
      ["Водопад", "Родник"]
    ]
  },
  sport: {
    name: "Спорт",
    pairs: [
      ["Футбольное поле", "Стадион"],
      ["Бассейн", "Аквапарк"],
      ["Спортзал", "Фитнес-клуб"],
      ["Ледовый каток", "Хоккейная площадка"],
      ["Теннисный корт", "Бадминтонный зал"]
    ]
  }
};

/* ===== СОСТОЯНИЕ ПРИЛОЖЕНИЯ ===== */
const state = {
  playerCount: 4,
  players: [],            // [{ name }]
  selectedCategories: [], // ["places", ...]
  customLocations: [],    // [{ main, fake, category }]
  // Игровой раунд
  round: {
    players: [],          // [{ name, isSpy, location }]
    mainLocation: "",
    fakeLocation: "",
    firstPlayer: ""
  },
  // Защита от повторов
  usedPairs: [],          // ["main|fake", ...]
  lastSpyIndex: -1
};

/* ===== ССЫЛКИ НА DOM ===== */
const el = {};

/* =========================================================
   ИНИЦИАЛИЗАЦИЯ
   ========================================================= */
function initApp() {
  cacheDom();
  loadCustomLocations();
  renderCategories();
  renderCustomCategoryOptions();
  renderCustomList();
  renderPlayerNames();
  bindEvents();
  updatePlayerCountDisplay();
}

function cacheDom() {
  el.screens = {
    setup: document.getElementById("screen-setup"),
    pass: document.getElementById("screen-pass"),
    role: document.getElementById("screen-role"),
    game: document.getElementById("screen-game")
  };
  el.playersCount = document.getElementById("players-count");
  el.playersMinus = document.getElementById("players-minus");
  el.playersPlus = document.getElementById("players-plus");
  el.playersNames = document.getElementById("players-names");
  el.categoriesList = document.getElementById("categories-list");
  el.categoriesHint = document.getElementById("categories-hint");
  el.customMain = document.getElementById("custom-main");
  el.customFake = document.getElementById("custom-fake");
  el.customCategory = document.getElementById("custom-category");
  el.addCustomBtn = document.getElementById("add-custom-btn");
  el.customList = document.getElementById("custom-list");
  el.startGameBtn = document.getElementById("start-game-btn");

  el.passPlayerName = document.getElementById("pass-player-name");
  el.showRoleBtn = document.getElementById("show-role-btn");

  el.rolePlayerName = document.getElementById("role-player-name");
  el.roleLocation = document.getElementById("role-location");
  el.hideRoleBtn = document.getElementById("hide-role-btn");

  el.firstPlayerName = document.getElementById("first-player-name");
  el.nextRoundBtn = document.getElementById("next-round-btn");
  el.toMenuBtn = document.getElementById("to-menu-btn");
}

function bindEvents() {
  el.playersMinus.addEventListener("click", () => changePlayerCount(-1));
  el.playersPlus.addEventListener("click", () => changePlayerCount(1));
  el.addCustomBtn.addEventListener("click", saveCustomLocation);
  el.startGameBtn.addEventListener("click", startGame);
  el.showRoleBtn.addEventListener("click", showCurrentRole);
  el.hideRoleBtn.addEventListener("click", hideRoleAndNext);
  el.nextRoundBtn.addEventListener("click", nextRound);
  el.toMenuBtn.addEventListener("click", () => showScreen("setup"));
}

/* =========================================================
   ЭКРАНЫ
   ========================================================= */
function showScreen(name) {
  Object.values(el.screens).forEach((s) => s.classList.remove("active"));
  if (el.screens[name]) {
    el.screens[name].classList.add("active");
  }
}

/* =========================================================
   КОЛИЧЕСТВО ИГРОКОВ
   ========================================================= */
function changePlayerCount(delta) {
  const next = state.playerCount + delta;
  if (next < MIN_PLAYERS || next > MAX_PLAYERS) return;
  state.playerCount = next;
  updatePlayerCountDisplay();
  renderPlayerNames();
}

function updatePlayerCountDisplay() {
  el.playersCount.textContent = state.playerCount;
}

function renderPlayerNames() {
  // Сохраняем уже введённые имена
  const existing = collectPlayerNames();
  el.playersNames.innerHTML = "";

  for (let i = 0; i < state.playerCount; i++) {
    const row = document.createElement("div");
    row.className = "player-row";

    const idx = document.createElement("span");
    idx.className = "player-index";
    idx.textContent = i + 1;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "input";
    input.style.marginBottom = "0";
    input.placeholder = "Игрок " + (i + 1);
    input.value = existing[i] || "";
    input.dataset.index = i;
    input.autocomplete = "off";

    row.appendChild(idx);
    row.appendChild(input);
    el.playersNames.appendChild(row);
  }
}

function collectPlayerNames() {
  const inputs = el.playersNames.querySelectorAll("input");
  return Array.from(inputs).map((inp) => inp.value.trim());
}

/* =========================================================
   КАТЕГОРИИ
   ========================================================= */
function renderCategories() {
  el.categoriesList.innerHTML = "";

  Object.keys(DEFAULT_CATEGORIES).forEach((key) => {
    const cat = DEFAULT_CATEGORIES[key];
    const checked = state.selectedCategories.includes(key);

    const item = document.createElement("div");
    item.className = "category-item" + (checked ? " checked" : "");
    item.dataset.key = key;

    const box = document.createElement("div");
    box.className = "category-checkbox";
    box.textContent = checked ? "✓" : "";

    const info = document.createElement("div");
    info.className = "category-info";

    const name = document.createElement("div");
    name.className = "category-name";
    name.textContent = cat.name;

    const count = document.createElement("div");
    count.className = "category-count";
    count.textContent = cat.pairs.length + " пар локаций";

    info.appendChild(name);
    info.appendChild(count);
    item.appendChild(box);
    item.appendChild(info);

    item.addEventListener("click", () => toggleCategory(key));
    el.categoriesList.appendChild(item);
  });
}

function toggleCategory(key) {
  const idx = state.selectedCategories.indexOf(key);
  if (idx === -1) {
    state.selectedCategories.push(key);
  } else {
    state.selectedCategories.splice(idx, 1);
  }
  renderCategories();
  clearCategoriesError();
}

function clearCategoriesError() {
  el.categoriesHint.classList.remove("error");
  el.categoriesHint.textContent = "Выберите хотя бы одну категорию";
}

function showCategoriesError() {
  el.categoriesHint.classList.add("error");
  el.categoriesHint.textContent = "⚠ Выберите хотя бы одну категорию!";
}

/* =========================================================
   КАСТОМНЫЕ ЛОКАЦИИ
   ========================================================= */
function renderCustomCategoryOptions() {
  el.customCategory.innerHTML = "";

  Object.keys(DEFAULT_CATEGORIES).forEach((key) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = DEFAULT_CATEGORIES[key].name;
    el.customCategory.appendChild(opt);
  });

  const myOpt = document.createElement("option");
  myOpt.value = "custom";
  myOpt.textContent = "Мои локации";
  el.customCategory.appendChild(myOpt);
}

function saveCustomLocation() {
  const main = el.customMain.value.trim();
  const fake = el.customFake.value.trim();
  const category = el.customCategory.value;

  if (!main || !fake) {
    alert("Заполните оба поля: основную и похожую локацию.");
    return;
  }

  state.customLocations.push({ main, fake, category });
  persistCustomLocations();

  el.customMain.value = "";
  el.customFake.value = "";

  renderCustomList();
  renderCategories();
}

function renderCustomList() {
  el.customList.innerHTML = "";

  if (state.customLocations.length === 0) return;

  state.customLocations.forEach((loc, index) => {
    const item = document.createElement("div");
    item.className = "custom-item";

    const text = document.createElement("div");
    text.className = "custom-item-text";
    text.textContent = loc.main + " / " + loc.fake;

    const cat = document.createElement("span");
    cat.className = "custom-item-cat";
    cat.textContent = getCategoryName(loc.category);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "custom-delete";
    del.textContent = "×";
    del.setAttribute("aria-label", "Удалить");
    del.addEventListener("click", () => deleteCustomLocation(index));

    item.appendChild(text);
    item.appendChild(cat);
    item.appendChild(del);
    el.customList.appendChild(item);
  });
}

function deleteCustomLocation(index) {
  state.customLocations.splice(index, 1);
  persistCustomLocations();
  renderCustomList();
  renderCategories();
}

function getCategoryName(key) {
  if (key === "custom") return "Мои локации";
  return DEFAULT_CATEGORIES[key] ? DEFAULT_CATEGORIES[key].name : key;
}

function persistCustomLocations() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.customLocations));
  } catch (e) {
    /* localStorage может быть недоступен */
  }
}

function loadCustomLocations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        state.customLocations = parsed;
      }
    }
  } catch (e) {
    state.customLocations = [];
  }
}

/* =========================================================
   СБОР ПУЛА ЛОКАЦИЙ
   ========================================================= */
function buildLocationPool() {
  const pool = [];

  // Из выбранных пресетов
  state.selectedCategories.forEach((key) => {
    const cat = DEFAULT_CATEGORIES[key];
    if (!cat) return;
    cat.pairs.forEach((pair) => {
      pool.push({ main: pair[0], fake: pair[1] });
    });
  });

  // Кастомные локации, относящиеся к выбранным категориям или к "custom"
  state.customLocations.forEach((loc) => {
    if (loc.category === "custom" || state.selectedCategories.includes(loc.category)) {
      pool.push({ main: loc.main, fake: loc.fake });
    }
  });

  return pool;
}

/* =========================================================
   СТАРТ ИГРЫ
   ========================================================= */
function startGame() {
  // Проверка категорий
  const pool = buildLocationPool();
  if (pool.length === 0) {
    showCategoriesError();
    return;
  }

  // Сбор имён
  const names = collectPlayerNames();
  state.players = [];
  for (let i = 0; i < state.playerCount; i++) {
    const name = names[i] && names[i].length > 0 ? names[i] : "Игрок " + (i + 1);
    state.players.push({ name });
  }

  // Формируем раунд
  prepareRound(pool);

  // Начинаем показ ролей с первого игрока
  state.round.currentIndex = 0;
  showScreen("pass");
  renderPassScreen();
}

/* =========================================================
   ПОДГОТОВКА РАУНДА (умный рандом)
   ========================================================= */
function prepareRound(pool) {
  // 1. Выбор пары локаций без повторов
  const pair = pickUnusedPair(pool);

  let mainLocation = pair.main;
  let fakeLocation = pair.fake;

  // 2. С вероятностью 50% меняем местами
  if (Math.random() < 0.5) {
    const tmp = mainLocation;
    mainLocation = fakeLocation;
    fakeLocation = tmp;
  }

  // 3. Выбор шпиона (не тот же, что в прошлый раз)
  const spyIndex = pickSpyIndex(state.players.length);

  // 4. Формируем роли
  const roundPlayers = state.players.map((p, i) => ({
    name: p.name,
    isSpy: i === spyIndex,
    location: i === spyIndex ? fakeLocation : mainLocation
  }));

  // 5. Случайный первый игрок
  const firstIndex = Math.floor(Math.random() * state.players.length);

  state.round = {
    players: roundPlayers,
    mainLocation,
    fakeLocation,
    firstPlayer: state.players[firstIndex].name,
    currentIndex: 0
  };

  state.lastSpyIndex = spyIndex;
}

function pickUnusedPair(pool) {
  // Ключи уже использованных пар
  const usedSet = new Set(state.usedPairs);

  // Доступные (не использованные) пары
  let available = pool.filter((p) => !usedSet.has(pairKey(p)));

  // Если все пары использованы — сбрасываем историю
  if (available.length === 0) {
    state.usedPairs = [];
    available = pool.slice();
  }

  const chosen = available[Math.floor(Math.random() * available.length)];
  state.usedPairs.push(pairKey(chosen));
  return chosen;
}

function pairKey(pair) {
  return pair.main + "|" + pair.fake;
}

function pickSpyIndex(count) {
  if (count <= 2) {
    return Math.floor(Math.random() * count);
  }

  let index;
  let guard = 0;
  do {
    index = Math.floor(Math.random() * count);
    guard++;
  } while (index === state.lastSpyIndex && guard < 50);

  return index;
}

/* =========================================================
   ЭКРАН ПЕРЕДАЧИ УСТРОЙСТВА
   ========================================================= */
function renderPassScreen() {
  const player = state.round.players[state.round.currentIndex];
  el.passPlayerName.textContent = player.name;
}

function showCurrentRole() {
  const player = state.round.players[state.round.currentIndex];
  el.rolePlayerName.textContent = player.name;
  el.roleLocation.textContent = player.location;
  showScreen("role");
}

function hideRoleAndNext() {
  state.round.currentIndex++;

  if (state.round.currentIndex < state.round.players.length) {
    // Следующий игрок
    renderPassScreen();
    showScreen("pass");
  } else {
    // Все посмотрели — начинаем игру
    el.firstPlayerName.textContent = state.round.firstPlayer;
    showScreen("game");
  }
}

/* =========================================================
   СЛЕДУЮЩИЙ РАУНД
   ========================================================= */
function nextRound() {
  const pool = buildLocationPool();
  if (pool.length === 0) {
    showScreen("setup");
    return;
  }

  prepareRound(pool);
  state.round.currentIndex = 0;
  renderPassScreen();
  showScreen("pass");
}

/* =========================================================
   ЗАПУСК
   ========================================================= */
document.addEventListener("DOMContentLoaded", initApp);
