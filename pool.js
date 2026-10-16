/* =========================================================
   ВЕЧЕРИНКА ИГР — БИЛЬЯРД (8-BALL POOL) ДЛЯ ДВОИХ
   Полноценный 2D-движок на HTML5 Canvas с реалистичной физикой,
   псевдо-3D графикой шаров, прицеливанием, правилами пула «Восьмерка»,
   заказом лузы для шара №8, «битком в руке» и Web Audio звуками.
   ========================================================= */

"use strict";

(function () {
  /* ===== 1. КОНСТАНТЫ СТОЛА И ГЕОМЕТРИИ ===== */
  const TABLE_WIDTH = 840;
  const TABLE_HEIGHT = 420;
  const CUSHION_WIDTH = 32;
  const BALL_RADIUS = 11.5;
  const BALL_DIAMETER = BALL_RADIUS * 2;
  const MAX_SPEED = 22;
  const SUB_STEPS = 8;
  const FRICTION_DECEL_PER_SEC = 5.2; // Честная сила трения сукна (замедление в px/frame за секунду)
  const FRICTION_DECEL_PER_STEP = (FRICTION_DECEL_PER_SEC / 60) / SUB_STEPS;
  const STOP_SPEED_THRESHOLD = 0.032; // Четкая отсечка полной остановки (~1.9 px/sec при 60 FPS)
  const RESTITUTION_BALL = 0.96; // Жесткий звонкий отскок шар-шар (0.95 - 0.97)
  const RESTITUTION_CUSHION = 0.78; // Упругость бортов стола шар-резина (0.75 - 0.82)

  // Цвета шаров (1–7 сплошные, 8 черный, 9–15 полосатые)
  const BALL_COLORS = {
    0: "#f8fafc", // Белый биток
    1: "#facc15", // 1 Желтый
    2: "#2563eb", // 2 Синий
    3: "#dc2626", // 3 Красный
    4: "#7c3aed", // 4 Фиолетовый
    5: "#ea580c", // 5 Оранжевый
    6: "#16a34a", // 6 Зеленый
    7: "#831843", // 7 Бордовый / темно-красный
    8: "#111827", // 8 Черный
    9: "#facc15", // 9 Полосатый желтый
    10: "#2563eb", // 10 Полосатый синий
    11: "#dc2626", // 11 Полосатый красный
    12: "#7c3aed", // 12 Полосатый фиолетовый
    13: "#ea580c", // 13 Полосатый оранжевый
    14: "#16a34a", // 14 Полосатый зеленый
    15: "#831843"  // 15 Полосатый бордовый
  };

  // 6 луз стола: координаты центров и радиусы захвата
  const POCKETS = [
    { x: 34, y: 34, r: 26, name: "Левая верхняя луза" },
    { x: 420, y: 22, r: 23, name: "Центральная верхняя луза" },
    { x: 806, y: 34, r: 26, name: "Правая верхняя луза" },
    { x: 34, y: 386, r: 26, name: "Левая нижняя луза" },
    { x: 420, y: 398, r: 23, name: "Центральная нижняя луза" },
    { x: 806, y: 386, r: 26, name: "Правая нижняя луза" }
  ];

  // 6 прямых сегментов бортов стола
  const CUSHIONS = [
    { type: "horizontal", x1: 58, x2: 398, y: 32, normalY: 1 },    // Верхний левый
    { type: "horizontal", x1: 442, x2: 782, y: 32, normalY: 1 },   // Верхний правый
    { type: "horizontal", x1: 58, x2: 398, y: 388, normalY: -1 },  // Нижний левый
    { type: "horizontal", x1: 442, x2: 782, y: 388, normalY: -1 }, // Нижний правый
    { type: "vertical", y1: 58, y2: 362, x: 32, normalX: 1 },      // Левый борт
    { type: "vertical", y1: 58, y2: 362, x: 808, normalX: -1 }     // Правый борт
  ];

  // Угловые вершины губок луз для скругленного отскока
  const CUSHION_VERTICES = [
    { x: 58, y: 32 }, { x: 398, y: 32 }, { x: 442, y: 32 }, { x: 782, y: 32 },
    { x: 58, y: 388 }, { x: 398, y: 388 }, { x: 442, y: 388 }, { x: 782, y: 388 },
    { x: 32, y: 58 }, { x: 32, y: 362 }, { x: 808, y: 58 }, { x: 808, y: 362 }
  ];

  /* ===== 2. ЗВУКОВОЙ СИНТЕЗАТОР (WEB AUDIO API) ===== */
  class PoolAudio {
    constructor() {
      this.ctx = null;
      this.enabled = true;
    }

    init() {
      if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
    }

    playBallHit(impulse) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const gain = Math.min(1, Math.max(0.08, impulse / 12));
        const now = this.ctx.currentTime;

        // Короткий резкий щелчок шаров (смола)
        const osc = this.ctx.createOscillator();
        const oscGain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1400, now);
        osc.frequency.exponentialRampToValueAtTime(450, now + 0.035);

        oscGain.gain.setValueAtTime(gain * 0.9, now);
        oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        // Высокочастотный клик
        const osc2 = this.ctx.createOscillator();
        const osc2Gain = this.ctx.createGain();
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(2400, now);
        osc2.frequency.exponentialRampToValueAtTime(800, now + 0.02);
        osc2Gain.gain.setValueAtTime(gain * 0.7, now);
        osc2Gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

        osc.connect(oscGain);
        oscGain.connect(this.ctx.destination);
        osc2.connect(osc2Gain);
        osc2Gain.connect(this.ctx.destination);

        osc.start(now);
        osc.stop(now + 0.045);
        osc2.start(now);
        osc2.stop(now + 0.025);
      } catch (e) {}
    }

    playCueHit(power) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(320, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.06);

        gain.gain.setValueAtTime(Math.min(1, Math.max(0.2, power)), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.075);
      } catch (e) {}
    }

    playCushion(speed) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(160, now);
        osc.frequency.exponentialRampToValueAtTime(75, now + 0.06);

        const vol = Math.min(0.7, Math.max(0.1, speed / 15));
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.075);
      } catch (e) {}
    }

    playPocket() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(280, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.16);

        gain.gain.setValueAtTime(0.65, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.19);
      } catch (e) {}
    }

    playFoul() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(165, now + 0.12);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.36);
      } catch (e) {}
    }

    playNominate() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(1046, now); // C6
        osc.frequency.setValueAtTime(1318, now + 0.08); // E6

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
      } catch (e) {}
    }

    playWin() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const now = this.ctx.currentTime + idx * 0.11;
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0.4, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now);
          osc.stop(now + 0.46);
        });
      } catch (e) {}
    }
  }

  const audio = new PoolAudio();

  /* ===== 3. КЛАСС ШАРА (BALL) ===== */
  class Ball {
    constructor(id, x, y) {
      this.id = id;
      this.x = x;
      this.y = y;
      this.vx = 0;
      this.vy = 0;
      this.isPotted = false;
      this.pottedAnim = 0; // 0 to 1 при падении в лузу
      this.pottedPocket = null;
      this.isCue = id === 0;
      this.isEight = id === 8;
      this.isSolid = id >= 1 && id <= 7;
      this.isStripe = id >= 9 && id <= 15;

      // 3D-вектор ориентации точки с номером (единичная нормаль nx, ny, nz)
      // Начальное положение: смотрит строго вверх на зрителя (0, 0, 1)
      this.nx = 0;
      this.ny = 0;
      this.nz = 1;
    }

    get speed() {
      return Math.hypot(this.vx, this.vy);
    }

    resetVelocity() {
      this.vx = 0;
      this.vy = 0;
    }

    // Обновление 3D-вращения при качении без проскальзывания по сукну
    updateRotation(dx, dy) {
      const dist = Math.hypot(dx, dy);
      if (dist < 0.0001) return;

      const dAngle = dist / BALL_RADIUS;

      // Единичный вектор оси вращения (в плоскости стола XY, строго перпендикулярно перемещению)
      const ux = -dy / dist;
      const uy = dx / dist;

      // Поворот вектора нормали вокруг оси вращения u по формуле Родрига
      const cosT = Math.cos(dAngle);
      const sinT = Math.sin(dAngle);
      const omc = 1 - cosT;

      const nx = this.nx;
      const ny = this.ny;
      const nz = this.nz;

      const dot = ux * nx + uy * ny;
      const cx = uy * nz;
      const cy = -ux * nz;
      const cz = ux * ny - uy * nx;

      let newNx = nx * cosT + cx * sinT + ux * dot * omc;
      let newNy = ny * cosT + cy * sinT + uy * dot * omc;
      let newNz = nz * cosT + cz * sinT;

      // Нормализация вектора ориентации
      const len = Math.hypot(newNx, newNy, newNz) || 1;
      this.nx = newNx / len;
      this.ny = newNy / len;
      this.nz = newNz / len;
    }
  }

  /* ===== 4. СОСТОЯНИЕ ИГРЫ (STATE) ===== */
  const poolState = {
    player1: { name: "Игрок 1", group: null }, // group: 'solids' (1-7) | 'stripes' (9-15)
    player2: { name: "Игрок 2", group: null },
    activePlayerIndex: 0, // 0 - player1, 1 - player2

    isTableOpen: true,
    isFirstShot: true, // Разбой
    nominatedPocket: null, // 0..5 (обязателен только для шара №8)

    ballInHand: false,
    handBallPos: { x: 226, y: 210 },
    handBallValid: true,
    isDraggingHandBall: false,

    aimAngle: 0, // Направление удара (радианы)
    aimPower: 0.5, // 0.05..1.0
    isAiming: false,
    isDraggingCue: false,
    cueOffset: 25, // Оттяжка кия в пикселях

    strikeAnimation: 0, // >0 во время анимации удара кием

    shotInProgress: false,
    firstBallHit: null,
    shotStartState: null,
    pottedThisTurn: [],
    cueBallScratched: false,
    foulOccurred: false,
    foulReason: "",

    balls: [],
    gameOver: false
  };

  /* ===== 5. DOM ЭЛЕМЕНТЫ ===== */
  const poolDom = {};

  function cachePoolDom() {
    poolDom.screenSetup = document.getElementById("screen-pool-setup");
    poolDom.screenGame = document.getElementById("screen-pool-game");
    poolDom.cardMenu = document.getElementById("card-pool");
    poolDom.setupBackBtn = document.getElementById("pool-setup-back-btn");
    poolDom.gameBackBtn = document.getElementById("pool-game-back-btn");
    poolDom.p1Input = document.getElementById("pool-player1-input");
    poolDom.p2Input = document.getElementById("pool-player2-input");
    poolDom.startBtn = document.getElementById("pool-start-btn");

    poolDom.soundBtn = document.getElementById("pool-sound-btn");
    poolDom.resetBtn = document.getElementById("pool-reset-btn");

    poolDom.p1Card = document.getElementById("pool-p1-card");
    poolDom.p1Badge = document.getElementById("pool-p1-badge");
    poolDom.p1Name = document.getElementById("pool-p1-name");
    poolDom.p1Group = document.getElementById("pool-p1-group");
    poolDom.p1Balls = document.getElementById("pool-p1-balls");

    poolDom.p2Card = document.getElementById("pool-p2-card");
    poolDom.p2Badge = document.getElementById("pool-p2-badge");
    poolDom.p2Name = document.getElementById("pool-p2-name");
    poolDom.p2Group = document.getElementById("pool-p2-group");
    poolDom.p2Balls = document.getElementById("pool-p2-balls");

    poolDom.tableStatusPill = document.getElementById("pool-table-status-pill");
    poolDom.statusBar = document.getElementById("pool-status-bar");
    poolDom.statusText = document.getElementById("pool-status-text");

    poolDom.canvas = document.getElementById("pool-canvas");
    poolDom.canvasContainer = document.getElementById("pool-canvas-container");
    poolDom.nominateOverlay = document.getElementById("pool-nominate-overlay");
    poolDom.inHandBanner = document.getElementById("pool-in-hand-banner");
    poolDom.placeBallBtn = document.getElementById("pool-place-ball-btn");

    poolDom.aimLeft = document.getElementById("pool-aim-left");
    poolDom.aimRight = document.getElementById("pool-aim-right");
    poolDom.powerSlider = document.getElementById("pool-power-slider");
    poolDom.powerValue = document.getElementById("pool-power-value");
    poolDom.strikeBtn = document.getElementById("pool-strike-btn");

    poolDom.winnerModal = document.getElementById("pool-winner-modal");
    poolDom.winnerTitle = document.getElementById("pool-winner-title");
    poolDom.winnerPlayerName = document.getElementById("pool-winner-player-name");
    poolDom.winnerReasonText = document.getElementById("pool-winner-reason-text");
    poolDom.winnerReplayBtn = document.getElementById("pool-modal-replay-btn");
    poolDom.winnerMenuBtn = document.getElementById("pool-modal-menu-btn");
  }

  /* ===== 6. ИНИЦИАЛИЗАЦИЯ И РАССТАНОВКА ПИРАМИДЫ ===== */
  function setupNewGame(sameNames = false) {
    if (!sameNames) {
      const name1 = (poolDom.p1Input && poolDom.p1Input.value.trim()) || "Игрок 1";
      const name2 = (poolDom.p2Input && poolDom.p2Input.value.trim()) || "Игрок 2";
      poolState.player1.name = name1;
      poolState.player2.name = name2;
    }
    poolState.player1.group = null;
    poolState.player2.group = null;

    // Случайный выбор первого хода (разбой 50/50)
    poolState.activePlayerIndex = Math.random() < 0.5 ? 0 : 1;
    poolState.isTableOpen = true;
    poolState.isFirstShot = true;
    poolState.nominatedPocket = null;
    poolState.ballInHand = false;
    poolState.shotInProgress = false;
    poolState.gameOver = false;
    poolState.strikeAnimation = 0;
    poolState.shotStartState = null;

    // Сброс шкалы силы
    poolState.aimPower = 0.5;
    if (poolDom.powerSlider) poolDom.powerSlider.value = 50;
    if (poolDom.powerValue) poolDom.powerValue.textContent = "50%";

    // Создание шаров
    createRackBalls();

    // Направление прицеливания битка в сторону пирамиды
    const cueBall = getCueBall();
    poolState.aimAngle = 0; // Строго вправо в сторону вершины пирамиды

    // Скрытие модальных окон
    if (poolDom.winnerModal) poolDom.winnerModal.classList.add("hidden");
    if (poolDom.nominateOverlay) poolDom.nominateOverlay.classList.add("hidden");
    if (poolDom.inHandBanner) poolDom.inHandBanner.classList.add("hidden");

    // Обновление HUD
    updateHud();

    // Уведомление о первом игроке
    const activePlayer = getActivePlayer();
    setGameStatus(`Первым разбивает: ${activePlayer.name}!`, "normal");
    if (window.showToast) {
      window.showToast(`🎱 Первым разбивает: ${activePlayer.name}!`, 3500);
    }
  }

  function createRackBalls() {
    poolState.balls = [];

    // Биток в «доме» (x = 226, y = 210)
    const cueBall = new Ball(0, 226, 210);
    poolState.balls.push(cueBall);

    // Точка пирамиды (foot spot)
    const apexX = 590;
    const apexY = 210;
    const rowSpacing = BALL_RADIUS * Math.sqrt(3); // ~19.92 px
    const ballSpacing = BALL_DIAMETER; // 23 px

    // Позиции для 15 шаров пирамиды:
    // Ряд 1: 1 шар (apex)
    // Ряд 2: 2 шара
    // Ряд 3: 3 шара (центр — шар №8)
    // Ряд 4: 4 шара
    // Ряд 5: 5 шаров (нижние углы: один сплошной, один полосатый)
    const positions = [];

    for (let row = 0; row < 5; row++) {
      const rx = apexX + row * rowSpacing;
      const startY = apexY - (row * ballSpacing) / 2;
      for (let col = 0; col <= row; col++) {
        positions.push({
          x: rx,
          y: startY + col * ballSpacing,
          row: row,
          col: col
        });
      }
    }

    // Составление номеров шаров согласно официальным правилам:
    // - Шар №8 строго на позиции Row 3, Center (индекс 4 в массиве positions)
    // - В нижних углах (Row 5 Col 0 и Row 5 Col 4): один сплошной (1-7) и один полосатый (9-15)
    const solids = [1, 2, 3, 4, 5, 6, 7];
    const stripes = [9, 10, 11, 12, 13, 14, 15];

    // Выбираем по одному для углов
    const cornerSolid = solids.splice(Math.floor(Math.random() * solids.length), 1)[0];
    const cornerStripe = stripes.splice(Math.floor(Math.random() * stripes.length), 1)[0];

    // Остальные 12 шаров перемешиваем
    const remaining = solids.concat(stripes);
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = remaining[i];
      remaining[i] = remaining[j];
      remaining[j] = temp;
    }

    // Раскладываем по позициям:
    // Индекс 4: Row 2, Col 1 (Row 3 Center) -> Шар 8
    // Индекс 10: Row 4, Col 0 (Нижний угол 1) -> cornerSolid
    // Индекс 14: Row 4, Col 4 (Нижний угол 2) -> cornerStripe
    const layout = new Array(15);
    layout[4] = 8;
    if (Math.random() < 0.5) {
      layout[10] = cornerSolid;
      layout[14] = cornerStripe;
    } else {
      layout[10] = cornerStripe;
      layout[14] = cornerSolid;
    }

    let remIdx = 0;
    for (let i = 0; i < 15; i++) {
      if (layout[i] === undefined) {
        layout[i] = remaining[remIdx++];
      }
    }

    // Добавляем шары с микро-смещением для естественного разбоя
    for (let i = 0; i < 15; i++) {
      const pos = positions[i];
      const jitterX = (Math.random() - 0.5) * 0.1;
      const jitterY = (Math.random() - 0.5) * 0.1;
      const ball = new Ball(layout[i], pos.x + jitterX, pos.y + jitterY);
      poolState.balls.push(ball);
    }
  }

  function getCueBall() {
    return poolState.balls.find((b) => b.id === 0);
  }

  function getActivePlayer() {
    return poolState.activePlayerIndex === 0 ? poolState.player1 : poolState.player2;
  }

  function getWaitingPlayer() {
    return poolState.activePlayerIndex === 0 ? poolState.player2 : poolState.player1;
  }

  function switchTurn() {
    poolState.activePlayerIndex = poolState.activePlayerIndex === 0 ? 1 : 0;
  }

  function isGroupPotted(group) {
    if (!group) return false;
    const startId = group === "solids" ? 1 : 9;
    const endId = group === "solids" ? 7 : 15;
    for (let id = startId; id <= endId; id++) {
      const b = poolState.balls.find((x) => x.id === id);
      if (b && !b.isPotted) return false;
    }
    return true;
  }

  function getRemainingGroupCount(group) {
    if (!group) return 7;
    const startId = group === "solids" ? 1 : 9;
    const endId = group === "solids" ? 7 : 15;
    let count = 0;
    for (let id = startId; id <= endId; id++) {
      const b = poolState.balls.find((x) => x.id === id);
      if (b && !b.isPotted) count++;
    }
    return count;
  }

  /* ===== 7. ОБНОВЛЕНИЕ HUD И ИНТЕРФЕЙСА ===== */
  function updateHud() {
    const p1 = poolState.player1;
    const p2 = poolState.player2;
    const activeIdx = poolState.activePlayerIndex;

    // Имена
    if (poolDom.p1Name) poolDom.p1Name.textContent = p1.name;
    if (poolDom.p2Name) poolDom.p2Name.textContent = p2.name;

    // Активный игрок (подсветка карточки)
    if (poolDom.p1Card) poolDom.p1Card.classList.toggle("active", activeIdx === 0);
    if (poolDom.p2Card) poolDom.p2Card.classList.toggle("active", activeIdx === 1);

    // Статус стола
    if (poolDom.tableStatusPill) {
      if (poolState.isTableOpen) {
        poolDom.tableStatusPill.textContent = "Открытый стол";
      } else {
        poolDom.tableStatusPill.textContent = "Масти распределены";
      }
    }

    // Подписи групп
    if (poolDom.p1Group) {
      if (poolState.isTableOpen || !p1.group) {
        poolDom.p1Group.textContent = "Открытый стол";
      } else {
        const isEight = isGroupPotted(p1.group);
        poolDom.p1Group.textContent = isEight
          ? "🎯 Цель: Шар №8"
          : (p1.group === "solids" ? "Сплошные (1–7)" : "Полосатые (9–15)");
      }
    }

    if (poolDom.p2Group) {
      if (poolState.isTableOpen || !p2.group) {
        poolDom.p2Group.textContent = "Открытый стол";
      } else {
        const isEight = isGroupPotted(p2.group);
        poolDom.p2Group.textContent = isEight
          ? "🎯 Цель: Шар №8"
          : (p2.group === "solids" ? "Сплошные (1–7)" : "Полосатые (9–15)");
      }
    }

    // Рендер мини-иконок шаров в HUD
    renderMiniBalls(poolDom.p1Balls, p1.group);
    renderMiniBalls(poolDom.p2Balls, p2.group);

    // Проверка обязательного заказа лузы для шара №8
    const activePlayer = getActivePlayer();
    const needsEight = !poolState.isTableOpen && activePlayer.group && isGroupPotted(activePlayer.group);

    if (needsEight && !poolState.shotInProgress && !poolState.gameOver) {
      renderNominateOverlay(true);
      if (poolState.nominatedPocket === null) {
        setGameStatus(`🎯 ${activePlayer.name}, выберите (закажите) лузу для шара №8!`, "nominate");
        if (poolDom.strikeBtn) poolDom.strikeBtn.disabled = true;
      } else {
        const pocketName = POCKETS[poolState.nominatedPocket].name;
        setGameStatus(`Заказана: ${pocketName}. Бейте по шару №8!`, "nominate");
        if (poolDom.strikeBtn) poolDom.strikeBtn.disabled = false;
      }
    } else {
      renderNominateOverlay(false);
      if (poolDom.strikeBtn) {
        poolDom.strikeBtn.disabled = poolState.shotInProgress || poolState.gameOver;
      }
    }
  }

  function renderMiniBalls(container, group) {
    if (!container) return;
    container.innerHTML = "";

    if (!group || poolState.isTableOpen) {
      // Пока стол открыт, показываем 7 нейтральных кружков
      for (let i = 0; i < 7; i++) {
        const dot = document.createElement("span");
        dot.className = "pool-mini-ball";
        dot.style.background = "#334155";
        dot.style.color = "#94a3b8";
        dot.textContent = "•";
        container.appendChild(dot);
      }
      return;
    }

    const startId = group === "solids" ? 1 : 9;
    const endId = group === "solids" ? 7 : 15;
    let allPotted = true;

    for (let id = startId; id <= endId; id++) {
      const ball = poolState.balls.find((b) => b.id === id);
      const isPotted = !ball || ball.isPotted;
      if (!isPotted) allPotted = false;

      const mini = document.createElement("span");
      mini.className = "pool-mini-ball" + (isPotted ? " pool-mini-ball--potted" : "");
      mini.style.background = BALL_COLORS[id];
      if (id >= 9) {
        // Полосатый мини-шар
        mini.style.background = `linear-gradient(180deg, #fff 20%, ${BALL_COLORS[id]} 20%, ${BALL_COLORS[id]} 80%, #fff 80%)`;
      }
      mini.textContent = id;
      container.appendChild(mini);
    }

    // Если все свои забиты — добавляем светящийся шар №8
    if (allPotted) {
      const eightBall = poolState.balls.find((b) => b.id === 8);
      const isEightPotted = !eightBall || eightBall.isPotted;
      const eightMini = document.createElement("span");
      eightMini.className = "pool-mini-ball pool-mini-ball--eight" + (isEightPotted ? " pool-mini-ball--potted" : "");
      eightMini.textContent = "8";
      container.appendChild(eightMini);
    }
  }

  function renderNominateOverlay(show) {
    if (!poolDom.nominateOverlay) return;
    if (!show) {
      poolDom.nominateOverlay.classList.add("hidden");
      poolDom.nominateOverlay.innerHTML = "";
      return;
    }

    poolDom.nominateOverlay.classList.remove("hidden");
    poolDom.nominateOverlay.innerHTML = "";

    const rect = poolDom.canvas.getBoundingClientRect();
    const scaleX = rect.width / TABLE_WIDTH;
    const scaleY = rect.height / TABLE_HEIGHT;

    POCKETS.forEach((p, idx) => {
      const marker = document.createElement("div");
      marker.className = "pool-pocket-target" + (poolState.nominatedPocket === idx ? " selected" : "");
      marker.style.left = p.x * scaleX + "px";
      marker.style.top = p.y * scaleY + "px";
      marker.title = p.name;
      marker.innerHTML = poolState.nominatedPocket === idx ? "🎯" : "⚪";

      marker.addEventListener("click", (e) => {
        e.stopPropagation();
        poolState.nominatedPocket = idx;
        audio.playNominate();
        updateHud();
      });

      poolDom.nominateOverlay.appendChild(marker);
    });
  }

  function setGameStatus(text, type = "normal") {
    if (!poolDom.statusText || !poolDom.statusBar) return;
    poolDom.statusText.textContent = text;
    poolDom.statusBar.className = "pool-status-bar " + (type || "normal");
  }

  /* ===== 8. ФИЗИЧЕСКИЙ ДВИЖОК (PHYSICS & SUB-STEPPING) ===== */
  function updatePhysics() {
    if (!poolState.shotInProgress) return;

    const dt = 1 / SUB_STEPS;
    let anyMoving = false;

    for (let step = 0; step < SUB_STEPS; step++) {
      // 1. Интеграция позиций, честное трение сукна и вращение шаров
      for (const b of poolState.balls) {
        if (b.isPotted) continue;

        const dx = b.vx * dt;
        const dy = b.vy * dt;
        b.x += dx;
        b.y += dy;

        // Псевдо-3D перекатывание шара в направлении вектора скорости
        b.updateRotation(dx, dy);

        // Постоянная сила трения качения по сукну (линейная деселерация)
        const speed = b.speed;
        if (speed > 0) {
          const newSpeed = Math.max(0, speed - FRICTION_DECEL_PER_STEP);
          if (newSpeed < STOP_SPEED_THRESHOLD) {
            // Четкая отсечка полной остановки: шар встает как вкопанный без бесконечного затухания
            b.resetVelocity();
          } else {
            b.vx = (b.vx / speed) * newSpeed;
            b.vy = (b.vy / speed) * newSpeed;
            anyMoving = true;
          }
        }

        // Проверка падения в лузы
        for (let pIdx = 0; pIdx < POCKETS.length; pIdx++) {
          const pocket = POCKETS[pIdx];
          const dist = Math.hypot(b.x - pocket.x, b.y - pocket.y);
          if (dist < pocket.r) {
            handleBallPocketed(b, pIdx);
            break;
          }
        }

        // Проверка столкновений с бортами (Cushions)
        handleCushionCollisions(b);
      }

      // 2. Упругие столкновения шаров между собой
      for (let i = 0; i < poolState.balls.length; i++) {
        const b1 = poolState.balls[i];
        if (b1.isPotted) continue;

        for (let j = i + 1; j < poolState.balls.length; j++) {
          const b2 = poolState.balls[j];
          if (b2.isPotted) continue;

          const dx = b2.x - b1.x;
          const dy = b2.y - b1.y;
          const dist = Math.hypot(dx, dy);

          if (dist < BALL_DIAMETER && dist > 0.001) {
            // Разделение перекрытия
            const overlap = (BALL_DIAMETER - dist) / 2;
            const nx = dx / dist;
            const ny = dy / dist;

            b1.x -= nx * overlap;
            b1.y -= ny * overlap;
            b2.x += nx * overlap;
            b2.y += ny * overlap;

            // Относительная скорость
            const rvx = b2.vx - b1.vx;
            const rvy = b2.vy - b1.vy;
            const velAlongNormal = rvx * nx + rvy * ny;

            if (velAlongNormal < 0) {
              const impulse = -(1 + RESTITUTION_BALL) * velAlongNormal / 2;
              b1.vx -= impulse * nx;
              b1.vy -= impulse * ny;
              b2.vx += impulse * nx;
              b2.vy += impulse * ny;

              // Фиксация первого касания битка
              if (b1.id === 0 && poolState.firstBallHit === null) {
                poolState.firstBallHit = b2.id;
              } else if (b2.id === 0 && poolState.firstBallHit === null) {
                poolState.firstBallHit = b1.id;
              }

              // Звук столкновения
              audio.playBallHit(Math.abs(velAlongNormal));
              anyMoving = true;
            }
          }
        }
      }
    }

    // Анимация падения шаров в лузу
    for (const b of poolState.balls) {
      if (b.isPotted && b.pottedAnim < 1) {
        b.pottedAnim = Math.min(1, b.pottedAnim + 0.08);
        anyMoving = true;
      }
    }

    // Если все шары остановились — завершаем удар и оцениваем ход
    if (!anyMoving) {
      poolState.shotInProgress = false;
      onShotComplete();
    }
  }

  function handleCushionCollisions(b) {
    if (b.isPotted) return;

    // Прямые сегменты
    for (const c of CUSHIONS) {
      if (c.type === "horizontal") {
        if (b.x >= c.x1 && b.x <= c.x2) {
          if (c.normalY === 1 && b.y - BALL_RADIUS < c.y) {
            b.y = c.y + BALL_RADIUS;
            b.vy = Math.abs(b.vy) * RESTITUTION_CUSHION;
            b.vx *= 0.97;
            audio.playCushion(b.speed);
          } else if (c.normalY === -1 && b.y + BALL_RADIUS > c.y) {
            b.y = c.y - BALL_RADIUS;
            b.vy = -Math.abs(b.vy) * RESTITUTION_CUSHION;
            b.vx *= 0.97;
            audio.playCushion(b.speed);
          }
        }
      } else if (c.type === "vertical") {
        if (b.y >= c.y1 && b.y <= c.y2) {
          if (c.normalX === 1 && b.x - BALL_RADIUS < c.x) {
            b.x = c.x + BALL_RADIUS;
            b.vx = Math.abs(b.vx) * RESTITUTION_CUSHION;
            b.vy *= 0.97;
            audio.playCushion(b.speed);
          } else if (c.normalX === -1 && b.x + BALL_RADIUS > c.x) {
            b.x = c.x - BALL_RADIUS;
            b.vx = -Math.abs(b.vx) * RESTITUTION_CUSHION;
            b.vy *= 0.97;
            audio.playCushion(b.speed);
          }
        }
      }
    }

    // Скругленные вершины губок луз
    for (const v of CUSHION_VERTICES) {
      const dx = b.x - v.x;
      const dy = b.y - v.y;
      const dist = Math.hypot(dx, dy);
      if (dist < BALL_RADIUS && dist > 0.001) {
        const nx = dx / dist;
        const ny = dy / dist;
        b.x = v.x + nx * BALL_RADIUS;
        b.y = v.y + ny * BALL_RADIUS;

        const vn = b.vx * nx + b.vy * ny;
        if (vn < 0) {
          b.vx -= (1 + RESTITUTION_CUSHION) * vn * nx;
          b.vy -= (1 + RESTITUTION_CUSHION) * vn * ny;
          audio.playCushion(b.speed);
        }
      }
    }
  }

  function handleBallPocketed(b, pIdx) {
    if (b.isPotted) return;
    b.isPotted = true;
    b.pottedAnim = 0;
    b.pottedPocket = pIdx;
    b.resetVelocity();

    // Записываем забитый шар
    poolState.pottedThisTurn.push({ id: b.id, pocketIndex: pIdx });

    if (b.id === 0) {
      poolState.cueBallScratched = true;
    }

    audio.playPocket();
  }

  /* ===== 9. СУДЕЙСТВО И ПРАВИЛА 8-BALL (REFEREE LOGIC) ===== */
  function onShotComplete() {
    const activePlayer = getActivePlayer();
    const waitingPlayer = getWaitingPlayer();
    const potted = poolState.pottedThisTurn;

    // Снимок состояния ДО удара (shotStartState)
    const startState = poolState.shotStartState || {
      wasTableOpen: poolState.isTableOpen,
      remainingMyBallsAtStart: activePlayer.group ? getRemainingGroupCount(activePlayer.group) : 7,
      wasTargetingEightBall: (!poolState.isTableOpen && activePlayer.group && isGroupPotted(activePlayer.group)),
      activePlayerGroup: activePlayer.group
    };

    const wasTableOpen = startState.wasTableOpen;
    const remainingMyBallsAtStart = startState.remainingMyBallsAtStart;
    const wasTargetingEightBall = startState.wasTargetingEightBall;

    let turnContinues = false;
    let foulOccurred = false;
    let foulReason = "";

    // 1. Проверяем падение шара №8
    const eightPotted = potted.find((p) => p.id === 8);

    if (eightPotted) {
      // Исключение: Разбой пирамиды
      if (poolState.isFirstShot) {
        // Выставляем шар №8 обратно на точку пирамиды
        const eightBall = poolState.balls.find((b) => b.id === 8);
        if (eightBall) {
          eightBall.isPotted = false;
          eightBall.pottedAnim = 0;
          eightBall.x = 590;
          eightBall.y = 210;
          eightBall.resetVelocity();
        }
        setGameStatus("Шар №8 выставлен обратно на стол (разбой)!", "normal");
        if (window.showToast) window.showToast("Шар №8 возвращен на стол (правило разбоя)", 3000);
      } else if (!wasTargetingEightBall) {
        // Если во время удара по обычным шарам (wasTargetingEightBall === false) в лузу упал шар №8 — это мгновенное поражение!
        return endGameWithWinner(
          waitingPlayer,
          `${activePlayer.name} забил шар №8 раньше времени (до того, как забил все свои шары)!`
        );
      } else {
        // Игрок играл по 8-ке (wasTargetingEightBall === true)
        if (poolState.cueBallScratched) {
          return endGameWithWinner(
            waitingPlayer,
            `${activePlayer.name} забил шар №8, но уронил биток в лузу (фол)!`
          );
        }

        if (poolState.firstBallHit !== 8) {
          return endGameWithWinner(
            waitingPlayer,
            `${activePlayer.name} совершил фол: первое касание было не по шару №8!`
          );
        }

        if (poolState.nominatedPocket === null || eightPotted.pocketIndex !== poolState.nominatedPocket) {
          const actualPocketName = POCKETS[eightPotted.pocketIndex].name;
          const orderPocketName = poolState.nominatedPocket !== null
            ? POCKETS[poolState.nominatedPocket].name
            : "не выбрана";
          return endGameWithWinner(
            waitingPlayer,
            `${activePlayer.name} забил шар №8 в другую лузу (${actualPocketName}), а заказывал ${orderPocketName}!`
          );
        }

        // ВСЕ УСЛОВИЯ ВЫПОЛНЕНЫ -> ЧИСТАЯ ПОБЕДА!
        return endGameWithWinner(
          activePlayer,
          `${activePlayer.name} забил шар №8 точно в заказанную лузу!`
        );
      }
    }

    // 2. Точные условия ФОЛА (штрафа) по итогам удара:
    if (poolState.cueBallScratched) {
      // Фол 1 (Упал биток)
      foulOccurred = true;
      foulReason = "Белый биток упал в лузу";
    } else if (poolState.firstBallHit === null) {
      // Фол 2 (Промах мимо всех шаров)
      foulOccurred = true;
      foulReason = "Биток не коснулся ни одного шара";
    } else if (wasTableOpen) {
      // Фол 3a (Открытый стол: бить первым касанием в 8-ку нельзя)
      if (poolState.firstBallHit === 8) {
        foulOccurred = true;
        foulReason = "Касание шара №8 при открытом столе";
      }
    } else if (remainingMyBallsAtStart > 0) {
      // Фол 3b (У игрока еще оставались свои шары: первое касание должно быть по своей группе)
      const firstHitBall = poolState.balls.find((b) => b.id === poolState.firstBallHit);
      const isSolidHit = firstHitBall && firstHitBall.isSolid;
      const isStripeHit = firstHitBall && firstHitBall.isStripe;

      if (activePlayer.group === "solids" && !isSolidHit) {
        foulOccurred = true;
        foulReason = poolState.firstBallHit === 8 ? "Первое касание по шару №8" : "Первое касание по шару соперника";
      } else if (activePlayer.group === "stripes" && !isStripeHit) {
        foulOccurred = true;
        foulReason = poolState.firstBallHit === 8 ? "Первое касание по шару №8" : "Первое касание по шару соперника";
      }
    } else if (wasTargetingEightBall) {
      // Фол 3c (Игрок целился в 8-ку: первое касание должно быть по 8-ке)
      if (poolState.firstBallHit !== 8) {
        foulOccurred = true;
        foulReason = "Первое касание не по шару №8";
      }
    }

    // 3. Последствия фола
    if (foulOccurred) {
      audio.playFoul();
      poolState.foulOccurred = true;
      poolState.foulReason = foulReason;

      // Ход переходит сопернику, соперник получает «Биток в руке»
      switchTurn();
      activateBallInHand();

      const nextPlayer = getActivePlayer();
      setGameStatus(`Фол! ${foulReason}. Биток в руке у ${nextPlayer.name}`, "foul");
      if (window.showToast) {
        window.showToast(`⚠️ Фол (${foulReason})! Биток в руке у ${nextPlayer.name}`, 3500);
      }

      poolState.isFirstShot = false;
      poolState.nominatedPocket = null;
      poolState.shotStartState = null;
      updateHud();
      return;
    }

    // 4. Если фола НЕТ: правила продолжения хода
    const objectBallsPotted = potted.filter((p) => p.id >= 1 && p.id <= 15 && p.id !== 8);

    if (wasTableOpen && !poolState.isFirstShot) {
      if (objectBallsPotted.length > 0) {
        const hasSolids = objectBallsPotted.some((p) => p.id <= 7);
        const hasStripes = objectBallsPotted.some((p) => p.id >= 9);

        if (hasSolids && !hasStripes) {
          activePlayer.group = "solids";
          waitingPlayer.group = "stripes";
          poolState.isTableOpen = false;
          turnContinues = true;
          if (window.showToast) window.showToast(`🎯 ${activePlayer.name} играет сплошными (1–7)!`, 3000);
        } else if (hasStripes && !hasSolids) {
          activePlayer.group = "stripes";
          waitingPlayer.group = "solids";
          poolState.isTableOpen = false;
          turnContinues = true;
          if (window.showToast) window.showToast(`🎯 ${activePlayer.name} играет полосатыми (9–15)!`, 3000);
        } else if (hasSolids && hasStripes) {
          // Упали оба: масть определяется первым забитым шаром
          const firstPottedId = objectBallsPotted[0].id;
          if (firstPottedId <= 7) {
            activePlayer.group = "solids";
            waitingPlayer.group = "stripes";
          } else {
            activePlayer.group = "stripes";
            waitingPlayer.group = "solids";
          }
          poolState.isTableOpen = false;
          turnContinues = true;
        }
      }
    } else if (wasTableOpen && poolState.isFirstShot) {
      // При стартовом разбое стол всегда остается открытым
      if (objectBallsPotted.length > 0) {
        turnContinues = true;
      }
    } else if (!wasTableOpen && activePlayer.group) {
      // Стол закрыт: проверяем, упал ли хотя бы один свой шар
      const myGroupPotted = objectBallsPotted.some((p) => {
        return activePlayer.group === "solids" ? p.id <= 7 : p.id >= 9;
      });

      if (myGroupPotted) {
        turnContinues = true;
      }
    }

    // 5. Переход хода или продолжение
    poolState.isFirstShot = false;
    poolState.nominatedPocket = null;
    poolState.shotStartState = null;

    if (turnContinues) {
      const remainingNow = activePlayer.group ? getRemainingGroupCount(activePlayer.group) : 7;
      if (remainingMyBallsAtStart > 0 && remainingNow === 0) {
        setGameStatus(`Все свои шары забиты! ${activePlayer.name} продолжает ход — теперь цельтесь в шар №8!`, "normal");
        if (window.showToast) {
          window.showToast(`🔥 Все шары группы забиты! Ход продолжается — забейте шар №8!`, 3500);
        }
      } else {
        setGameStatus(`Шар в лузе! ${activePlayer.name} продолжает ход.`, "normal");
      }
    } else {
      switchTurn();
      const nextPlayer = getActivePlayer();
      setGameStatus(`Ход: ${nextPlayer.name}`, "normal");
    }

    updateHud();
  }

  /* ===== 10. МЕХАНИКА «БИТОК В РУКЕ» (BALL IN HAND) ===== */
  function activateBallInHand() {
    poolState.ballInHand = true;
    poolState.isDraggingHandBall = false;

    // Воскрешаем биток, если он упал
    const cueBall = getCueBall();
    if (cueBall) {
      cueBall.isPotted = false;
      cueBall.pottedAnim = 0;
      cueBall.resetVelocity();

      // Ищем свободное место на столе
      const freePos = findFreeBallPosition(226, 210);
      cueBall.x = freePos.x;
      cueBall.y = freePos.y;
      poolState.handBallPos = { x: freePos.x, y: freePos.y };
      poolState.handBallValid = true;
    }

    if (poolDom.inHandBanner) poolDom.inHandBanner.classList.remove("hidden");
  }

  function validateCueBallPosition(x, y) {
    // В пределах игрового сукна
    const minX = 32 + BALL_RADIUS + 3;
    const maxX = 808 - BALL_RADIUS - 3;
    const minY = 32 + BALL_RADIUS + 3;
    const maxY = 388 - BALL_RADIUS - 3;

    if (x < minX || x > maxX || y < minY || y > maxY) return false;

    // Не перекрывает другие шары
    for (const b of poolState.balls) {
      if (b.id === 0 || b.isPotted) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < BALL_DIAMETER + 3) return false;
    }

    // Не в створе лузы
    for (const p of POCKETS) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < p.r + BALL_RADIUS + 2) return false;
    }

    return true;
  }

  function findFreeBallPosition(prefX, prefY) {
    if (validateCueBallPosition(prefX, prefY)) {
      return { x: prefX, y: prefY };
    }
    // Поиск по спирали
    for (let r = 20; r < 300; r += 20) {
      for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
        const testX = prefX + Math.cos(angle) * r;
        const testY = prefY + Math.sin(angle) * r;
        if (validateCueBallPosition(testX, testY)) {
          return { x: testX, y: testY };
        }
      }
    }
    return { x: 226, y: 210 };
  }

  function confirmBallInHandPlacement() {
    if (!poolState.ballInHand || !poolState.handBallValid) return;
    const cueBall = getCueBall();
    if (cueBall) {
      cueBall.x = poolState.handBallPos.x;
      cueBall.y = poolState.handBallPos.y;
    }
    poolState.ballInHand = false;
    if (poolDom.inHandBanner) poolDom.inHandBanner.classList.add("hidden");
    const activePlayer = getActivePlayer();
    setGameStatus(`Ход: ${activePlayer.name}. Наведите прицел и нанесите удар.`, "normal");
    updateHud();
  }

  /* ===== 11. ВЫПОЛНЕНИЕ УДАРА КИЕМ (SHOOTING) ===== */
  function executeShot() {
    if (poolState.shotInProgress || poolState.gameOver) return;

    // Если биток в руке — подтверждаем размещение
    if (poolState.ballInHand) {
      confirmBallInHandPlacement();
    }

    const activePlayer = getActivePlayer();

    // Снимок состояния ДО удара (shotStartState)
    const wasTableOpen = poolState.isTableOpen;
    const remainingMyBallsAtStart = activePlayer.group ? getRemainingGroupCount(activePlayer.group) : 7;
    const wasTargetingEightBall = (!wasTableOpen && activePlayer.group && remainingMyBallsAtStart === 0);

    // Проверка заказа лузы для шара №8
    if (wasTargetingEightBall && poolState.nominatedPocket === null) {
      if (window.showToast) window.showToast("⚠️ Сначала выберите (закажите) лузу для шара №8!", 3000);
      setGameStatus("🎯 Выберите лузу для шара №8 перед ударом!", "nominate");
      return;
    }

    const cueBall = getCueBall();
    if (!cueBall || cueBall.isPotted) return;

    // Сохраняем снимок состояния ДО удара
    poolState.shotStartState = {
      wasTableOpen,
      remainingMyBallsAtStart,
      wasTargetingEightBall,
      activePlayerGroup: activePlayer.group
    };

    // Анимация удара кия вперед
    poolState.strikeAnimation = 1;
    audio.playCueHit(poolState.aimPower);

    setTimeout(() => {
      // Передача импульса битку
      const speed = MAX_SPEED * poolState.aimPower;
      cueBall.vx = Math.cos(poolState.aimAngle) * speed;
      cueBall.vy = Math.sin(poolState.aimAngle) * speed;

      poolState.shotInProgress = true;
      poolState.firstBallHit = null;
      poolState.pottedThisTurn = [];
      poolState.cueBallScratched = false;
      poolState.foulOccurred = false;
      poolState.foulReason = "";
      poolState.strikeAnimation = 0;

      updateHud();
    }, 90);
  }

  /* ===== 12. РАСЧЕТ ЛИНИЙ ПРИЦЕЛИВАНИЯ (GUIDELINES & GHOST BALL) ===== */
  function calculateAimTrajectory() {
    const cueBall = getCueBall();
    if (!cueBall || cueBall.isPotted) return null;

    const cx = cueBall.x;
    const cy = cueBall.y;
    const dirX = Math.cos(poolState.aimAngle);
    const dirY = Math.sin(poolState.aimAngle);

    let closestDist = Infinity;
    let hitBall = null;
    let ghostX = cx;
    let ghostY = cy;

    // 1. Проверяем пересечение с шарами
    for (const b of poolState.balls) {
      if (b.id === 0 || b.isPotted) continue;

      const toBallX = b.x - cx;
      const toBallY = b.y - cy;
      const proj = toBallX * dirX + toBallY * dirY;

      if (proj > 0) {
        const perpDistSq = toBallX * toBallX + toBallY * toBallY - proj * proj;
        const radiusSum = BALL_DIAMETER;
        if (perpDistSq <= radiusSum * radiusSum) {
          const delta = Math.sqrt(radiusSum * radiusSum - perpDistSq);
          const hitDist = proj - delta;
          if (hitDist > 0 && hitDist < closestDist) {
            closestDist = hitDist;
            hitBall = b;
            ghostX = cx + dirX * hitDist;
            ghostY = cy + dirY * hitDist;
          }
        }
      }
    }

    // 2. Проверяем пересечение с бортами (если не попали в шар раньше)
    let wallDist = Infinity;
    let wallHitX = cx;
    let wallHitY = cy;
    let wallBounceDir = { x: dirX, y: dirY };

    if (dirX > 0) {
      const d = (808 - BALL_RADIUS - cx) / dirX;
      if (d > 0 && d < wallDist) {
        wallDist = d;
        wallHitX = 808 - BALL_RADIUS;
        wallHitY = cy + dirY * d;
        wallBounceDir = { x: -dirX, y: dirY };
      }
    } else if (dirX < 0) {
      const d = (32 + BALL_RADIUS - cx) / dirX;
      if (d > 0 && d < wallDist) {
        wallDist = d;
        wallHitX = 32 + BALL_RADIUS;
        wallHitY = cy + dirY * d;
        wallBounceDir = { x: -dirX, y: dirY };
      }
    }

    if (dirY > 0) {
      const d = (388 - BALL_RADIUS - cy) / dirY;
      if (d > 0 && d < wallDist) {
        wallDist = d;
        wallHitX = cx + dirX * d;
        wallHitY = 388 - BALL_RADIUS;
        wallBounceDir = { x: dirX, y: -dirY };
      }
    } else if (dirY < 0) {
      const d = (32 + BALL_RADIUS - cy) / dirY;
      if (d > 0 && d < wallDist) {
        wallDist = d;
        wallHitX = cx + dirX * d;
        wallHitY = 32 + BALL_RADIUS;
        wallBounceDir = { x: dirX, y: -dirY };
      }
    }

    const MAX_GUIDELINE_LENGTH = 280; // Ограничение длины линии прицела (глазомер для дальних ударов)

    if (hitBall && closestDist < wallDist && closestDist <= MAX_GUIDELINE_LENGTH) {
      // Направление отскока прицельного шара (линия центров: от фантомного шара к цели)
      const normalX = (hitBall.x - ghostX) / BALL_DIAMETER;
      const normalY = (hitBall.y - ghostY) / BALL_DIAMETER;

      // Тангенциальное отклонение битка (перпендикулярно линии центров)
      const dot = dirX * normalX + dirY * normalY;
      const tangentX = dirX - dot * normalX;
      const tangentY = dirY - dot * normalY;

      return {
        type: "ball",
        lineEnd: { x: ghostX, y: ghostY },
        ghostBall: { x: ghostX, y: ghostY },
        targetBall: hitBall,
        // Короткий штрих 18px вместо длинной читерской стрелки
        targetLine: {
          x1: hitBall.x,
          y1: hitBall.y,
          x2: hitBall.x + normalX * 18,
          y2: hitBall.y + normalY * 18
        },
        // Короткий штрих 15px отклонения битка
        cueDeflection: {
          x1: ghostX,
          y1: ghostY,
          x2: ghostX + tangentX * 15,
          y2: ghostY + tangentY * 15
        }
      };
    } else if (wallDist < Infinity && wallDist <= closestDist && wallDist <= MAX_GUIDELINE_LENGTH) {
      return {
        type: "cushion",
        lineEnd: { x: wallHitX, y: wallHitY },
        bounceLine: {
          x1: wallHitX,
          y1: wallHitY,
          x2: wallHitX + wallBounceDir.x * 15,
          y2: wallHitY + wallBounceDir.y * 15
        }
      };
    }

    // Если препятствие дальше MAX_GUIDELINE_LENGTH — линия обрывается (требует глазомера)
    return {
      type: "limited",
      lineEnd: {
        x: cx + dirX * MAX_GUIDELINE_LENGTH,
        y: cy + dirY * MAX_GUIDELINE_LENGTH
      }
    };
  }

  /* ===== 13. ОТРИСОВКА СТОЛА И ШАРОВ (CANVAS 2D RENDERING) ===== */
  function renderTable() {
    const canvas = poolDom.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

    // 1. Внешний деревянный борт стола (махагон / орех)
    const woodGrad = ctx.createLinearGradient(0, 0, 0, TABLE_HEIGHT);
    woodGrad.addColorStop(0, "#3e2410");
    woodGrad.addColorStop(0.5, "#2a170a");
    woodGrad.addColorStop(1, "#190e06");
    ctx.fillStyle = woodGrad;
    ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

    // Металлические угловые накладки стола (латунь)
    drawCornerBrackets(ctx);

    // 2. Игровое зеленое сукно (Felt)
    const feltGrad = ctx.createRadialGradient(
      TABLE_WIDTH / 2, TABLE_HEIGHT / 2, 40,
      TABLE_WIDTH / 2, TABLE_HEIGHT / 2, 450
    );
    feltGrad.addColorStop(0, "#13884b"); // Яркий изумруд по центру
    feltGrad.addColorStop(0.8, "#0d6a38");
    feltGrad.addColorStop(1, "#074a26"); // Глубокая тень у бортов

    ctx.fillStyle = feltGrad;
    ctx.fillRect(32, 32, 776, 356);

    // Внутренняя тень от бортов на сукно
    ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
    ctx.fillRect(32, 32, 776, 6); // Верхняя тень
    ctx.fillRect(32, 382, 776, 6); // Нижняя тень
    ctx.fillRect(32, 32, 6, 356); // Левая тень
    ctx.fillRect(802, 32, 6, 356); // Правая тень

    // 3. Разметка стола: Линия «дома» (Head String) и Точка пирамиды (Foot Spot)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(226, 32);
    ctx.lineTo(226, 388);
    ctx.stroke();
    ctx.setLineDash([]);

    // Точка пирамиды
    ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
    ctx.beginPath();
    ctx.arc(590, 210, 3, 0, Math.PI * 2);
    ctx.fill();

    // 4. Метки бортов (бриллианты / ромбики)
    drawDiamondSights(ctx);

    // 5. Лузы (Pockets)
    drawPockets(ctx);

    // 6. Отрисовка траектории прицеливания и фантомного шара (до шаров)
    if (!poolState.shotInProgress && !poolState.ballInHand && !poolState.gameOver) {
      drawAimTrajectory(ctx);
    }

    // 7. Отрисовка шаров (псевдо-3D с тенями и номерами)
    for (const ball of poolState.balls) {
      if (!ball.isPotted || ball.pottedAnim < 1) {
        drawBall(ctx, ball);
      }
    }

    // 8. Подсветка битка в руке (валидная / невалидная зона)
    if (poolState.ballInHand && !poolState.shotInProgress) {
      drawBallInHandIndicator(ctx);
    }

    // 9. Отрисовка кия (Cue Stick)
    if (!poolState.shotInProgress && !poolState.ballInHand && !poolState.gameOver) {
      drawCueStick(ctx);
    }

    // 10. Подсветка заказанной лузы для шара №8
    if (poolState.nominatedPocket !== null) {
      drawNominatedPocketHighlight(ctx, poolState.nominatedPocket);
    }
  }

  function drawCornerBrackets(ctx) {
    const corners = [
      { x: 0, y: 0 },
      { x: TABLE_WIDTH, y: 0 },
      { x: 0, TABLE_HEIGHT },
      { x: TABLE_WIDTH, y: TABLE_HEIGHT }
    ];
    ctx.fillStyle = "rgba(245, 158, 11, 0.25)";
    corners.forEach((c) => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, 42, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawDiamondSights(ctx) {
    ctx.fillStyle = "rgba(255, 255, 255, 0.65)";
    const xSegments = [129, 226, 323, 517, 614, 711];
    const ySegments = [121, 210, 299];

    // Верхние и нижние метки
    for (const x of xSegments) {
      drawDiamond(ctx, x, 16);
      drawDiamond(ctx, x, 404);
    }

    // Левые и правые метки
    for (const y of ySegments) {
      drawDiamond(ctx, 16, y);
      drawDiamond(ctx, 824, y);
    }
  }

  function drawDiamond(ctx, x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPockets(ctx) {
    for (let i = 0; i < POCKETS.length; i++) {
      const p = POCKETS[i];

      // Тень лузы
      ctx.fillStyle = "#020617";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();

      // Внутренняя металлическая дужка
      ctx.strokeStyle = "#475569";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r - 2, 0, Math.PI * 2);
      ctx.stroke();

      // Глубина лузы
      const depthGrad = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r);
      depthGrad.addColorStop(0, "#000000");
      depthGrad.addColorStop(1, "#0f172a");
      ctx.fillStyle = depthGrad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r - 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBall(ctx, b) {
    ctx.save();

    // При падении в лузу шар плавно уменьшается и смещается к центру лузы
    let renderX = b.x;
    let renderY = b.y;
    let renderRadius = BALL_RADIUS;
    let alpha = 1;

    if (b.isPotted && b.pottedPocket !== null) {
      const pocket = POCKETS[b.pottedPocket];
      renderX = b.x + (pocket.x - b.x) * b.pottedAnim;
      renderY = b.y + (pocket.y - b.y) * b.pottedAnim;
      renderRadius = BALL_RADIUS * (1 - b.pottedAnim * 0.7);
      alpha = Math.max(0, 1 - b.pottedAnim);
      ctx.globalAlpha = alpha;
    }

    // 1) Тень на сукне (НЕПОДВИЖНАЯ: смещение dx: +3px, dy: +4px)
    if (!b.isPotted) {
      ctx.fillStyle = "rgba(0, 0, 0, 0.38)";
      ctx.beginPath();
      ctx.ellipse(renderX + 3, renderY + 4, renderRadius * 1.05, renderRadius * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Жестко зафиксированный источник света сверху-слева (-0.35 * R, -0.35 * R)
    const highlightX = renderX - renderRadius * 0.35;
    const highlightY = renderY - renderRadius * 0.35;

    // Вектор ориентации шара (nx, ny, nz)
    const nx = b.nx !== undefined ? b.nx : 0;
    const ny = b.ny !== undefined ? b.ny : 0;
    const nz = b.nz !== undefined ? b.nz : 1;

    // 2) Базовый шар через маску ctx.clip() по радиусу шара
    ctx.save();
    ctx.beginPath();
    ctx.arc(renderX, renderY, renderRadius, 0, Math.PI * 2);
    ctx.clip();

    const isStripe = b.isStripe;
    const isSolid = b.isSolid || b.isEight;
    const isCue = b.id === 0;
    const baseColor = BALL_COLORS[b.id] || "#ffffff";

    if (isCue) {
      // Белый полимер битка
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(renderX - renderRadius, renderY - renderRadius, renderRadius * 2, renderRadius * 2);

      // Вращающаяся точка ориентации на битке (красный маркер вращения)
      if (nz > 0) {
        const dotX = renderX + nx * renderRadius * 0.65;
        const dotY = renderY + ny * renderRadius * 0.65;
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(dotX, dotY, Math.max(0.8, 1.4 * nz), 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (isSolid) {
      // Сплошной шар или черный шар №8
      ctx.fillStyle = baseColor;
      ctx.fillRect(renderX - renderRadius, renderY - renderRadius, renderRadius * 2, renderRadius * 2);

      // 3) Вращающийся кружок с номером (если nz > 0)
      if (nz > 0) {
        drawBallNumber3D(ctx, renderX, renderY, renderRadius, b.id, nx, ny, nz);
      }
    } else if (isStripe) {
      // Полосатый шар (9–15): основа — белый полимер
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(renderX - renderRadius, renderY - renderRadius, renderRadius * 2, renderRadius * 2);

      // 3a) Вращающаяся цветная полоса (эллиптическая проекция экватора сферы)
      const phi = Math.atan2(ny, nx);
      ctx.save();
      ctx.translate(renderX, renderY);
      ctx.rotate(phi);
      ctx.fillStyle = baseColor;

      if (Math.abs(nz) > 0.82) {
        // Полюс обращен к зрителю — полоса кольцом вокруг ободка
        ctx.beginPath();
        ctx.arc(0, 0, renderRadius, 0, Math.PI * 2);
        ctx.arc(0, 0, renderRadius * 0.55, 0, Math.PI * 2, true);
        ctx.fill();
      } else {
        // Полоса как широкий эллиптический пояс через шар
        const minorR = renderRadius * Math.max(0.12, Math.abs(nz));
        ctx.beginPath();
        ctx.ellipse(0, 0, minorR + renderRadius * 0.42, renderRadius * 1.05, 0, 0, Math.PI * 2);
        ctx.fill();
        if (minorR > renderRadius * 0.22) {
          ctx.fillStyle = "#f8fafc";
          ctx.beginPath();
          ctx.ellipse(0, 0, Math.max(1, minorR - renderRadius * 0.22), renderRadius * 0.65, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.restore();

      // 3b) Вращающийся кружок с номером (если nz > 0)
      if (nz > 0) {
        drawBallNumber3D(ctx, renderX, renderY, renderRadius, b.id, nx, ny, nz);
      }
    }

    // 4) Верхний полупрозрачный градиент объема и белый блик света (всегда сверху, НЕПОДВИЖНЫЕ!)
    // 4a. Объемный радиальный градиент сферы
    const sphereShading = ctx.createRadialGradient(
      highlightX, highlightY, renderRadius * 0.08,
      renderX, renderY, renderRadius
    );
    sphereShading.addColorStop(0, "rgba(255, 255, 255, 0.35)");
    sphereShading.addColorStop(0.35, "rgba(255, 255, 255, 0.05)");
    sphereShading.addColorStop(0.7, "rgba(0, 0, 0, 0.12)");
    sphereShading.addColorStop(1, "rgba(0, 0, 0, 0.68)");
    ctx.fillStyle = sphereShading;
    ctx.fillRect(renderX - renderRadius, renderY - renderRadius, renderRadius * 2, renderRadius * 2);

    // 4b. Яркий точечный блик света (глянец полимера)
    const specGrad = ctx.createRadialGradient(
      highlightX, highlightY, 0,
      highlightX, highlightY, renderRadius * 0.32
    );
    specGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
    specGrad.addColorStop(0.3, "rgba(255, 255, 255, 0.45)");
    specGrad.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = specGrad;
    ctx.beginPath();
    ctx.arc(highlightX, highlightY, renderRadius * 0.32, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore(); // Снимаем clip() шара
    ctx.restore(); // Снимаем save() общего контекста
  }

  function drawBallNumber3D(ctx, ballX, ballY, r, num, nx, ny, nz) {
    // Номер и белый кружок в точке (ball.x + nx * ball.radius, ball.y + ny * ball.radius)
    const badgeX = ballX + nx * r * 0.78;
    const badgeY = ballY + ny * r * 0.78;

    // Перспективное сплющивание в эллипс в зависимости от наклона
    const angle = Math.atan2(ny, nx);
    const scaleRadial = Math.max(0.18, nz);
    const badgeR = r * 0.44 * (0.6 + 0.4 * nz);

    ctx.save();
    ctx.translate(badgeX, badgeY);
    ctx.rotate(angle);
    ctx.scale(scaleRadial, 1);

    // Белый кружок с номером
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(0, 0, badgeR, 0, Math.PI * 2);
    ctx.fill();

    // Текст номера
    ctx.fillStyle = "#0f172a";
    ctx.font = `bold ${Math.round(badgeR * 1.25)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(num, 0, 0.5);

    ctx.restore();
  }

  function drawAimTrajectory(ctx) {
    const cueBall = getCueBall();
    if (!cueBall || cueBall.isPotted) return;

    const traj = calculateAimTrajectory();
    if (!traj) return;

    ctx.save();

    // 1. Пунктирная линия прицела от битка (ограничена по длине для тренировки глазомера)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = 1.6;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cueBall.x, cueBall.y);
    ctx.lineTo(traj.lineEnd.x, traj.lineEnd.y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (traj.type === "ball") {
      // 2. Полупрозрачный контур фантомного шара (Ghost Ball)
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(traj.ghostBall.x, traj.ghostBall.y, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Точка соприкосновения
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(traj.ghostBall.x, traj.ghostBall.y, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // 3. Короткий аккуратный штрих (18px) направления прицельного шара (БЕЗ длинной читерской стрелки)
      ctx.strokeStyle = "#facc15";
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(traj.targetLine.x1, traj.targetLine.y1);
      ctx.lineTo(traj.targetLine.x2, traj.targetLine.y2);
      ctx.stroke();

      // 4. Короткий штрих (15px) тангенциального отклонения битка
      ctx.strokeStyle = "rgba(56, 189, 248, 0.7)";
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(traj.cueDeflection.x1, traj.cueDeflection.y1);
      ctx.lineTo(traj.cueDeflection.x2, traj.cueDeflection.y2);
      ctx.stroke();
    } else if (traj.type === "cushion" && traj.bounceLine) {
      // Короткий штрих отскока от борта
      ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(traj.bounceLine.x1, traj.bounceLine.y1);
      ctx.lineTo(traj.bounceLine.x2, traj.bounceLine.y2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }

  function drawArrowHead(ctx, x1, y1, x2, y2, color) {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const arrowLen = 7;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(
      x2 - arrowLen * Math.cos(angle - Math.PI / 6),
      y2 - arrowLen * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
      x2 - arrowLen * Math.cos(angle + Math.PI / 6),
      y2 - arrowLen * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();
  }

  function drawCueStick(ctx) {
    const cueBall = getCueBall();
    if (!cueBall || cueBall.isPotted) return;

    ctx.save();
    ctx.translate(cueBall.x, cueBall.y);
    ctx.rotate(poolState.aimAngle);

    // Оттяжка назад пропорциональна силе удара
    // Если идет анимация удара — кий резко прижимается к битку
    let pullback = 16 + poolState.aimPower * 65;
    if (poolState.strikeAnimation > 0) {
      pullback = 2; // Момент соприкосновения
    }

    const cueLength = 260;
    const startX = -pullback;
    const endX = startX - cueLength;

    // Тень от кия на сукно
    ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
    ctx.beginPath();
    ctx.moveTo(startX, 6);
    ctx.lineTo(endX, 9);
    ctx.lineTo(endX, 15);
    ctx.lineTo(startX, 8);
    ctx.closePath();
    ctx.fill();

    // Тело кия (конусообразное дерево с градиентом)
    const cueGrad = ctx.createLinearGradient(startX, 0, endX, 0);
    cueGrad.addColorStop(0, "#fde68a"); // Светлый клен ближе к наконечнику
    cueGrad.addColorStop(0.35, "#d97706");
    cueGrad.addColorStop(0.7, "#92400e");
    cueGrad.addColorStop(1, "#451a03"); // Темный батт

    ctx.fillStyle = cueGrad;
    ctx.beginPath();
    ctx.moveTo(startX, -2.5);
    ctx.lineTo(endX, -6);
    ctx.lineTo(endX, 6);
    ctx.lineTo(startX, 2.5);
    ctx.closePath();
    ctx.fill();

    // Белая втулка (ferrule)
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(startX - 8, -2.7, 8, 5.4);

    // Кожаный синий наконечник (chalk tip)
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(startX, -2.5, 3, 5);

    ctx.restore();
  }

  function drawBallInHandIndicator(ctx) {
    const pos = poolState.handBallPos;
    const isValid = poolState.handBallValid;

    ctx.save();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = isValid ? "#10b981" : "#ef4444";
    ctx.fillStyle = isValid ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.25)";

    ctx.beginPath();
    ctx.arc(pos.x, pos.y, BALL_RADIUS + 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Значок валидности
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(isValid ? "✓" : "✕", pos.x, pos.y - BALL_RADIUS - 14);

    ctx.restore();
  }

  function drawNominatedPocketHighlight(ctx, pIdx) {
    const p = POCKETS[pIdx];
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#f59e0b";
    ctx.shadowColor = "#f59e0b";
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 5, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "#facc15";
    ctx.font = "bold 15px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🎯", p.x, p.y);

    ctx.restore();
  }

  function darkenColor(hex, factor) {
    const num = parseInt(hex.slice(1), 16);
    let r = (num >> 16) * (1 - factor);
    let g = ((num >> 8) & 0x00ff) * (1 - factor);
    let b = (num & 0x0000ff) * (1 - factor);
    return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
  }

  /* ===== 14. ОБРАБОТКА ПОЛЬЗОВАТЕЛЬСКОГО ВВОДА (TOUCH & MOUSE) ===== */
  function getCanvasLogicalCoords(e) {
    const canvas = poolDom.canvas;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const scaleX = TABLE_WIDTH / rect.width;
    const scaleY = TABLE_HEIGHT / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  function onPointerDown(e) {
    if (poolState.shotInProgress || poolState.gameOver) return;
    if (e.cancelable && e.type.startsWith("touch")) {
      e.preventDefault();
    }
    audio.init();

    const pt = getCanvasLogicalCoords(e);
    const cueBall = getCueBall();

    // 1. Если биток в руке
    if (poolState.ballInHand && cueBall) {
      poolState.isDraggingHandBall = true;
      updateHandBallTarget(pt.x, pt.y);
      return;
    }

    // 2. Если требуется заказ лузы для шара №8 и кликнули рядом с лузой
    const activePlayer = getActivePlayer();
    const needsEight = !poolState.isTableOpen && activePlayer.group && isGroupPotted(activePlayer.group);
    if (needsEight) {
      for (let i = 0; i < POCKETS.length; i++) {
        const p = POCKETS[i];
        if (Math.hypot(pt.x - p.x, pt.y - p.y) < 55) {
          poolState.nominatedPocket = i;
          audio.playNominate();
          updateHud();
          return;
        }
      }
    }

    // 3. Обычное наведение прицела
    if (cueBall && !cueBall.isPotted) {
      poolState.isAiming = true;
      updateAimAngleFromPoint(pt.x, pt.y);
    }
  }

  function onPointerMove(e) {
    if (poolState.shotInProgress || poolState.gameOver) return;
    if (e.cancelable && e.type.startsWith("touch")) {
      e.preventDefault();
    }

    const pt = getCanvasLogicalCoords(e);

    if (poolState.ballInHand && poolState.isDraggingHandBall) {
      updateHandBallTarget(pt.x, pt.y);
      return;
    }

    if (poolState.isAiming) {
      updateAimAngleFromPoint(pt.x, pt.y);
    }
  }

  function onPointerUp() {
    poolState.isAiming = false;
    poolState.isDraggingHandBall = false;
  }

  function updateHandBallTarget(x, y) {
    const cueBall = getCueBall();
    if (!cueBall) return;

    poolState.handBallPos = { x, y };
    poolState.handBallValid = validateCueBallPosition(x, y);

    if (poolState.handBallValid) {
      cueBall.x = x;
      cueBall.y = y;
    }
  }

  function updateAimAngleFromPoint(targetX, targetY) {
    const cueBall = getCueBall();
    if (!cueBall) return;
    poolState.aimAngle = Math.atan2(targetY - cueBall.y, targetX - cueBall.x);
  }

  /* ===== 15. ЗАВЕРШЕНИЕ ИГРЫ И МОДАЛЬНЫЕ ОКНА ===== */
  function endGameWithWinner(winner, reason) {
    poolState.gameOver = true;
    poolState.shotInProgress = false;

    audio.playWin();

    if (poolDom.winnerTitle) poolDom.winnerTitle.textContent = "Победа! 🎱";
    if (poolDom.winnerPlayerName) poolDom.winnerPlayerName.textContent = winner.name;
    if (poolDom.winnerReasonText) poolDom.winnerReasonText.textContent = reason;
    if (poolDom.winnerModal) poolDom.winnerModal.classList.remove("hidden");

    setGameStatus(`Победа: ${winner.name}! ${reason}`, "normal");
  }

  /* ===== 16. ЦИКЛ АНИМАЦИИ (MAIN GAME LOOP) ===== */
  function gameLoop() {
    updatePhysics();
    renderTable();
    requestAnimationFrame(gameLoop);
  }

  /* ===== 17. ПРИВЯЗКА СОБЫТИЙ ===== */
  function bindPoolEvents() {
    // Старт из лобби
    if (poolDom.startBtn) {
      poolDom.startBtn.addEventListener("click", () => {
        setupNewGame();
        if (window.showScreen) {
          window.showScreen("poolGame");
        }
      });
    }

    // Возврат в меню из игры
    if (poolDom.gameBackBtn) {
      poolDom.gameBackBtn.addEventListener("click", () => {
        if (poolState.gameOver || confirm("Выйти в главное меню? Текущая партия в бильярд будет завершена.")) {
          if (window.showScreen) window.showScreen("menu");
        }
      });
    }

    // Перезапуск партии (с теми же именами)
    if (poolDom.resetBtn) {
      poolDom.resetBtn.addEventListener("click", () => {
        if (confirm("Перезапустить партию с теми же игроками?")) {
          setupNewGame(true);
        }
      });
    }

    // Переключатель звука
    if (poolDom.soundBtn) {
      poolDom.soundBtn.addEventListener("click", () => {
        audio.enabled = !audio.enabled;
        poolDom.soundBtn.textContent = audio.enabled ? "🔊" : "🔇";
        if (window.showToast) {
          window.showToast(audio.enabled ? "Звук включен" : "Звук выключен", 1500);
        }
      });
    }

    // Тонкая доводка прицела
    if (poolDom.aimLeft) {
      poolDom.aimLeft.addEventListener("click", () => {
        poolState.aimAngle -= 0.008; // ~0.45 градуса
      });
    }
    if (poolDom.aimRight) {
      poolDom.aimRight.addEventListener("click", () => {
        poolState.aimAngle += 0.008;
      });
    }

    // Ползунок силы удара
    if (poolDom.powerSlider) {
      poolDom.powerSlider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value, 10);
        poolState.aimPower = val / 100;
        if (poolDom.powerValue) poolDom.powerValue.textContent = val + "%";
      });
    }

    // Кнопка удара
    if (poolDom.strikeBtn) {
      poolDom.strikeBtn.addEventListener("click", executeShot);
    }

    // Кнопка размещения шара в руке
    if (poolDom.placeBallBtn) {
      poolDom.placeBallBtn.addEventListener("click", confirmBallInHandPlacement);
    }

    // Модальное окно победы: Сыграть ещё раз
    if (poolDom.winnerReplayBtn) {
      poolDom.winnerReplayBtn.addEventListener("click", () => {
        setupNewGame(true);
      });
    }

    // Модальное окно победы: В главное меню
    if (poolDom.winnerMenuBtn) {
      poolDom.winnerMenuBtn.addEventListener("click", () => {
        if (poolDom.winnerModal) poolDom.winnerModal.classList.add("hidden");
        if (window.showScreen) window.showScreen("menu");
      });
    }

    // Сенсорное и мышиное управление на холсте
    const canvas = poolDom.canvas;
    if (canvas) {
      canvas.addEventListener("mousedown", onPointerDown);
      window.addEventListener("mousemove", onPointerMove);
      window.addEventListener("mouseup", onPointerUp);

      canvas.addEventListener("touchstart", onPointerDown, { passive: false });
      window.addEventListener("touchmove", onPointerMove, { passive: false });
      window.addEventListener("touchend", onPointerUp, { passive: false });
    }
  }

  /* ===== 18. СТАРТ МОДУЛЯ ===== */
  function initPool() {
    cachePoolDom();
    bindPoolEvents();
    requestAnimationFrame(gameLoop);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPool);
  } else {
    initPool();
  }
})();
