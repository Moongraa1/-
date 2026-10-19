/* =========================================================
   ВЕЧЕРИНКА ИГР — АЭРОХОККЕЙ (AIR HOCKEY 1v1) ДЛЯ ДВОИХ
   Полноценный 2D-движок на HTML5 Canvas с независимым мультитачем,
   быстрой и упругой физикой, скругленными углами без застреваний,
   неоновым стилем (Dark Arcade), синтезированными звуками Web Audio API,
   поддержкой мыши и WASD/стрелок для ПК и тренировочным AI-ботом.
   ========================================================= */

"use strict";

(function () {
  /* ===== 1. КОНСТАНТЫ СТОЛА И ГЕОМЕТРИИ ===== */
  const TABLE_WIDTH = 450;
  const TABLE_HEIGHT = 850;
  const WALL_THICKNESS = 18;
  const CENTER_Y = TABLE_HEIGHT / 2; // 425

  const PLAY_MIN_X = WALL_THICKNESS; // 18
  const PLAY_MAX_X = TABLE_WIDTH - WALL_THICKNESS; // 432
  const PLAY_MIN_Y = WALL_THICKNESS; // 18
  const PLAY_MAX_Y = TABLE_HEIGHT - WALL_THICKNESS; // 832

  // Радиус скругления 4-х углов стола (предотвращает застревание в углах)
  const CORNER_RADIUS = 50;
  const CORNER_TOP_LEFT = { x: PLAY_MIN_X + CORNER_RADIUS, y: PLAY_MIN_Y + CORNER_RADIUS }; // (68, 68)
  const CORNER_TOP_RIGHT = { x: PLAY_MAX_X - CORNER_RADIUS, y: PLAY_MIN_Y + CORNER_RADIUS }; // (382, 68)
  const CORNER_BOT_LEFT = { x: PLAY_MIN_X + CORNER_RADIUS, y: PLAY_MAX_Y - CORNER_RADIUS }; // (68, 782)
  const CORNER_BOT_RIGHT = { x: PLAY_MAX_X - CORNER_RADIUS, y: PLAY_MAX_Y - CORNER_RADIUS }; // (382, 782)

  const GOAL_WIDTH = 154;
  const GOAL_X1 = (TABLE_WIDTH - GOAL_WIDTH) / 2; // 148
  const GOAL_X2 = GOAL_X1 + GOAL_WIDTH; // 302
  const GOAL_POST_RADIUS = 8;

  const PUCK_RADIUS = 16.5;
  const PADDLE_RADIUS = 31;
  const PUCK_FRICTION = 0.992;
  const PUCK_MAX_SPEED = 24;
  const WIN_SCORE = 7;
  const KEY_MOVE_SPEED = 14;

  /* ===== 2. ЗВУКОВОЙ СИНТЕЗАТОР (WEB AUDIO API) ===== */
  class AirHockeyAudio {
    constructor() {
      this.ctx = null;
      this.enabled = true;
      this.lastWallHitTime = 0;
      this.lastPaddleHitTime = 0;
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

    playPaddleHit(speed = 10) {
      if (!this.enabled || speed < 0.8) return;
      const nowMs = performance.now();
      if (nowMs - this.lastPaddleHitTime < 50) return; // Дросселирование от дребезга
      this.lastPaddleHitTime = nowMs;

      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        const baseFreq = 520 + Math.min(480, speed * 18);
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(160, now + 0.045);

        const vol = Math.min(0.75, Math.max(0.15, speed / 22));
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.055);
      } catch (e) {}
    }

    playWallHit(speed = 8) {
      if (!this.enabled || speed < 0.8) return;
      const nowMs = performance.now();
      if (nowMs - this.lastWallHitTime < 50) return; // Дросселирование от дребезга в углах
      this.lastWallHitTime = nowMs;

      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(360, now);
        osc.frequency.exponentialRampToValueAtTime(170, now + 0.035);

        const vol = Math.min(0.5, Math.max(0.1, speed / 24));
        gain.gain.setValueAtTime(vol, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now);
        osc.stop(now + 0.045);
      } catch (e) {}
    }

    playGoalSound() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const notes = [440, 554.37, 659.25, 880];
        notes.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(freq, now + idx * 0.06);

          gain.gain.setValueAtTime(0.28, now + idx * 0.06);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.28);

          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + idx * 0.06);
          osc.stop(now + idx * 0.06 + 0.3);
        });
      } catch (e) {}
    }

    playWinSound() {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;
      try {
        const now = this.ctx.currentTime;
        const melody = [523.25, 659.25, 783.99, 1046.5];
        melody.forEach((freq, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);

          gain.gain.setValueAtTime(0.38, now + idx * 0.12);
          gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.4);

          osc.connect(gain);
          gain.connect(this.ctx.destination);
          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.42);
        });
      } catch (e) {}
    }
  }

  const audio = new AirHockeyAudio();

  /* ===== 3. СОСТОЯНИЕ ИГРЫ ===== */
  const game = {
    active: false,
    score1: 0, // Синий игрок (снизу)
    score2: 0, // Красный игрок (сверху)
    isPaused: false,
    gameOver: false,
    animFrameId: null,
    botEnabled: false, // Режим бота для игрока 2 (удобно для ПК и тестов)
    stillPuckFrames: 0, // Счетчик для Anti-Stuck сторожа

    // Шайба
    puck: {
      x: 225,
      y: 425,
      vx: 0,
      vy: 0,
      radius: PUCK_RADIUS,
      trail: []
    },

    // Бита 1 (Синий, нижняя половина)
    p1: {
      x: 225,
      y: 690,
      prevX: 225,
      prevY: 690,
      targetX: 225,
      targetY: 690,
      vx: 0,
      vy: 0,
      radius: PADDLE_RADIUS,
      touchId: null
    },

    // Бита 2 (Красный, верхняя половина)
    p2: {
      x: 225,
      y: 160,
      prevX: 225,
      prevY: 160,
      targetX: 225,
      targetY: 160,
      vx: 0,
      vy: 0,
      radius: PADDLE_RADIUS,
      touchId: null
    },

    // Управление мышью на ПК
    isMouseDown: false,
    mousePlayer: null, // 1 (снизу) или 2 (сверху)

    // Клавиатура на ПК
    keys: {},

    dom: {}
  };

  /* ===== 4. ОГРАНИЧЕНИЕ ПЕРЕМЕЩЕНИЯ БИТ ===== */
  function clampP1X(x) {
    return Math.max(PLAY_MIN_X + PADDLE_RADIUS, Math.min(PLAY_MAX_X - PADDLE_RADIUS, x));
  }
  function clampP1Y(y) {
    return Math.max(CENTER_Y + PADDLE_RADIUS, Math.min(PLAY_MAX_Y - PADDLE_RADIUS, y));
  }

  function clampP2X(x) {
    return Math.max(PLAY_MIN_X + PADDLE_RADIUS, Math.min(PLAY_MAX_X - PADDLE_RADIUS, x));
  }
  function clampP2Y(y) {
    return Math.max(PLAY_MIN_Y + PADDLE_RADIUS, Math.min(CENTER_Y - PADDLE_RADIUS, y));
  }

  /* ===== 5. КООРДИНАТЫ КАСАНИЙ / МЫШИ ===== */
  function getCanvasLogicalCoords(clientX, clientY) {
    const canvas = game.dom.canvas;
    if (!canvas) return { x: 225, y: 425 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = TABLE_WIDTH / rect.width;
    const scaleY = TABLE_HEIGHT / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  }

  /* ===== 6. СИНХРОНИЗАЦИЯ И МУЛЬТИТАЧ ОБРАБОТЧИКИ ===== */
  // Гарантирует, что оторванные от экрана пальцы мгновенно освобождают биты
  function syncActiveTouches(e) {
    if (!e.touches || e.touches.length === 0) {
      game.p1.touchId = null;
      game.p2.touchId = null;
      return;
    }
    let p1Found = false;
    let p2Found = false;
    for (let i = 0; i < e.touches.length; i++) {
      const id = e.touches[i].identifier;
      if (id === game.p1.touchId) p1Found = true;
      if (id === game.p2.touchId) p2Found = true;
    }
    if (!p1Found) game.p1.touchId = null;
    if (!p2Found) game.p2.touchId = null;
  }

  function onTouchStart(e) {
    if (e.cancelable) e.preventDefault();
    audio.init();

    for (let i = 0; i < e.changedTouches.length; i++) {
      const touch = e.changedTouches[i];
      const pt = getCanvasLogicalCoords(touch.clientX, touch.clientY);

      // Нижняя половина поля -> Игрок 1 (Синий)
      if (pt.y > CENTER_Y) {
        game.p1.touchId = touch.identifier;
        game.p1.targetX = clampP1X(pt.x);
        game.p1.targetY = clampP1Y(pt.y);
      }
      // Верхняя половина поля -> Игрок 2 (Красный)
      else {
        // Если был включен бот, прикосновение живого игрока автоматически отключает бота
        if (game.botEnabled) toggleBot(false);
        game.p2.touchId = touch.identifier;
        game.p2.targetX = clampP2X(pt.x);
        game.p2.targetY = clampP2Y(pt.y);
      }
    }
  }

  function onTouchMove(e) {
    if (e.cancelable) e.preventDefault();
    syncActiveTouches(e);

    for (let i = 0; i < e.touches.length; i++) {
      const touch = e.touches[i];
      const pt = getCanvasLogicalCoords(touch.clientX, touch.clientY);

      if (touch.identifier === game.p1.touchId) {
        game.p1.targetX = clampP1X(pt.x);
        game.p1.targetY = clampP1Y(pt.y);
      } else if (touch.identifier === game.p2.touchId) {
        game.p2.targetX = clampP2X(pt.x);
        game.p2.targetY = clampP2Y(pt.y);
      }
    }
  }

  function onTouchEnd(e) {
    if (e.cancelable) e.preventDefault();
    syncActiveTouches(e);
  }

  /* ===== 7. УПРАВЛЕНИЕ МЫШЬЮ И КЛАВИАТУРОЙ (ДЛЯ ПК / НОУТБУКОВ) ===== */
  function onMouseDown(e) {
    audio.init();
    game.isMouseDown = true;
    const pt = getCanvasLogicalCoords(e.clientX, e.clientY);

    if (pt.y > CENTER_Y) {
      // Клик в нижней половине -> Управляем Синим игроком
      game.mousePlayer = 1;
      game.p1.targetX = clampP1X(pt.x);
      game.p1.targetY = clampP1Y(pt.y);
    } else {
      // Клик в верхней половине -> Управляем Красным игроком!
      game.mousePlayer = 2;
      if (game.botEnabled) toggleBot(false);
      game.p2.targetX = clampP2X(pt.x);
      game.p2.targetY = clampP2Y(pt.y);
    }
  }

  function onMouseMove(e) {
    if (!game.isMouseDown || !game.mousePlayer) return;
    const pt = getCanvasLogicalCoords(e.clientX, e.clientY);

    if (game.mousePlayer === 1) {
      game.p1.targetX = clampP1X(pt.x);
      game.p1.targetY = clampP1Y(pt.y);
    } else if (game.mousePlayer === 2) {
      game.p2.targetX = clampP2X(pt.x);
      game.p2.targetY = clampP2Y(pt.y);
    }
  }

  function onMouseUp() {
    game.isMouseDown = false;
    game.mousePlayer = null;
  }

  function onKeyDown(e) {
    game.keys[e.code] = true;

    // Клавиша "B" для быстрого переключения бота на ПК
    if (e.code === "KeyB") {
      toggleBot();
    }
  }

  function onKeyUp(e) {
    game.keys[e.code] = false;
  }

  function handleKeyboardControls() {
    // 1. Игрок 2 (Красный, сверху) — WASD
    if (!game.botEnabled) {
      let p2Dx = 0;
      let p2Dy = 0;
      if (game.keys["KeyW"] || game.keys["KeyЦ"]) p2Dy -= 1;
      if (game.keys["KeyS"] || game.keys["KeyЫ"]) p2Dy += 1;
      if (game.keys["KeyA"] || game.keys["KeyФ"]) p2Dx -= 1;
      if (game.keys["KeyD"] || game.keys["KeyВ"]) p2Dx += 1;

      if (p2Dx !== 0 || p2Dy !== 0) {
        const len = Math.hypot(p2Dx, p2Dy);
        game.p2.targetX = clampP2X(game.p2.x + (p2Dx / len) * KEY_MOVE_SPEED);
        game.p2.targetY = clampP2Y(game.p2.y + (p2Dy / len) * KEY_MOVE_SPEED);
      }
    }

    // 2. Игрок 1 (Синий, снизу) — Стрелки
    let p1Dx = 0;
    let p1Dy = 0;
    if (game.keys["ArrowUp"]) p1Dy -= 1;
    if (game.keys["ArrowDown"]) p1Dy += 1;
    if (game.keys["ArrowLeft"]) p1Dx -= 1;
    if (game.keys["ArrowRight"]) p1Dx += 1;

    if (p1Dx !== 0 || p1Dy !== 0) {
      const len = Math.hypot(p1Dx, p1Dy);
      game.p1.targetX = clampP1X(game.p1.x + (p1Dx / len) * KEY_MOVE_SPEED);
      game.p1.targetY = clampP1Y(game.p1.y + (p1Dy / len) * KEY_MOVE_SPEED);
    }
  }

  /* ===== 8. ИСКУССТВЕННЫЙ ИНТЕЛЛЕКТ (AI БОТ ДЛЯ ИГРОКА 2) ===== */
  function toggleBot(forceState) {
    if (typeof forceState === "boolean") {
      game.botEnabled = forceState;
    } else {
      game.botEnabled = !game.botEnabled;
    }

    if (game.dom.botBtn) {
      if (game.botEnabled) {
        game.dom.botBtn.classList.add("airhockey-btn-side--active");
        game.dom.botBtn.title = "Бот активен [Кликните или нажмите B для отключения]";
      } else {
        game.dom.botBtn.classList.remove("airhockey-btn-side--active");
        game.dom.botBtn.title = "Бот для Красного игрока 2 (ПК/тест): Вкл/Выкл [Клавиша B]";
      }
    }

    if (window.showToast) {
      window.showToast(game.botEnabled ? "🤖 Бот включен (Игрок 2)" : "👤 Ручное управление (Игрок 2)", 1400);
    }
  }

  function updateBotAI() {
    if (!game.botEnabled || game.isPaused || game.gameOver) return;

    const p2 = game.p2;
    const puck = game.puck;

    let targetX = 225;
    let targetY = 150;

    // Шайба на стороне Красного игрока — атака / выбивание
    if (puck.y < CENTER_Y - 10) {
      targetX = clampP2X(puck.x);
      // Бита заходит чуть выше шайбы, чтобы выбить её вниз
      targetY = clampP2Y(Math.min(CENTER_Y - 45, puck.y - 20));
    }
    // Шайба на стороне соперника — защита ворот
    else {
      // Зеркально отслеживаем позицию шайбы для закрытия створа
      targetX = clampP2X(225 + (puck.x - 225) * 0.5);
      targetY = 140;
    }

    // Плавное физическое перемещение бота с естественной скоростью
    const dx = targetX - p2.x;
    const dy = targetY - p2.y;
    const dist = Math.hypot(dx, dy);

    if (dist > 1) {
      const step = Math.min(dist, 10.5);
      p2.targetX = p2.x + (dx / dist) * step;
      p2.targetY = p2.y + (dy / dist) * step;
    }
  }

  /* ===== 9. ОБНОВЛЕНИЕ БИТ И ИХ СКОРОСТИ ===== */
  function updatePaddles() {
    handleKeyboardControls();
    updateBotAI();

    // Обновление биты 1 (Синий)
    const p1 = game.p1;
    p1.vx = p1.targetX - p1.x;
    p1.vy = p1.targetY - p1.y;
    p1.x = p1.targetX;
    p1.y = p1.targetY;

    // Обновление биты 2 (Красный)
    const p2 = game.p2;
    p2.vx = p2.targetX - p2.x;
    p2.vy = p2.targetY - p2.y;
    p2.x = p2.targetX;
    p2.y = p2.targetY;
  }

  /* ===== 10. ФИЗИКА, СТОЛКНОВЕНИЯ И ANTI-STUCK СТОРОЖ ===== */
  function updatePhysics() {
    if (game.isPaused || game.gameOver) return;

    const puck = game.puck;

    // Запись шлейфа скорости
    puck.trail.push({ x: puck.x, y: puck.y });
    if (puck.trail.length > 7) puck.trail.shift();

    // 4 суб-шага физики за кадр (Anti-tunneling)
    const steps = 4;
    const stepVx = puck.vx / steps;
    const stepVy = puck.vy / steps;

    for (let s = 0; s < steps; s++) {
      puck.x += stepVx;
      puck.y += stepVy;

      // 1. Коллизии с битами игроков
      collidePaddlePuck(game.p1, puck);
      collidePaddlePuck(game.p2, puck);

      // 2. Коллизии с 4 круглыми штангами ворот
      collideGoalPosts(puck);

      // 3. Коллизии с закругленными углами стола (выталкивание из углов)
      collideRoundedCorners(puck);

      // 4. Коллизии с прямыми бортами стола и воротами
      checkStraightWallsAndGoals(puck);

      if (game.isPaused) break;
    }

    // Трение об лед
    puck.vx *= PUCK_FRICTION;
    puck.vy *= PUCK_FRICTION;

    // Отсечка сверхнизкой скорости
    if (Math.hypot(puck.vx, puck.vy) < 0.05) {
      puck.vx = 0;
      puck.vy = 0;
    }

    // Ограничение максимальной скорости
    const currentSpeed = Math.hypot(puck.vx, puck.vy);
    if (currentSpeed > PUCK_MAX_SPEED) {
      const ratio = PUCK_MAX_SPEED / currentSpeed;
      puck.vx *= ratio;
      puck.vy *= ratio;
    }

    // Anti-Stuck Сторож: если шайба остановилась в мертвой зоне
    checkAntiStuckWatchdog(puck);
  }

  /* Anti-Stuck: гарантирует, что шайба ни при каких обстоятельствах не замрёт на столе */
  function checkAntiStuckWatchdog(puck) {
    const spd = Math.hypot(puck.vx, puck.vy);
    if (spd < 0.25) {
      game.stillPuckFrames++;
      if (game.stillPuckFrames > 35) { // ~0.55 секунды без движения
        game.stillPuckFrames = 0;
        // Мягкий неоновый импульс в открытое поле
        const dirX = puck.x < 225 ? 3.5 : -3.5;
        const dirY = puck.y < CENTER_Y ? 4.0 : -4.0;
        puck.vx = dirX + (Math.random() - 0.5) * 1.5;
        puck.vy = dirY;
      }
    } else {
      game.stillPuckFrames = 0;
    }
  }

  /* Столкновение биты и шайбы с упругим отскоком и скольжением */
  function collidePaddlePuck(paddle, puck) {
    const dx = puck.x - paddle.x;
    const dy = puck.y - paddle.y;
    const dist = Math.hypot(dx, dy);
    const minDist = puck.radius + paddle.radius; // 47.5

    if (dist < minDist) {
      const nx = dist > 0.001 ? dx / dist : 0;
      const ny = dist > 0.001 ? dy / dist : (paddle.y < CENTER_Y ? 1 : -1);

      // 1. Геометрическое выталкивание шайбы наружу
      puck.x = paddle.x + nx * (minDist + 0.8);
      puck.y = paddle.y + ny * (minDist + 0.8);

      // 2. Относительная скорость вдоль нормали
      const rvx = puck.vx - paddle.vx;
      const rvy = puck.vy - paddle.vy;
      const velAlongNormal = rvx * nx + rvy * ny;

      if (velAlongNormal < 0) {
        const restitution = 1.05;
        const impulse = -(1 + restitution) * velAlongNormal;

        // Передача кинетической энергии от удара биты
        puck.vx += nx * impulse + paddle.vx * 0.45;
        puck.vy += ny * impulse + paddle.vy * 0.45;
      }

      // Гарантированный минимальный отрыв при любом касании
      const speed = Math.hypot(puck.vx, puck.vy);
      if (speed < 5.5) {
        puck.vx += nx * 6.0;
        puck.vy += ny * 6.0;
      }

      // Защита от зажима у борта: шайба вылетает по касательной вдоль борта
      if (Math.abs(nx) > 0.92) {
        puck.vy += (puck.y >= paddle.y ? 3.2 : -3.2);
      } else if (Math.abs(ny) > 0.92) {
        puck.vx += (puck.x >= paddle.x ? 3.2 : -3.2);
      }

      audio.playPaddleHit(Math.hypot(puck.vx, puck.vy));
      if (navigator.vibrate) navigator.vibrate(20);
    }
  }

  /* Физика 4-х закругленных углов стола: шайба никогда не застрянет в углах */
  function collideRoundedCorners(puck) {
    const corners = [
      { center: CORNER_TOP_LEFT, check: () => puck.x < CORNER_TOP_LEFT.x && puck.y < CORNER_TOP_LEFT.y },
      { center: CORNER_TOP_RIGHT, check: () => puck.x > CORNER_TOP_RIGHT.x && puck.y < CORNER_TOP_RIGHT.y },
      { center: CORNER_BOT_LEFT, check: () => puck.x < CORNER_BOT_LEFT.x && puck.y > CORNER_BOT_LEFT.y },
      { center: CORNER_BOT_RIGHT, check: () => puck.x > CORNER_BOT_RIGHT.x && puck.y > CORNER_BOT_RIGHT.y }
    ];

    const maxDist = CORNER_RADIUS - puck.radius; // 50 - 16.5 = 33.5

    for (const c of corners) {
      if (c.check()) {
        const dx = puck.x - c.center.x;
        const dy = puck.y - c.center.y;
        const dist = Math.hypot(dx, dy);

        if (dist > maxDist && dist > 0.001) {
          const ux = dx / dist;
          const uy = dy / dist;

          // 1. Геометрическое возвращение внутрь дуги
          puck.x = c.center.x + ux * maxDist;
          puck.y = c.center.y + uy * maxDist;

          // Нормаль, направленная ВНУТРЬ поля
          const nx = -ux;
          const ny = -uy;

          // 2. Отражение скорости по нормали
          const vn = puck.vx * nx + puck.vy * ny;
          if (vn < 0) {
            const restitution = 0.95;
            puck.vx -= (1 + restitution) * vn * nx;
            puck.vy -= (1 + restitution) * vn * ny;
            audio.playWallHit(Math.abs(vn));
          }

          // Дополнительный импульс отрыва к центру стола
          if (Math.hypot(puck.vx, puck.vy) < 3.0) {
            puck.vx += nx * 3.5;
            puck.vy += ny * 3.5;
          }
        }
      }
    }
  }

  /* Столкновение с 4-мя круглыми штангами ворот */
  function collideGoalPosts(puck) {
    const posts = [
      { x: GOAL_X1, y: PLAY_MIN_Y },
      { x: GOAL_X2, y: PLAY_MIN_Y },
      { x: GOAL_X1, y: PLAY_MAX_Y },
      { x: GOAL_X2, y: PLAY_MAX_Y }
    ];

    const minDist = puck.radius + GOAL_POST_RADIUS;

    for (const post of posts) {
      const dx = puck.x - post.x;
      const dy = puck.y - post.y;
      const dist = Math.hypot(dx, dy);

      if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const ny = dy / dist;

        puck.x = post.x + nx * (minDist + 0.6);
        puck.y = post.y + ny * (minDist + 0.6);

        const vn = puck.vx * nx + puck.vy * ny;
        if (vn < 0) {
          puck.vx -= 1.85 * vn * nx;
          puck.vy -= 1.85 * vn * ny;
          audio.playWallHit(Math.hypot(puck.vx, puck.vy));
        }
      }
    }
  }

  /* Прямые борта и проверка взятия ворот */
  function checkStraightWallsAndGoals(puck) {
    const leftLimit = PLAY_MIN_X + puck.radius;
    const rightLimit = PLAY_MAX_X - puck.radius;
    const topLimit = PLAY_MIN_Y + puck.radius;
    const bottomLimit = PLAY_MAX_Y - puck.radius;

    // 1. Левый прямой борт (между верхним и нижним скруглением)
    if (puck.x < leftLimit && puck.y >= CORNER_TOP_LEFT.y && puck.y <= CORNER_BOT_LEFT.y) {
      puck.x = leftLimit;
      if (puck.vx < 0) {
        puck.vx = -puck.vx * 0.95;
        audio.playWallHit(Math.abs(puck.vx));
      }
    }
    // 2. Правый прямой борт
    else if (puck.x > rightLimit && puck.y >= CORNER_TOP_RIGHT.y && puck.y <= CORNER_BOT_RIGHT.y) {
      puck.x = rightLimit;
      if (puck.vx > 0) {
        puck.vx = -puck.vx * 0.95;
        audio.playWallHit(Math.abs(puck.vx));
      }
    }

    // 3. Верхний борт и верхние ворота (Игрок 2)
    if (puck.y < topLimit) {
      // Вне створа ворот — отскок от стены
      if (puck.x <= GOAL_X1 || puck.x >= GOAL_X2) {
        if (puck.x >= CORNER_TOP_LEFT.x && puck.x <= CORNER_TOP_RIGHT.x) {
          puck.y = topLimit;
          if (puck.vy < 0) {
            puck.vy = -puck.vy * 0.95;
            audio.playWallHit(Math.abs(puck.vy));
          }
        }
      } else {
        // В створе верхних ворот: проверка пересечения линии ворот
        if (puck.y <= PLAY_MIN_Y - 2) {
          handleGoal(1); // Гол забил Синий игрок (снизу)
        }
      }
    }

    // 4. Нижний борт и нижние ворота (Игрок 1)
    if (puck.y > bottomLimit) {
      // Вне створа ворот — отскок от стены
      if (puck.x <= GOAL_X1 || puck.x >= GOAL_X2) {
        if (puck.x >= CORNER_BOT_LEFT.x && puck.x <= CORNER_BOT_RIGHT.x) {
          puck.y = bottomLimit;
          if (puck.vy > 0) {
            puck.vy = -puck.vy * 0.95;
            audio.playWallHit(Math.abs(puck.vy));
          }
        }
      } else {
        // В створе нижних ворот: проверка пересечения линии ворот
        if (puck.y >= PLAY_MAX_Y + 2) {
          handleGoal(2); // Гол забил Красный игрок (сверху)
        }
      }
    }
  }

  /* ===== 11. ГОЛЫ И ОКОНЧАНИЕ МАТЧА ===== */
  function handleGoal(scorer) {
    if (game.isPaused || game.gameOver) return;
    game.isPaused = true;

    if (scorer === 1) {
      game.score1++;
    } else {
      game.score2++;
    }

    audio.playGoalSound();
    if (navigator.vibrate) navigator.vibrate(100);

    // Вспышка баннера ГОЛ
    if (game.dom.goalBanner) {
      game.dom.goalBanner.classList.remove("hidden");
    }

    // Проверка победы (до 7 очков)
    if (game.score1 >= WIN_SCORE || game.score2 >= WIN_SCORE) {
      setTimeout(() => {
        if (game.dom.goalBanner) game.dom.goalBanner.classList.add("hidden");
        endGame(game.score1 >= WIN_SCORE ? 1 : 2);
      }, 700);
      return;
    }

    // Пауза 1 сек перед следующим вбросом
    setTimeout(() => {
      if (game.dom.goalBanner) game.dom.goalBanner.classList.add("hidden");

      // Сброс шайбы в центр со слабым смещением к пропустившему игроку
      game.puck.x = 225;
      game.puck.y = 425;
      game.puck.trail = [];
      game.puck.vx = (Math.random() - 0.5) * 2;
      game.puck.vy = scorer === 1 ? -2.5 : 2.5;

      resetPaddlePositions();
      game.isPaused = false;
    }, 1000);
  }

  function resetPaddlePositions() {
    game.p1.targetX = 225;
    game.p1.targetY = 690;
    game.p1.x = 225;
    game.p1.y = 690;
    game.p1.vx = 0;
    game.p1.vy = 0;

    game.p2.targetX = 225;
    game.p2.targetY = 160;
    game.p2.x = 225;
    game.p2.y = 160;
    game.p2.vx = 0;
    game.p2.vy = 0;
  }

  function endGame(winner) {
    game.gameOver = true;
    game.isPaused = true;
    audio.playWinSound();

    const winnerName = winner === 1 ? "Синий игрок (снизу)" : "Красный игрок (сверху)";
    const winnerColorClass = winner === 1 ? "airhockey-winner--blue" : "airhockey-winner--red";

    if (game.dom.winnerPlayerName) {
      game.dom.winnerPlayerName.textContent = winnerName;
      game.dom.winnerPlayerName.className = "airhockey-winner-player " + winnerColorClass;
    }
    if (game.dom.winnerScoreText) {
      game.dom.winnerScoreText.textContent = `Итоговый счёт: ${game.score1} : ${game.score2}`;
    }
    if (game.dom.winnerModal) {
      game.dom.winnerModal.classList.remove("hidden");
    }
  }

  function resetMatch() {
    game.score1 = 0;
    game.score2 = 0;
    game.gameOver = false;
    game.isPaused = false;
    game.stillPuckFrames = 0;
    game.puck.x = 225;
    game.puck.y = 425;
    game.puck.vx = 0;
    game.puck.vy = 0;
    game.puck.trail = [];
    resetPaddlePositions();

    if (game.dom.winnerModal) {
      game.dom.winnerModal.classList.add("hidden");
    }
    if (game.dom.goalBanner) {
      game.dom.goalBanner.classList.add("hidden");
    }
  }

  /* ===== 12. ОТРИСОВКА СТОЛА (CANVAS 2D) ===== */
  function render() {
    const canvas = game.dom.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

    // 1. Темный неоновый ледовый фон стола
    const iceGrad = ctx.createLinearGradient(0, 0, 0, TABLE_HEIGHT);
    iceGrad.addColorStop(0, "#080d1e");
    iceGrad.addColorStop(0.5, "#0b1226");
    iceGrad.addColorStop(1, "#080d1e");
    ctx.fillStyle = iceGrad;
    ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

    // Легкий радиальный свет в центре стола
    const centerGlow = ctx.createRadialGradient(225, 425, 10, 225, 425, 300);
    centerGlow.addColorStop(0, "rgba(0, 240, 255, 0.06)");
    centerGlow.addColorStop(1, "transparent");
    ctx.fillStyle = centerGlow;
    ctx.fillRect(0, 0, TABLE_WIDTH, TABLE_HEIGHT);

    // 2. Разметка поля
    drawTableMarkings(ctx);

    // 3. Крупный счет матча на сукне (с поворотом на 180° для верхнего игрока)
    drawInIceScores(ctx);

    // 4. Ворота стола
    drawGoals(ctx);

    // 5. Шлейф шайбы
    drawPuckTrail(ctx);

    // 6. Шайба
    drawPuck(ctx);

    // 7. Биты игроков
    drawPaddle(ctx, game.p1, "#00f0ff", "#0088cc", "rgba(0, 240, 255, 0.5)"); // Синяя
    drawPaddle(ctx, game.p2, "#ff007f", "#b30059", "rgba(255, 0, 127, 0.5)"); // Красная

    // 8. Внешний неоновый борт стола с идеальными закругленными углами
    drawNeonBorders(ctx);
  }

  function drawTableMarkings(ctx) {
    ctx.save();

    // Центральная пунктирная линия
    ctx.strokeStyle = "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(PLAY_MIN_X, CENTER_Y);
    ctx.lineTo(PLAY_MAX_X, CENTER_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Центральный круг
    ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(225, CENTER_Y, 60, 0, Math.PI * 2);
    ctx.stroke();

    // Центральная точка
    ctx.fillStyle = "rgba(0, 240, 255, 0.6)";
    ctx.beginPath();
    ctx.arc(225, CENTER_Y, 5, 0, Math.PI * 2);
    ctx.fill();

    // Вратарские дуги (Creases)
    // Верхняя (Красная)
    ctx.strokeStyle = "rgba(255, 0, 127, 0.35)";
    ctx.beginPath();
    ctx.arc(225, PLAY_MIN_Y, 72, 0, Math.PI);
    ctx.stroke();

    // Нижняя (Синяя)
    ctx.strokeStyle = "rgba(0, 240, 255, 0.35)";
    ctx.beginPath();
    ctx.arc(225, PLAY_MAX_Y, 72, Math.PI, 0);
    ctx.stroke();

    ctx.restore();
  }

  function drawInIceScores(ctx) {
    ctx.save();

    // Счет игрока 1 (Синий, внизу)
    ctx.font = "900 86px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0, 240, 255, 0.2)";
    ctx.fillText(game.score1, 225, 540);

    // Счет игрока 2 (Красный, вверху) — ПЕРЕВЕРНУТ НА 180° для чтения сверху
    ctx.save();
    ctx.translate(225, 310);
    ctx.rotate(Math.PI);
    ctx.fillStyle = "rgba(255, 0, 127, 0.2)";
    ctx.fillText(game.score2, 0, 0);
    ctx.restore();

    ctx.restore();
  }

  function drawGoals(ctx) {
    ctx.save();

    // Створы ворот
    const topGoalGrad = ctx.createLinearGradient(0, PLAY_MIN_Y, 0, 0);
    topGoalGrad.addColorStop(0, "rgba(255, 0, 127, 0.25)");
    topGoalGrad.addColorStop(1, "rgba(0, 0, 0, 0.9)");
    ctx.fillStyle = topGoalGrad;
    ctx.fillRect(GOAL_X1, 0, GOAL_WIDTH, PLAY_MIN_Y);

    const botGoalGrad = ctx.createLinearGradient(0, PLAY_MAX_Y, 0, TABLE_HEIGHT);
    botGoalGrad.addColorStop(0, "rgba(0, 240, 255, 0.25)");
    botGoalGrad.addColorStop(1, "rgba(0, 0, 0, 0.9)");
    ctx.fillStyle = botGoalGrad;
    ctx.fillRect(GOAL_X1, PLAY_MAX_Y, GOAL_WIDTH, TABLE_HEIGHT - PLAY_MAX_Y);

    // Штанги ворот
    const posts = [
      { x: GOAL_X1, y: PLAY_MIN_Y },
      { x: GOAL_X2, y: PLAY_MIN_Y },
      { x: GOAL_X1, y: PLAY_MAX_Y },
      { x: GOAL_X2, y: PLAY_MAX_Y }
    ];

    posts.forEach((p) => {
      ctx.fillStyle = "#ffffff";
      ctx.shadowColor = "rgba(255, 255, 255, 0.8)";
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, GOAL_POST_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  function drawPuckTrail(ctx) {
    if (game.puck.trail.length < 2) return;
    ctx.save();
    for (let i = 0; i < game.puck.trail.length; i++) {
      const pt = game.puck.trail[i];
      const alpha = (i / game.puck.trail.length) * 0.35;
      const radius = PUCK_RADIUS * (0.5 + (i / game.puck.trail.length) * 0.5);

      ctx.fillStyle = `rgba(0, 240, 255, ${alpha})`;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPuck(ctx) {
    const puck = game.puck;
    ctx.save();

    // Неоновое свечение шайбы
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 18;

    // Внешнее кольцо
    const puckGrad = ctx.createRadialGradient(
      puck.x - puck.radius * 0.3,
      puck.y - puck.radius * 0.3,
      2,
      puck.x,
      puck.y,
      puck.radius
    );
    puckGrad.addColorStop(0, "#ffffff");
    puckGrad.addColorStop(0.4, "#00f0ff");
    puckGrad.addColorStop(1, "#0066aa");

    ctx.fillStyle = puckGrad;
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, puck.radius, 0, Math.PI * 2);
    ctx.fill();

    // Внутренний неоновый ободок шайбы
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.arc(puck.x, puck.y, puck.radius * 0.6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  function drawPaddle(ctx, paddle, primaryColor, secondaryColor, glowColor) {
    ctx.save();

    // 1. Неоновое свечение биты
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 24;

    // 2. Внешнее основание биты (Sticker pad)
    const baseGrad = ctx.createRadialGradient(
      paddle.x - paddle.radius * 0.3,
      paddle.y - paddle.radius * 0.3,
      paddle.radius * 0.2,
      paddle.x,
      paddle.y,
      paddle.radius
    );
    baseGrad.addColorStop(0, "#ffffff");
    baseGrad.addColorStop(0.3, primaryColor);
    baseGrad.addColorStop(0.85, secondaryColor);
    baseGrad.addColorStop(1, "#030712");

    ctx.fillStyle = baseGrad;
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, paddle.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();

    // 3. Центральная ручка захвата (Knob)
    ctx.shadowBlur = 0;
    const knobGrad = ctx.createRadialGradient(
      paddle.x - paddle.radius * 0.2,
      paddle.y - paddle.radius * 0.2,
      2,
      paddle.x,
      paddle.y,
      paddle.radius * 0.48
    );
    knobGrad.addColorStop(0, "#ffffff");
    knobGrad.addColorStop(0.5, primaryColor);
    knobGrad.addColorStop(1, "#020617");

    ctx.fillStyle = knobGrad;
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, paddle.radius * 0.48, 0, Math.PI * 2);
    ctx.fill();

    // Внутренняя точка захвата под палец
    ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
    ctx.beginPath();
    ctx.arc(paddle.x, paddle.y, paddle.radius * 0.16, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /* Отрисовка неоновых бортов с идеальными закругленными углами */
  function drawNeonBorders(ctx) {
    ctx.save();
    ctx.shadowBlur = 14;

    // Верхняя половина (Красная / Маджента)
    ctx.shadowColor = "#ff007f";
    ctx.strokeStyle = "#ff007f";
    ctx.lineWidth = WALL_THICKNESS;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Верхний левый борт с закругленным углом
    ctx.beginPath();
    ctx.moveTo(PLAY_MIN_X, CENTER_Y);
    ctx.lineTo(PLAY_MIN_X, CORNER_TOP_LEFT.y);
    ctx.arcTo(PLAY_MIN_X, PLAY_MIN_Y, CORNER_TOP_LEFT.x, PLAY_MIN_Y, CORNER_RADIUS);
    ctx.lineTo(GOAL_X1, PLAY_MIN_Y);
    ctx.stroke();

    // Верхний правый борт с закругленным углом
    ctx.beginPath();
    ctx.moveTo(GOAL_X2, PLAY_MIN_Y);
    ctx.lineTo(CORNER_TOP_RIGHT.x, PLAY_MIN_Y);
    ctx.arcTo(PLAY_MAX_X, PLAY_MIN_Y, PLAY_MAX_X, CORNER_TOP_RIGHT.y, CORNER_RADIUS);
    ctx.lineTo(PLAY_MAX_X, CENTER_Y);
    ctx.stroke();

    // Нижняя половина (Синяя)
    ctx.shadowColor = "#00f0ff";
    ctx.strokeStyle = "#00f0ff";

    // Нижний левый борт с закругленным углом
    ctx.beginPath();
    ctx.moveTo(PLAY_MIN_X, CENTER_Y);
    ctx.lineTo(PLAY_MIN_X, CORNER_BOT_LEFT.y);
    ctx.arcTo(PLAY_MIN_X, PLAY_MAX_Y, CORNER_BOT_LEFT.x, PLAY_MAX_Y, CORNER_RADIUS);
    ctx.lineTo(GOAL_X1, PLAY_MAX_Y);
    ctx.stroke();

    // Нижний правый борт с закругленным углом
    ctx.beginPath();
    ctx.moveTo(GOAL_X2, PLAY_MAX_Y);
    ctx.lineTo(CORNER_BOT_RIGHT.x, PLAY_MAX_Y);
    ctx.arcTo(PLAY_MAX_X, PLAY_MAX_Y, PLAY_MAX_X, CORNER_BOT_RIGHT.y, CORNER_RADIUS);
    ctx.lineTo(PLAY_MAX_X, CENTER_Y);
    ctx.stroke();

    ctx.restore();
  }

  /* ===== 13. ИГРОВОЙ ЦИКЛ (REQUESTANIMATIONFRAME) ===== */
  function gameLoop() {
    if (!game.active) return;
    updatePaddles();
    updatePhysics();
    render();
    game.animFrameId = requestAnimationFrame(gameLoop);
  }

  /* ===== 14. МАСШТАБИРОВАНИЕ СТОЛА ПОД ВЫТЯНУТЫЕ И МОБИЛЬНЫЕ ЭКРАНЫ ===== */
  function resizeTable() {
    const container = game.dom.container || document.getElementById("airhockey-container") || game.dom.screen;
    const canvasContainer = game.dom.canvasContainer || document.getElementById("airhockey-canvas-container");
    const canvas = game.dom.canvas || document.getElementById("airhockey-canvas");
    if (!canvasContainer || !canvas) return;

    // Определяем точные видимые размеры с учетом dvh и адресных строк
    let availW = window.innerWidth;
    let availH = window.innerHeight;

    if (window.visualViewport) {
      availW = window.visualViewport.width;
      availH = window.visualViewport.height;
    }

    if (container) {
      const rect = container.getBoundingClientRect();
      if (rect.width > 50 && rect.height > 50) {
        availW = rect.width;
        availH = rect.height;
      }
    }

    // 8px защитный отступ со всех сторон (16px суммарно)
    const padding = 16;
    const maxW = Math.max(100, availW - padding);
    const maxH = Math.max(100, availH - padding);

    // Строгий расчет масштаба: стол гарантированно полностью помещается в экран
    // и по горизонтали, и по вертикали (никаких срезанных бортов и ворот!)
    const scale = Math.min(maxW / TABLE_WIDTH, maxH / TABLE_HEIGHT);

    const displayW = Math.round(TABLE_WIDTH * scale);
    const displayH = Math.round(TABLE_HEIGHT * scale);

    canvasContainer.style.width = displayW + "px";
    canvasContainer.style.height = displayH + "px";

    canvas.style.width = displayW + "px";
    canvas.style.height = displayH + "px";
  }

  function startGame() {
    game.active = true;
    resizeTable();
    resetMatch();
    audio.init();

    if (game.animFrameId) cancelAnimationFrame(game.animFrameId);
    game.animFrameId = requestAnimationFrame(gameLoop);
  }

  function stopGame() {
    game.active = false;
    if (game.animFrameId) {
      cancelAnimationFrame(game.animFrameId);
      game.animFrameId = null;
    }
  }

  /* ===== 15. ИНИЦИАЛИЗАЦИЯ И ПРИВЯЗКА СОБЫТИЙ ===== */
  function initAirHockey() {
    game.dom.screen = document.getElementById("screen-airhockey");
    game.dom.container = document.getElementById("airhockey-container");
    game.dom.canvasContainer = document.getElementById("airhockey-canvas-container");
    game.dom.canvas = document.getElementById("airhockey-canvas");
    game.dom.menuCard = document.getElementById("card-airhockey");
    game.dom.backBtn = document.getElementById("airhockey-back-btn");
    game.dom.resetBtn = document.getElementById("airhockey-reset-btn");
    game.dom.soundBtn = document.getElementById("airhockey-sound-btn");
    game.dom.botBtn = document.getElementById("airhockey-bot-btn");
    game.dom.goalBanner = document.getElementById("airhockey-goal-banner");
    game.dom.winnerModal = document.getElementById("airhockey-winner-modal");
    game.dom.winnerPlayerName = document.getElementById("airhockey-winner-player-name");
    game.dom.winnerScoreText = document.getElementById("airhockey-winner-score-text");
    game.dom.replayBtn = document.getElementById("airhockey-replay-btn");
    game.dom.winnerMenuBtn = document.getElementById("airhockey-menu-btn");

    // Карточка в меню
    if (game.dom.menuCard) {
      game.dom.menuCard.addEventListener("click", () => {
        if (window.showScreen) {
          window.showScreen("airhockeyGame");
        }
      });
    }

    // Кнопка возврата в меню
    if (game.dom.backBtn) {
      game.dom.backBtn.addEventListener("click", () => {
        stopGame();
        if (window.showScreen) {
          window.showScreen("menu");
        }
      });
    }

    // Кнопка сброса матча на боковой панели
    if (game.dom.resetBtn) {
      game.dom.resetBtn.addEventListener("click", () => {
        if (confirm("Сбросить счёт и начать матч заново?")) {
          resetMatch();
        }
      });
    }

    // Переключатель звука
    if (game.dom.soundBtn) {
      game.dom.soundBtn.addEventListener("click", () => {
        audio.enabled = !audio.enabled;
        game.dom.soundBtn.textContent = audio.enabled ? "🔊" : "🔇";
        if (window.showToast) {
          window.showToast(audio.enabled ? "Звук включен" : "Звук выключен", 1400);
        }
      });
    }

    // Переключатель бота для Игрока 2 (Красный)
    if (game.dom.botBtn) {
      game.dom.botBtn.addEventListener("click", () => {
        toggleBot();
      });
    }

    // Модальное окно победы: Реванш
    if (game.dom.replayBtn) {
      game.dom.replayBtn.addEventListener("click", () => {
        resetMatch();
      });
    }

    // Модальное окно победы: В главное меню
    if (game.dom.winnerMenuBtn) {
      game.dom.winnerMenuBtn.addEventListener("click", () => {
        stopGame();
        if (game.dom.winnerModal) game.dom.winnerModal.classList.add("hidden");
        if (window.showScreen) window.showScreen("menu");
      });
    }

    // Мультитач события на холсте
    const canvas = game.dom.canvas;
    if (canvas) {
      canvas.addEventListener("touchstart", onTouchStart, { passive: false });
      canvas.addEventListener("touchmove", onTouchMove, { passive: false });
      canvas.addEventListener("touchend", onTouchEnd, { passive: false });
      canvas.addEventListener("touchcancel", onTouchEnd, { passive: false });

      // Мышь для ПК (клик снизу — Синий, клик сверху — Красный)
      canvas.addEventListener("mousedown", onMouseDown);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mouseup", onMouseUp);
    }

    // Клавиатура для ПК (WASD + Стрелки)
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);

    // Слушатели изменения размера экрана и ориентации устройства
    window.addEventListener("resize", resizeTable);
    window.addEventListener("orientationchange", () => {
      setTimeout(resizeTable, 100);
      setTimeout(resizeTable, 300);
    });
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", resizeTable);
    }

    // Интеграция с window.showScreen для плавного переключения
    const origShowScreen = window.showScreen;
    if (origShowScreen) {
      window.showScreen = function (screenKey) {
        if (screenKey === "airhockeyGame") {
          document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
          if (game.dom.screen) {
            game.dom.screen.classList.add("active");
          }
          resizeTable();
          startGame();
          return;
        }

        // Если переключаемся на любой другой экран — останавливаем цикл хоккея
        if (game.dom.screen) {
          game.dom.screen.classList.remove("active");
        }
        stopGame();
        origShowScreen(screenKey);
      };
    }

    // Первичный расчет геометрии и статическая отрисовка стола
    resizeTable();
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAirHockey);
  } else {
    initAirHockey();
  }
})();
