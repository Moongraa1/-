/* =========================================================
   ВЕЧЕРИНКА ИГР (ШПИОН, МАФИЯ, ЭЛИАС)
   Чистый ES6 JavaScript, без сторонних библиотек.
   Алгоритм Фишера-Йейтса для честного перемешивания ролей и слов.
   ========================================================= */

"use strict";

/* =========================================================
   1. БАЗЫ ДАННЫХ И КОНСТАНТЫ
   ========================================================= */

// --- ШПИОН: БАЗА ЛОКАЦИЙ (ОДИНОЧНЫЕ ЛОКАЦИИ БЕЗ ПАР) ---
const SPY_STORAGE_KEY = "spy_custom_locations_v2";
const SPY_MIN_PLAYERS = 3;
const SPY_MAX_PLAYERS = 12;

const SPY_CATEGORIES = {
  city: {
    name: "Городские места",
    locations: [
      "Больница", "Школа", "Аэропорт", "Железнодорожный вокзал", "Кинотеатр",
      "Торговый центр", "Библиотека", "Ресторан", "Отделение полиции", "Пожарная часть",
      "Отель", "Стадион", "Музей искусств", "Цирк", "Аквапарк",
      "Зоопарк", "Банк", "Метрополитен", "Ночной клуб", "Кофейня",
      "Городской пляж", "Супермаркет", "Автосервис", "Театр драмы", "Аптека",
      "Салон красоты", "Казино", "Университет", "Боулинг-клуб", "Парк аттракционов",
      "Зал суда", "Почтовое отделение", "Концертный зал", "Фитнес-клуб", "Мэрия города"
    ]
  },
  countries: {
    name: "Страны и города мира",
    locations: [
      "Франция (Париж)", "Италия (Рим)", "Япония (Токио)", "Бразилия (Рио)", "Египет (Каир)",
      "Китай (Пекин)", "Испания (Барселона)", "Германия (Берлин)", "Великобритания (Лондон)", "США (Нью-Йорк)",
      "Канада (Торонто)", "Австралия (Сидней)", "Турция (Стамбул)", "Греция (Афины)", "Индия (Дели)",
      "Мексика (Канкун)", "Таиланд (Бангкок)", "Норвегия (Осло)", "Швейцария (Альпы)", "Аргентина (Буэнос-Айрес)",
      "Исландия (Рейкьявик)", "ОАЭ (Дубай)", "Португалия (Лиссабон)", "Южная Корея (Сеул)", "Нидерланды (Амстердам)",
      "Грузия (Тбилиси)", "Сингапур", "Чехия (Прага)", "Австрия (Вена)", "Куба (Гавана)",
      "Вьетнам (Ханой)", "Мальдивы", "Бали (Индонезия)", "Кипр", "Марокко (Марракеш)"
    ]
  },
  nature: {
    name: "Природа и приключения",
    locations: [
      "Густой таёжный лес", "Необитаемый остров", "Вершина заснеженной горы", "Таинственная пещера", "Бурлящий водопад",
      "Песчаная пустыня", "Берег бескрайнего океана", "Тропические джунгли", "Глубокий каньон", "Берёзовая роща",
      "Действующий вулкан", "Северный полюс", "Озеро Байкал", "Жаркая саванна", "Туманное болото",
      "Долина гейзеров", "Бурная горная река", "Ледник в горах", "Коралловый риф", "Цветущий оазис",
      "Палаточный лагерь в лесу", "Парусный катамаран в море", "Степные просторы", "Норвежский фьорд", "Подземный грот"
    ]
  },
  special: {
    name: "Необычные и секретные места",
    locations: [
      "Секретный военный бункер", "Пиратский парусный корабль", "Заброшенный средневековый замок", "Лунная исследовательская база", "Орбитальная космическая станция",
      "Машина времени", "Золотая шахта", "Поезд-призрак", "Секретная лаборатория", "Огромный дирижабль",
      "Затонувший город Атлантида", "Особняк с привидениями", "Таинственный остров сокровищ", "Древняя гробница фараона", "Тайное убежище суперзлодея",
      "Парк динозавров", "Шпионская академия", "Волшебная таверна", "Каюта капитана субмарины", "Зона 51"
    ]
  }
};

// --- МАФИЯ: РОЛИ ---
const MAFIA_MIN_PLAYERS = 4;
const MAFIA_MAX_PLAYERS = 20;
const MAFIA_NOTES_STORAGE_KEY = "mafia_host_notes_v2";

const MAFIA_ROLES = {
  don: {
    id: "don",
    name: "Дон Мафии",
    icon: "🎩",
    team: "mafia",
    teamName: "Мафия",
    teamClass: "team--mafia",
    max: 1,
    default: 1,
    desc: "Глава мафии. Ночью вместе с сообщниками выбирает жертву, а также отдельно ищет Шерифа города."
  },
  mafia: {
    id: "mafia",
    name: "Мафия",
    icon: "🔫",
    team: "mafia",
    teamName: "Мафия",
    teamClass: "team--mafia",
    max: 8,
    default: 1,
    desc: "Член преступного синдиката. Ночью просыпается вместе с Доном и другими мафиози для устранения мирных жителей."
  },
  sheriff: {
    id: "sheriff",
    name: "Шериф",
    icon: "⭐",
    team: "peace",
    teamName: "Мирные",
    teamClass: "team--peace",
    max: 1,
    default: 1,
    desc: "Лидер мирных жителей. Каждую ночь проверяет одного игрока и узнает у ведущего, является ли тот мафией."
  },
  doctor: {
    id: "doctor",
    name: "Доктор",
    icon: "💉",
    team: "peace",
    teamName: "Мирные",
    teamClass: "team--peace",
    max: 1,
    default: 1,
    desc: "Городской врач. Ночью выбирает одного участника и лечит его. Не может спасать одного и того же человека две ночи подряд."
  },
  prostitute: {
    id: "prostitute",
    name: "Проститутка",
    icon: "💋",
    team: "peace",
    teamName: "Мирные",
    teamClass: "team--peace",
    max: 1,
    default: 0,
    desc: "Ночная бабочка. Выбирает одного игрока и проводит с ним ночь, полностью блокируя его ночные действия и способности."
  },
  killer: {
    id: "killer",
    name: "Серийный убийца",
    icon: "🔪",
    team: "neutral",
    teamName: "Нейтрал",
    teamClass: "team--neutral",
    max: 1,
    default: 0,
    desc: "Одинокий маньяк. Ночью убивает любого игрока. Побеждает только в том случае, если останется один на один с последним выжившим."
  },
  suicide: {
    id: "suicide",
    name: "Самоубийца",
    icon: "💣",
    team: "neutral",
    teamName: "Нейтрал",
    teamClass: "team--neutral",
    max: 1,
    default: 0,
    desc: "Хитрый одиночка. Его главная цель — вести себя максимально подозрительно, чтобы город казнил его на дневном голосовании."
  },
  civilian: {
    id: "civilian",
    name: "Мирный житель",
    icon: "👥",
    team: "peace",
    teamName: "Мирные",
    teamClass: "team--peace",
    max: 99,
    default: 0,
    desc: "Честный житель города. Ночью крепко спит, а днем участвует в обсуждениях, вычисляет мафию и голосует на суде."
  }
};

// --- ЭЛИАС: СЛОВАРИ ПО СЛОЖНОСТЯМ (75+ СЛОВ НА УРОВЕНЬ) ---
const ALIAS_WORDS = {
  easy: [
    "Кошка", "Собака", "Холодильник", "Яблоко", "Автомобиль", "Самолёт", "Книга", "Солнце",
    "Стул", "Стол", "Чайник", "Молоко", "Телефон", "Окно", "Дверь", "Шапка",
    "Ботинки", "Кровать", "Ложка", "Вилка", "Чашка", "Хлеб", "Сыр", "Рыба",
    "Медведь", "Лошадь", "Птица", "Дерево", "Цветы", "Футбольный мяч", "Гитара", "Часы",
    "Очки", "Зеркало", "Подушка", "Карандаш", "Бумага", "Банан", "Шоколад", "Мороженое",
    "Пицца", "Велосипед", "Автобус", "Поезд", "Река", "Море", "Снег", "Ветер",
    "Звезда", "Луна", "Огонь", "Вода", "Мыло", "Зубная щетка", "Расчёска", "Рубашка",
    "Шарф", "Тарелка", "Сковорода", "Кухонный нож", "Кастрюля", "Телевизор", "Компьютер", "Ковёр",
    "Настольная лампа", "Утюг", "Пылесос", "Ключ", "Дверной замок", "Кошелек", "Рюкзак", "Чемодан",
    "Зонт", "Бабочка", "Огурец", "Помидор", "Апельсин", "Арбуз", "Клубника", "Котлета",
    "Суп", "Чай", "Кофе", "Печенье", "Конфета", "Торт", "Шкаф", "Диван"
  ],
  medium: [
    "Программист", "Архитектор", "Вдохновение", "Приключение", "Путешествие", "Фотоаппарат", "Экскурсия", "Собеседование",
    "Компромисс", "Совещание", "Ностальгия", "Любопытство", "Репетиция", "Атмосфера", "Воображение", "Небоскрёб",
    "Водопроводчик", "Космонавт", "Журналист", "Экскурсовод", "Фотосессия", "Бутерброд", "Презентация", "Переговоры",
    "Законодательство", "Благодарность", "Разочарование", "Оптимизм", "Пунктуальность", "Справедливость", "Энтузиазм", "Конкуренция",
    "Симпатия", "Автограф", "Экспедиция", "Премьера", "Картинная галерея", "Иллюминатор", "Кинофестиваль", "Мечтатель",
    "Изобретатель", "Археолог", "Спасатель", "Стоматолог", "Экспертиза", "Научный эксперимент", "Интуиция", "Дисциплина",
    "Мотивация", "Творчество", "Симфония", "Симфонический оркестр", "Инициатива", "Репутация", "Сомнение", "Технологический прогресс",
    "Дирижёр", "Продюсер", "Синхронный переводчик", "Сценарист", "Библиотекарь", "Конференция", "Стажировка", "Комплимент",
    "Застенчивость", "Сочувствие", "Терпение", "Решительность", "Жизненное призвание", "Морской горизонт", "Алый рассвет", "Осенний листопад",
    "Землетрясение", "Сложная головоломка", "Дегустация", "Каскадёр", "Марафон", "Аукцион", "Парашют", "Лабиринт"
  ],
  hard: [
    "Прокрастинация", "Экзистенциализм", "Амбивалентность", "Сингулярность", "Душевный катарсис", "Мизантропия", "Эмпатия", "Эффект дежавю",
    "Эвристика", "Перфекционизм", "Апогей", "Литературный оксюморон", "Эфемерность", "Трансцендентность", "Дихотомия", "Истинный альтруизм",
    "Научная парадигма", "Когнитивный диссонанс", "Квинтэссенция", "Эвфемизм", "Инкогнито", "Театральный антураж", "Светлая меланхолия", "Эксцентричность",
    "Синергия", "Строгий аскетизм", "Фатализм", "Искусный блеф", "Светский моветон", "Исторический анахронизм", "Сюрреализм", "Состояние аффекта",
    "Коллаборация", "Конформизм", "Прерогатива", "Публичный эпатаж", "Экстраполяция", "Политическая демагогия", "Недостижимая утопия", "Мрачная антиутопия",
    "Юридическая казуистика", "Эзотерика", "Технологическое ноу-хау", "Рыночная монополия", "Право вето", "Эпоха Ренессанса", "Филантропия", "Устойчивая идиома",
    "Тонкий нюанс", "Судебный прецедент", "Глубокая рефлексия", "Природный симбиоз", "Сохранение статус-кво", "Удивительный феномен", "Врождённая харизма", "Юрисдикция",
    "Непреложная догма", "Смелая гипотеза", "Оптическая иллюзия", "Коварная инсинуация", "Военная коалиция", "Опасный компромат", "Универсальная панацея", "Информационная провокация",
    "Музейный раритет", "Громкая сенсация", "Здоровый скептицизм", "Военная тактика", "Культурное табу", "Жёсткий ультиматум", "Полное фиаско", "Морской флагман",
    "Форс-мажор", "Безудержная эйфория", "Апокалипсис", "Иерархия", "Гегемония", "Нигилизм", "Презумпция", "Криптография"
  ]
};

/* =========================================================
   2. СОСТОЯНИЕ ПРИЛОЖЕНИЯ
   ========================================================= */

const state = {
  activeScreen: "menu",

  // Состояние Шпиона
  spy: {
    playerCount: 4,
    players: [],
    selectedCategories: ["city", "nature"],
    customLocations: [],
    round: {
      players: [],
      secretLocation: "",
      spyName: "",
      firstPlayer: "",
      currentIndex: 0
    },
    usedLocations: [],
    lastSpyIndex: -1
  },

  // Состояние Мафии
  mafia: {
    playerCount: 8,
    customNames: [],
    roleCounts: {
      don: 1,
      mafia: 1,
      sheriff: 1,
      doctor: 1,
      prostitute: 0,
      killer: 0,
      suicide: 0
    },
    game: {
      players: [],
      currentIndex: 0,
      isCardRevealed: false,
      isNight: true,
      nightCount: 1,
      dayCount: 0,
      notes: ""
    }
  },

  // Состояние Элиаса
  alias: {
    teamCount: 2,
    teams: [], // [{ name, score }]
    difficulty: "easy",
    roundTime: 60,
    targetScore: 50,
    penaltyEnabled: true,
    // Текущая игра
    game: {
      teams: [],
      currentTeamIndex: 0,
      deck: [],
      currentWord: "",
      roundWords: [], // [{ word, isCorrect }]
      timerSeconds: 60,
      timerInterval: null,
      roundScore: 0
    }
  }
};

/* =========================================================
   3. DOM КЭШ И ИНИЦИАЛИЗАЦИЯ
   ========================================================= */
const dom = {};

function init() {
  cacheElements();
  loadStoredData();

  // Инициализация игры Шпион
  renderSpyCategories();
  renderSpyCustomCategoryOptions();
  renderSpyCustomList();
  renderSpyPlayerNames();
  updateSpyPlayerCount();

  // Инициализация игры Мафия
  renderMafiaPlayerNames();
  renderMafiaRolesConfig();
  updateMafiaCivilianCount();

  // Инициализация игры Элиас
  renderAliasTeamInputs();

  // События
  bindEvents();

  // Открываем главное меню
  showScreen("menu");
}

function cacheElements() {
  // Экраны
  dom.screens = {
    menu: document.getElementById("screen-menu"),
    spySetup: document.getElementById("screen-setup"),
    spyPass: document.getElementById("screen-pass"),
    spyRole: document.getElementById("screen-role"),
    spyGame: document.getElementById("screen-game"),
    mafiaSetup: document.getElementById("screen-mafia-setup"),
    mafiaReveal: document.getElementById("screen-mafia-reveal"),
    mafiaHandoff: document.getElementById("screen-mafia-handoff"),
    mafiaHost: document.getElementById("screen-mafia-host"),
    aliasSetup: document.getElementById("screen-alias-setup"),
    aliasReady: document.getElementById("screen-alias-ready"),
    aliasGame: document.getElementById("screen-alias-game"),
    aliasReview: document.getElementById("screen-alias-round-review"),
    aliasWinner: document.getElementById("screen-alias-winner")
  };

  dom.toast = document.getElementById("toast");

  // Карточки меню
  dom.cardSpy = document.getElementById("card-spy");
  dom.cardMafia = document.getElementById("card-mafia");
  dom.cardElias = document.getElementById("card-elias");

  // Кнопки возврата в меню
  dom.spyBackBtn = document.getElementById("spy-back-to-menu-btn");
  dom.spyGameBackBtn = document.getElementById("spy-game-to-menu-btn");
  dom.mafiaBackBtn = document.getElementById("mafia-back-to-menu-btn");
  dom.mafiaEndGameBtn = document.getElementById("mafia-end-game-btn");
  dom.aliasBackBtn = document.getElementById("alias-back-to-menu-btn");
  dom.aliasReadyBackBtn = document.getElementById("alias-ready-to-menu-btn");
  dom.aliasWinnerToMenuBtn = document.getElementById("alias-winner-to-menu-btn");

  // Шпион
  dom.spyPlayersCount = document.getElementById("players-count");
  dom.spyPlayersMinus = document.getElementById("players-minus");
  dom.spyPlayersPlus = document.getElementById("players-plus");
  dom.spyPlayersNames = document.getElementById("players-names");
  dom.spyCategoriesList = document.getElementById("categories-list");
  dom.spyCategoriesHint = document.getElementById("categories-hint");
  dom.spyCustomLocationInput = document.getElementById("custom-location-input");
  dom.spyCustomCategory = document.getElementById("custom-category");
  dom.spyAddCustomBtn = document.getElementById("add-custom-btn");
  dom.spyCustomList = document.getElementById("custom-list");
  dom.spyStartGameBtn = document.getElementById("start-game-btn");
  dom.spyPassPlayerName = document.getElementById("pass-player-name");
  dom.spyShowRoleBtn = document.getElementById("show-role-btn");
  dom.spyRolePlayerName = document.getElementById("role-player-name");
  dom.spyRoleNormalCard = document.getElementById("role-normal-card");
  dom.spyRoleSpyCard = document.getElementById("role-spy-card");
  dom.spyRoleLocation = document.getElementById("role-location");
  dom.spyHideRoleBtn = document.getElementById("hide-role-btn");
  dom.spyFirstPlayerName = document.getElementById("first-player-name");
  dom.spyNextRoundBtn = document.getElementById("next-round-btn");

  // Мафия
  dom.mafiaPlayersCount = document.getElementById("mafia-players-count");
  dom.mafiaPlayersMinus = document.getElementById("mafia-players-minus");
  dom.mafiaPlayersPlus = document.getElementById("mafia-players-plus");
  dom.mafiaPlayersNames = document.getElementById("mafia-players-names");
  dom.mafiaNamesCount = document.getElementById("mafia-names-count");
  dom.mafiaRolesConfig = document.getElementById("mafia-roles-config");
  dom.mafiaCivilianCount = document.getElementById("mafia-civilian-count");
  dom.mafiaCiviliansBox = document.getElementById("mafia-civilians-box");
  dom.mafiaRolesError = document.getElementById("mafia-roles-error");
  dom.mafiaStartBtn = document.getElementById("mafia-start-btn");
  dom.mafiaRevealProgress = document.getElementById("mafia-reveal-progress");
  dom.mafiaRevealPlayerName = document.getElementById("mafia-reveal-player-name");
  dom.mafiaCardContainer = document.getElementById("mafia-card-container");
  dom.mafiaRoleCard = document.getElementById("mafia-role-card");
  dom.mafiaCardFront = document.getElementById("mafia-card-front");
  dom.mafiaRoleTeamBadge = document.getElementById("mafia-role-team-badge");
  dom.mafiaRoleIcon = document.getElementById("mafia-role-icon");
  dom.mafiaRoleName = document.getElementById("mafia-role-name");
  dom.mafiaRoleDesc = document.getElementById("mafia-role-desc");
  dom.mafiaToggleRoleBtn = document.getElementById("mafia-toggle-role-btn");
  dom.mafiaPassNextBtn = document.getElementById("mafia-pass-next-btn");
  dom.mafiaHostEnterBtn = document.getElementById("mafia-host-enter-btn");
  dom.mafiaGamePhaseLabel = document.getElementById("mafia-game-phase-label");
  dom.mafiaPhaseToggleBtn = document.getElementById("mafia-phase-toggle-btn");
  dom.mafiaPhaseIcon = document.getElementById("mafia-phase-icon");
  dom.mafiaPhaseText = document.getElementById("mafia-phase-text");
  dom.statAliveTotal = document.getElementById("stat-alive-total");
  dom.statAliveMafia = document.getElementById("stat-alive-mafia");
  dom.statAlivePeace = document.getElementById("stat-alive-peace");
  dom.mafiaHostPlayersList = document.getElementById("mafia-host-players-list");
  dom.mafiaHostNotes = document.getElementById("mafia-host-notes");
  dom.mafiaClearNotesBtn = document.getElementById("mafia-clear-notes-btn");

  // Элиас
  dom.aliasTeamsMinus = document.getElementById("alias-teams-minus");
  dom.aliasTeamsCount = document.getElementById("alias-teams-count");
  dom.aliasTeamsPlus = document.getElementById("alias-teams-plus");
  dom.aliasTeamsInputs = document.getElementById("alias-teams-inputs");
  dom.aliasDiffSelector = document.getElementById("alias-diff-selector");
  dom.aliasTimeSelector = document.getElementById("alias-time-selector");
  dom.aliasScoreSelector = document.getElementById("alias-score-selector");
  dom.aliasPenaltyToggle = document.getElementById("alias-penalty-toggle");
  dom.aliasStartSetupBtn = document.getElementById("alias-start-setup-btn");

  dom.aliasReadyTeamName = document.getElementById("alias-ready-team-name");
  dom.aliasReadyTargetInfo = document.getElementById("alias-ready-target-info");
  dom.aliasReadyScoreboard = document.getElementById("alias-ready-scoreboard");
  dom.aliasReadyStartBtn = document.getElementById("alias-ready-start-btn");

  dom.aliasGameTeamPill = document.getElementById("alias-game-team-pill");
  dom.aliasGameScoreBadge = document.getElementById("alias-game-score-badge");
  dom.aliasGameTimer = document.getElementById("alias-game-timer");
  dom.aliasWordCard = document.getElementById("alias-word-card");
  dom.aliasWordDiffLabel = document.getElementById("alias-word-diff-label");
  dom.aliasWordText = document.getElementById("alias-word-text");
  dom.aliasBtnSkip = document.getElementById("alias-btn-skip");
  dom.aliasBtnCorrect = document.getElementById("alias-btn-correct");

  dom.aliasReviewSubtitle = document.getElementById("alias-review-subtitle");
  dom.aliasReviewRoundScore = document.getElementById("alias-review-round-score");
  dom.aliasReviewWordsList = document.getElementById("alias-review-words-list");
  dom.aliasReviewConfirmBtn = document.getElementById("alias-review-confirm-btn");

  dom.aliasWinnerTeamName = document.getElementById("alias-winner-team-name");
  dom.aliasWinnerScoreboard = document.getElementById("alias-winner-scoreboard");
  dom.aliasWinnerReplayBtn = document.getElementById("alias-winner-replay-btn");
}

function loadStoredData() {
  try {
    const rawSpy = localStorage.getItem(SPY_STORAGE_KEY);
    if (rawSpy) {
      const parsed = JSON.parse(rawSpy);
      if (Array.isArray(parsed)) state.spy.customLocations = parsed;
    }
  } catch (e) {
    state.spy.customLocations = [];
  }

  try {
    const rawNotes = localStorage.getItem(MAFIA_NOTES_STORAGE_KEY);
    if (rawNotes) {
      state.mafia.game.notes = rawNotes;
      if (dom.mafiaHostNotes) dom.mafiaHostNotes.value = rawNotes;
    }
  } catch (e) {
    state.mafia.game.notes = "";
  }
}

function bindEvents() {
  // Навигация из меню
  dom.cardSpy.addEventListener("click", () => showScreen("spySetup"));
  dom.cardMafia.addEventListener("click", () => showScreen("mafiaSetup"));
  dom.cardElias.addEventListener("click", () => showScreen("aliasSetup"));

  // Возврат в меню
  dom.spyBackBtn.addEventListener("click", () => showScreen("menu"));
  dom.spyGameBackBtn.addEventListener("click", () => showScreen("menu"));
  dom.mafiaBackBtn.addEventListener("click", () => showScreen("menu"));
  dom.mafiaEndGameBtn.addEventListener("click", confirmEndMafiaGame);
  dom.aliasBackBtn.addEventListener("click", () => showScreen("menu"));
  dom.aliasReadyBackBtn.addEventListener("click", () => {
    if (confirm("Выйти в главное меню? Текущий прогресс партии Элиас будет сброшен.")) {
      showScreen("menu");
    }
  });
  dom.aliasWinnerToMenuBtn.addEventListener("click", () => showScreen("menu"));

  // --- ШПИОН ---
  dom.spyPlayersMinus.addEventListener("click", () => changeSpyPlayers(-1));
  dom.spyPlayersPlus.addEventListener("click", () => changeSpyPlayers(1));
  dom.spyAddCustomBtn.addEventListener("click", saveSpyCustomLocation);
  dom.spyStartGameBtn.addEventListener("click", startSpyGame);
  dom.spyShowRoleBtn.addEventListener("click", showSpyCurrentRole);
  dom.spyHideRoleBtn.addEventListener("click", hideSpyRoleAndNext);
  dom.spyNextRoundBtn.addEventListener("click", nextSpyRound);

  // --- МАФИЯ ---
  dom.mafiaPlayersMinus.addEventListener("click", () => changeMafiaPlayers(-1));
  dom.mafiaPlayersPlus.addEventListener("click", () => changeMafiaPlayers(1));
  dom.mafiaStartBtn.addEventListener("click", startMafiaGame);
  dom.mafiaCardContainer.addEventListener("click", toggleMafiaCard);
  dom.mafiaToggleRoleBtn.addEventListener("click", toggleMafiaCard);
  dom.mafiaPassNextBtn.addEventListener("click", passMafiaToNextPlayer);
  dom.mafiaHostEnterBtn.addEventListener("click", () => {
    showScreen("mafiaHost");
    renderMafiaHostPanel();
  });
  dom.mafiaPhaseToggleBtn.addEventListener("click", toggleMafiaPhase);
  dom.mafiaHostNotes.addEventListener("input", (e) => {
    state.mafia.game.notes = e.target.value;
    try {
      localStorage.setItem(MAFIA_NOTES_STORAGE_KEY, e.target.value);
    } catch (err) {}
  });
  dom.mafiaClearNotesBtn.addEventListener("click", () => {
    if (confirm("Очистить заметки ведущего?")) {
      state.mafia.game.notes = "";
      dom.mafiaHostNotes.value = "";
      try {
        localStorage.removeItem(MAFIA_NOTES_STORAGE_KEY);
      } catch (err) {}
    }
  });

  // --- ЭЛИАС ---
  dom.aliasTeamsMinus.addEventListener("click", () => changeAliasTeams(-1));
  dom.aliasTeamsPlus.addEventListener("click", () => changeAliasTeams(1));

  // Выбор сложности Элиас
  dom.aliasDiffSelector.querySelectorAll(".chip").forEach((btn) => {
    btn.addEventListener("click", () => {
      dom.aliasDiffSelector.querySelectorAll(".chip").forEach((c) => c.classList.remove("chip--active"));
      btn.classList.add("chip--active");
      state.alias.difficulty = btn.dataset.diff;
    });
  });

  // Выбор времени раунда Элиас
  dom.aliasTimeSelector.querySelectorAll(".segmented-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      dom.aliasTimeSelector.querySelectorAll(".segmented-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.alias.roundTime = parseInt(btn.dataset.time, 10);
    });
  });

  // Выбор очков победы Элиас
  dom.aliasScoreSelector.querySelectorAll(".segmented-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      dom.aliasScoreSelector.querySelectorAll(".segmented-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      state.alias.targetScore = parseInt(btn.dataset.score, 10);
    });
  });

  // Штраф за пропуск
  dom.aliasPenaltyToggle.addEventListener("change", (e) => {
    state.alias.penaltyEnabled = e.target.checked;
  });

  dom.aliasStartSetupBtn.addEventListener("click", startAliasMatch);
  dom.aliasReadyStartBtn.addEventListener("click", startAliasRound);
  dom.aliasBtnSkip.addEventListener("click", () => handleAliasAnswer(false));
  dom.aliasBtnCorrect.addEventListener("click", () => handleAliasAnswer(true));
  dom.aliasReviewConfirmBtn.addEventListener("click", confirmAliasRoundReview);
  dom.aliasWinnerReplayBtn.addEventListener("click", () => showScreen("aliasSetup"));
}

function showScreen(screenKey) {
  Object.keys(dom.screens).forEach((key) => {
    if (dom.screens[key]) dom.screens[key].classList.remove("active");
  });

  if (dom.screens[screenKey]) {
    dom.screens[screenKey].classList.add("active");
    state.activeScreen = screenKey;
    const scrollArea = dom.screens[screenKey].querySelector(".scroll-area");
    if (scrollArea) scrollArea.scrollTop = 0;
  }
}

function showToast(message, duration = 3000) {
  if (!dom.toast) return;
  dom.toast.textContent = message;
  dom.toast.classList.add("show");
  clearTimeout(dom.toastTimer);
  dom.toastTimer = setTimeout(() => {
    dom.toast.classList.remove("show");
  }, duration);
}

function shuffleArray(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = arr[i];
    arr[i] = arr[j];
    arr[j] = temp;
  }
  return arr;
}

/* =========================================================
   4. МОДУЛЬ: ШПИОН (ОДИНОЧНЫЕ ЛОКАЦИИ БЕЗ ПАР)
   ========================================================= */
function changeSpyPlayers(delta) {
  const next = state.spy.playerCount + delta;
  if (next < SPY_MIN_PLAYERS || next > SPY_MAX_PLAYERS) return;
  state.spy.playerCount = next;
  updateSpyPlayerCount();
  renderSpyPlayerNames();
}

function updateSpyPlayerCount() {
  dom.spyPlayersCount.textContent = state.spy.playerCount;
}

function renderSpyPlayerNames() {
  const existing = collectSpyPlayerNames();
  dom.spyPlayersNames.innerHTML = "";

  for (let i = 0; i < state.spy.playerCount; i++) {
    const row = document.createElement("div");
    row.className = "player-row";

    const idx = document.createElement("span");
    idx.className = "player-index";
    idx.textContent = i + 1;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "input";
    input.placeholder = "Игрок " + (i + 1);
    input.value = existing[i] || "";
    input.autocomplete = "off";

    row.appendChild(idx);
    row.appendChild(input);
    dom.spyPlayersNames.appendChild(row);
  }
}

function collectSpyPlayerNames() {
  const inputs = dom.spyPlayersNames.querySelectorAll("input");
  return Array.from(inputs).map((inp) => inp.value.trim());
}

function renderSpyCategories() {
  dom.spyCategoriesList.innerHTML = "";

  Object.keys(SPY_CATEGORIES).forEach((key) => {
    const cat = SPY_CATEGORIES[key];
    const checked = state.spy.selectedCategories.includes(key);

    const item = document.createElement("div");
    item.className = "category-item" + (checked ? " checked" : "");

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
    count.textContent = cat.locations.length + " локаций";

    info.appendChild(name);
    info.appendChild(count);
    item.appendChild(box);
    item.appendChild(info);

    item.addEventListener("click", () => toggleSpyCategory(key));
    dom.spyCategoriesList.appendChild(item);
  });
}

function toggleSpyCategory(key) {
  const idx = state.spy.selectedCategories.indexOf(key);
  if (idx === -1) {
    state.spy.selectedCategories.push(key);
  } else {
    state.spy.selectedCategories.splice(idx, 1);
  }
  renderSpyCategories();
  clearSpyCategoriesError();
}

function clearSpyCategoriesError() {
  dom.spyCategoriesHint.classList.remove("error");
  dom.spyCategoriesHint.textContent = "Выберите хотя бы одну категорию";
}

function showSpyCategoriesError() {
  dom.spyCategoriesHint.classList.add("error");
  dom.spyCategoriesHint.textContent = "⚠️ Выберите хотя бы одну категорию!";
}

function renderSpyCustomCategoryOptions() {
  dom.spyCustomCategory.innerHTML = "";
  Object.keys(SPY_CATEGORIES).forEach((key) => {
    const opt = document.createElement("option");
    opt.value = key;
    opt.textContent = SPY_CATEGORIES[key].name;
    dom.spyCustomCategory.appendChild(opt);
  });
  const myOpt = document.createElement("option");
  myOpt.value = "custom";
  myOpt.textContent = "Мои локации";
  dom.spyCustomCategory.appendChild(myOpt);
}

function saveSpyCustomLocation() {
  const name = dom.spyCustomLocationInput.value.trim();
  const category = dom.spyCustomCategory.value;

  if (!name) {
    showToast("Введите название локации");
    return;
  }

  state.spy.customLocations.push({ name, category });
  try {
    localStorage.setItem(SPY_STORAGE_KEY, JSON.stringify(state.spy.customLocations));
  } catch (e) {}

  dom.spyCustomLocationInput.value = "";
  renderSpyCustomList();
  showToast("Локация сохранена!");
}

function renderSpyCustomList() {
  dom.spyCustomList.innerHTML = "";
  if (state.spy.customLocations.length === 0) return;

  state.spy.customLocations.forEach((loc, index) => {
    const item = document.createElement("div");
    item.className = "custom-item";

    const text = document.createElement("div");
    text.className = "custom-item-text";
    text.textContent = loc.name;

    const cat = document.createElement("span");
    cat.className = "custom-item-cat";
    cat.textContent = loc.category === "custom" ? "Мои" : SPY_CATEGORIES[loc.category]?.name || loc.category;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "custom-delete";
    del.textContent = "×";
    del.addEventListener("click", () => {
      state.spy.customLocations.splice(index, 1);
      try {
        localStorage.setItem(SPY_STORAGE_KEY, JSON.stringify(state.spy.customLocations));
      } catch (e) {}
      renderSpyCustomList();
    });

    item.appendChild(text);
    item.appendChild(cat);
    item.appendChild(del);
    dom.spyCustomList.appendChild(item);
  });
}

function buildSpyLocationPool() {
  const pool = [];
  state.spy.selectedCategories.forEach((key) => {
    const cat = SPY_CATEGORIES[key];
    if (cat) pool.push(...cat.locations);
  });

  state.spy.customLocations.forEach((loc) => {
    if (loc.category === "custom" || state.spy.selectedCategories.includes(loc.category)) {
      pool.push(loc.name);
    }
  });

  return pool;
}

function startSpyGame() {
  const pool = buildSpyLocationPool();
  if (pool.length === 0) {
    showSpyCategoriesError();
    return;
  }

  const names = collectSpyPlayerNames();
  state.spy.players = [];
  for (let i = 0; i < state.spy.playerCount; i++) {
    const name = names[i] && names[i].length > 0 ? names[i] : "Игрок " + (i + 1);
    state.spy.players.push({ name });
  }

  prepareSpyRound(pool);
  state.spy.round.currentIndex = 0;
  showScreen("spyPass");
  renderSpyPassScreen();
}

function prepareSpyRound(pool) {
  // Выбираем локацию без повторов подряд
  const usedSet = new Set(state.spy.usedLocations);
  let available = pool.filter((loc) => !usedSet.has(loc));
  if (available.length === 0) {
    state.spy.usedLocations = [];
    available = pool.slice();
  }

  const secretLocation = available[Math.floor(Math.random() * available.length)];
  state.spy.usedLocations.push(secretLocation);

  // Выбираем шпиона
  const count = state.spy.players.length;
  let spyIndex = Math.floor(Math.random() * count);
  let guard = 0;
  while (count > 2 && spyIndex === state.spy.lastSpyIndex && guard < 30) {
    spyIndex = Math.floor(Math.random() * count);
    guard++;
  }
  state.spy.lastSpyIndex = spyIndex;

  const roundPlayers = state.spy.players.map((p, i) => ({
    name: p.name,
    isSpy: i === spyIndex,
    location: i === spyIndex ? "" : secretLocation
  }));

  const firstIndex = Math.floor(Math.random() * count);

  state.spy.round = {
    players: roundPlayers,
    secretLocation,
    spyName: state.spy.players[spyIndex].name,
    firstPlayer: state.spy.players[firstIndex].name,
    currentIndex: 0
  };
}

function renderSpyPassScreen() {
  const player = state.spy.round.players[state.spy.round.currentIndex];
  dom.spyPassPlayerName.textContent = player.name;
}

function showSpyCurrentRole() {
  const player = state.spy.round.players[state.spy.round.currentIndex];
  dom.spyRolePlayerName.textContent = player.name;

  if (player.isSpy) {
    dom.spyRoleNormalCard.classList.add("hidden");
    dom.spyRoleSpyCard.classList.remove("hidden");
  } else {
    dom.spyRoleNormalCard.classList.remove("hidden");
    dom.spyRoleSpyCard.classList.add("hidden");
    dom.spyRoleLocation.textContent = player.location;
  }

  showScreen("spyRole");
}

function hideSpyRoleAndNext() {
  state.spy.round.currentIndex++;
  if (state.spy.round.currentIndex < state.spy.round.players.length) {
    renderSpyPassScreen();
    showScreen("spyPass");
  } else {
    dom.spyFirstPlayerName.textContent = state.spy.round.firstPlayer;
    showScreen("spyGame");
  }
}

function nextSpyRound() {
  const pool = buildSpyLocationPool();
  if (pool.length === 0) {
    showScreen("spySetup");
    return;
  }
  prepareSpyRound(pool);
  state.spy.round.currentIndex = 0;
  renderSpyPassScreen();
  showScreen("spyPass");
}

/* =========================================================
   5. МОДУЛЬ: МАФИЯ
   ========================================================= */
function changeMafiaPlayers(delta) {
  const next = state.mafia.playerCount + delta;
  if (next < MAFIA_MIN_PLAYERS || next > MAFIA_MAX_PLAYERS) return;
  state.mafia.playerCount = next;
  dom.mafiaPlayersCount.textContent = next;
  dom.mafiaNamesCount.textContent = next + " игроков";
  renderMafiaPlayerNames();
  updateMafiaCivilianCount();
}

function renderMafiaPlayerNames() {
  const existing = collectMafiaPlayerNames();
  dom.mafiaPlayersNames.innerHTML = "";

  for (let i = 0; i < state.mafia.playerCount; i++) {
    const row = document.createElement("div");
    row.className = "player-row";

    const idx = document.createElement("span");
    idx.className = "player-index";
    idx.textContent = i + 1;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "input";
    input.placeholder = "Игрок " + (i + 1);
    input.value = existing[i] || "";
    input.autocomplete = "off";

    row.appendChild(idx);
    row.appendChild(input);
    dom.mafiaPlayersNames.appendChild(row);
  }
}

function collectMafiaPlayerNames() {
  const inputs = dom.mafiaPlayersNames.querySelectorAll("input");
  return Array.from(inputs).map((inp) => inp.value.trim());
}

function renderMafiaRolesConfig() {
  dom.mafiaRolesConfig.innerHTML = "";
  const roleKeys = ["don", "mafia", "sheriff", "doctor", "prostitute", "killer", "suicide"];

  roleKeys.forEach((key) => {
    const role = MAFIA_ROLES[key];
    const currentCount = state.mafia.roleCounts[key] || 0;

    const row = document.createElement("div");
    row.className = "role-config-row";

    const info = document.createElement("div");
    info.className = "role-config-info";

    const icon = document.createElement("div");
    icon.className = "role-config-icon";
    icon.textContent = role.icon;

    const details = document.createElement("div");
    details.className = "role-config-details";

    const name = document.createElement("div");
    name.className = "role-config-name";
    name.textContent = role.name;

    const team = document.createElement("span");
    team.className = "role-config-team " + role.teamClass;
    team.textContent = role.teamName;

    details.appendChild(name);
    details.appendChild(team);
    info.appendChild(icon);
    info.appendChild(details);

    const stepper = document.createElement("div");
    stepper.className = "mini-stepper";

    const minusBtn = document.createElement("button");
    minusBtn.type = "button";
    minusBtn.className = "mini-stepper-btn";
    minusBtn.textContent = "−";
    minusBtn.disabled = currentCount <= 0;
    minusBtn.addEventListener("click", () => changeRoleCount(key, -1));

    const valSpan = document.createElement("span");
    valSpan.className = "mini-stepper-value";
    valSpan.textContent = currentCount;

    const plusBtn = document.createElement("button");
    plusBtn.type = "button";
    plusBtn.className = "mini-stepper-btn";
    plusBtn.textContent = "+";
    plusBtn.disabled = currentCount >= role.max;
    plusBtn.addEventListener("click", () => changeRoleCount(key, 1));

    stepper.appendChild(minusBtn);
    stepper.appendChild(valSpan);
    stepper.appendChild(plusBtn);

    row.appendChild(info);
    row.appendChild(stepper);
    dom.mafiaRolesConfig.appendChild(row);
  });
}

function changeRoleCount(roleKey, delta) {
  const role = MAFIA_ROLES[roleKey];
  if (!role) return;
  const cur = state.mafia.roleCounts[roleKey] || 0;
  const next = cur + delta;
  if (next < 0 || next > role.max) return;

  state.mafia.roleCounts[roleKey] = next;
  renderMafiaRolesConfig();
  updateMafiaCivilianCount();
}

function updateMafiaCivilianCount() {
  const totalPlayers = state.mafia.playerCount;
  let specialRolesCount = 0;
  Object.keys(state.mafia.roleCounts).forEach((key) => {
    specialRolesCount += state.mafia.roleCounts[key] || 0;
  });

  const civilians = totalPlayers - specialRolesCount;
  dom.mafiaCivilianCount.textContent = civilians;

  if (civilians < 0) {
    dom.mafiaCiviliansBox.classList.add("error");
    dom.mafiaRolesError.classList.remove("hidden");
    dom.mafiaStartBtn.disabled = true;
  } else {
    dom.mafiaCiviliansBox.classList.remove("error");
    dom.mafiaRolesError.classList.add("hidden");
    dom.mafiaStartBtn.disabled = false;
  }
}

function startMafiaGame() {
  const totalPlayers = state.mafia.playerCount;
  let specialRolesCount = 0;
  Object.keys(state.mafia.roleCounts).forEach((key) => {
    specialRolesCount += state.mafia.roleCounts[key] || 0;
  });

  const civiliansCount = totalPlayers - specialRolesCount;
  if (civiliansCount < 0) {
    showToast("Слишком много спец-ролей!");
    return;
  }

  const rolesPool = [];
  Object.keys(state.mafia.roleCounts).forEach((key) => {
    const count = state.mafia.roleCounts[key];
    for (let i = 0; i < count; i++) rolesPool.push(MAFIA_ROLES[key]);
  });
  for (let i = 0; i < civiliansCount; i++) rolesPool.push(MAFIA_ROLES.civilian);

  const shuffledRoles = shuffleArray(rolesPool);
  const enteredNames = collectMafiaPlayerNames();
  const gamePlayers = [];

  for (let i = 0; i < totalPlayers; i++) {
    const pName = enteredNames[i] && enteredNames[i].length > 0 ? enteredNames[i] : "Игрок " + (i + 1);
    gamePlayers.push({
      id: i + 1,
      name: pName,
      role: shuffledRoles[i],
      isAlive: true
    });
  }

  state.mafia.game = {
    players: gamePlayers,
    currentIndex: 0,
    isCardRevealed: false,
    isNight: true,
    nightCount: 1,
    dayCount: 0,
    notes: state.mafia.game.notes || ""
  };

  showScreen("mafiaReveal");
  renderMafiaRevealStep();
}

function renderMafiaRevealStep() {
  const game = state.mafia.game;
  const player = game.players[game.currentIndex];
  if (!player) return;

  dom.mafiaRevealProgress.textContent = `Игрок ${game.currentIndex + 1} из ${game.players.length}`;
  dom.mafiaRevealPlayerName.textContent = player.name;

  game.isCardRevealed = false;
  dom.mafiaRoleCard.classList.remove("revealed");
  dom.mafiaCardFront.classList.remove("team-mafia", "team-peace", "team-neutral");

  const role = player.role;
  dom.mafiaRoleIcon.textContent = role.icon;
  dom.mafiaRoleName.textContent = role.name;
  dom.mafiaRoleDesc.textContent = role.desc;
  dom.mafiaRoleTeamBadge.textContent = role.teamName;
  dom.mafiaRoleTeamBadge.className = "role-team-pill " + role.teamClass;

  if (role.team === "mafia") dom.mafiaCardFront.classList.add("team-mafia");
  else if (role.team === "neutral") dom.mafiaCardFront.classList.add("team-neutral");
  else dom.mafiaCardFront.classList.add("team-peace");

  dom.mafiaToggleRoleBtn.classList.remove("hidden");
  dom.mafiaToggleRoleBtn.textContent = "Посмотреть роль";
  dom.mafiaPassNextBtn.classList.add("hidden");
}

function toggleMafiaCard() {
  const game = state.mafia.game;
  if (!game.isCardRevealed) {
    game.isCardRevealed = true;
    dom.mafiaRoleCard.classList.add("revealed");
    dom.mafiaToggleRoleBtn.classList.add("hidden");
    dom.mafiaPassNextBtn.classList.remove("hidden");
  }
}

function passMafiaToNextPlayer() {
  const game = state.mafia.game;
  dom.mafiaRoleCard.classList.remove("revealed");
  game.isCardRevealed = false;
  game.currentIndex++;

  if (game.currentIndex < game.players.length) {
    setTimeout(() => renderMafiaRevealStep(), 200);
  } else {
    setTimeout(() => showScreen("mafiaHandoff"), 250);
  }
}

function renderMafiaHostPanel() {
  const game = state.mafia.game;
  updateMafiaPhaseUI();
  updateMafiaStats();

  dom.mafiaHostPlayersList.innerHTML = "";

  game.players.forEach((player, index) => {
    const row = document.createElement("div");
    row.className = "host-player-row" + (player.isAlive ? "" : " dead");

    const left = document.createElement("div");
    left.className = "host-player-left";

    const idx = document.createElement("span");
    idx.className = "host-player-idx";
    idx.textContent = index + 1;

    const info = document.createElement("div");
    info.className = "host-player-info";

    const name = document.createElement("div");
    name.className = "host-player-name";
    name.textContent = player.name;

    const roleLine = document.createElement("div");
    roleLine.className = "host-player-role-line";

    const roleName = document.createElement("span");
    roleName.className = "host-role-name";
    roleName.textContent = player.role.icon + " " + player.role.name;

    const teamBadge = document.createElement("span");
    teamBadge.className = "host-team-badge " + player.role.teamClass;
    teamBadge.textContent = player.role.teamName;

    roleLine.appendChild(roleName);
    roleLine.appendChild(teamBadge);
    info.appendChild(name);
    info.appendChild(roleLine);

    left.appendChild(idx);
    left.appendChild(info);

    const statusBtn = document.createElement("button");
    statusBtn.type = "button";
    statusBtn.className = "status-toggle-btn " + (player.isAlive ? "status-alive" : "status-dead");
    statusBtn.textContent = player.isAlive ? "✓ Жив" : "💀 Убит";
    statusBtn.addEventListener("click", () => {
      player.isAlive = !player.isAlive;
      renderMafiaHostPanel();
    });

    row.appendChild(left);
    row.appendChild(statusBtn);
    dom.mafiaHostPlayersList.appendChild(row);
  });
}

function updateMafiaStats() {
  const game = state.mafia.game;
  const aliveTotal = game.players.filter((p) => p.isAlive).length;
  const aliveMafia = game.players.filter((p) => p.isAlive && p.role.team === "mafia").length;
  const alivePeace = game.players.filter((p) => p.isAlive && p.role.team !== "mafia").length;

  dom.statAliveTotal.textContent = aliveTotal;
  dom.statAliveMafia.textContent = aliveMafia;
  dom.statAlivePeace.textContent = alivePeace;
}

function toggleMafiaPhase() {
  const game = state.mafia.game;
  game.isNight = !game.isNight;
  if (game.isNight) game.nightCount++;
  else game.dayCount++;
  updateMafiaPhaseUI();
}

function updateMafiaPhaseUI() {
  const game = state.mafia.game;
  if (game.isNight) {
    dom.mafiaPhaseToggleBtn.className = "phase-toggle-btn phase-night";
    dom.mafiaPhaseIcon.textContent = "🌙";
    dom.mafiaPhaseText.textContent = "Сейчас НОЧЬ";
    dom.mafiaGamePhaseLabel.textContent = `Фаза: Ночь ${game.nightCount}`;
  } else {
    dom.mafiaPhaseToggleBtn.className = "phase-toggle-btn phase-day";
    dom.mafiaPhaseIcon.textContent = "☀️";
    dom.mafiaPhaseText.textContent = "Сейчас ДЕНЬ";
    dom.mafiaGamePhaseLabel.textContent = `Фаза: День ${game.dayCount}`;
  }
}

function confirmEndMafiaGame() {
  if (confirm("Завершить текущую игру в Мафию и вернуться в главное меню?")) {
    showScreen("menu");
  }
}

/* =========================================================
   6. МОДУЛЬ: ИГРА «ЭЛИАС» (ALIAS)
   ========================================================= */
function changeAliasTeams(delta) {
  const next = state.alias.teamCount + delta;
  if (next < 2 || next > 4) return;
  state.alias.teamCount = next;
  dom.aliasTeamsCount.textContent = next;
  renderAliasTeamInputs();
}

function renderAliasTeamInputs() {
  const existing = collectAliasTeamNames();
  dom.aliasTeamsInputs.innerHTML = "";

  for (let i = 0; i < state.alias.teamCount; i++) {
    const row = document.createElement("div");
    row.className = "player-row";

    const idx = document.createElement("span");
    idx.className = "player-index";
    idx.textContent = i + 1;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "input";
    input.placeholder = "Команда " + (i + 1);
    input.value = existing[i] || "";
    input.autocomplete = "off";

    row.appendChild(idx);
    row.appendChild(input);
    dom.aliasTeamsInputs.appendChild(row);
  }
}

function collectAliasTeamNames() {
  const inputs = dom.aliasTeamsInputs.querySelectorAll("input");
  return Array.from(inputs).map((inp) => inp.value.trim());
}

function startAliasMatch() {
  const enteredNames = collectAliasTeamNames();
  const teams = [];

  for (let i = 0; i < state.alias.teamCount; i++) {
    const name = enteredNames[i] && enteredNames[i].length > 0 ? enteredNames[i] : "Команда " + (i + 1);
    teams.push({ name, score: 0 });
  }

  // Создаем перемешанную колоду слов для выбранного уровня
  const sourceWords = ALIAS_WORDS[state.alias.difficulty] || ALIAS_WORDS.easy;
  const deck = shuffleArray(sourceWords);

  state.alias.game = {
    teams,
    currentTeamIndex: 0,
    deck,
    currentWord: "",
    roundWords: [],
    timerSeconds: state.alias.roundTime,
    timerInterval: null,
    roundScore: 0
  };

  showScreen("aliasReady");
  renderAliasReadyScreen();
}

function renderAliasReadyScreen() {
  const game = state.alias.game;
  const currentTeam = game.teams[game.currentTeamIndex];

  dom.aliasReadyTeamName.textContent = currentTeam.name;
  dom.aliasReadyTargetInfo.textContent = `Цель: ${state.alias.targetScore} очков`;

  // Рендер таблицы счёта
  dom.aliasReadyScoreboard.innerHTML = "";

  // Сортировка для отображения рангов
  const sorted = game.teams.slice().sort((a, b) => b.score - a.score);

  game.teams.forEach((t) => {
    const rank = sorted.indexOf(t) + 1;
    const isCurrent = t === currentTeam;

    const row = document.createElement("div");
    row.className = "alias-scoreboard-row" + (isCurrent ? " active-team" : "");

    // Прогресс-бар
    const progress = Math.min(100, Math.max(0, (t.score / state.alias.targetScore) * 100));
    const progressBar = document.createElement("div");
    progressBar.className = "alias-scoreboard-progress";
    progressBar.style.width = progress + "%";
    row.appendChild(progressBar);

    const info = document.createElement("div");
    info.className = "alias-scoreboard-info";

    const rankSpan = document.createElement("span");
    rankSpan.className = "alias-team-rank";
    rankSpan.textContent = "#" + rank;

    const nameSpan = document.createElement("span");
    nameSpan.className = "alias-team-name-text";
    nameSpan.textContent = t.name + (isCurrent ? " (ходит)" : "");

    info.appendChild(rankSpan);
    info.appendChild(nameSpan);

    const scoreBadge = document.createElement("span");
    scoreBadge.className = "alias-team-score-badge";
    scoreBadge.textContent = t.score;

    row.appendChild(info);
    row.appendChild(scoreBadge);

    dom.aliasReadyScoreboard.appendChild(row);
  });
}

function startAliasRound() {
  const game = state.alias.game;
  const currentTeam = game.teams[game.currentTeamIndex];

  // Сброс раунда
  game.timerSeconds = state.alias.roundTime;
  game.roundWords = [];
  game.roundScore = 0;

  dom.aliasGameTeamPill.textContent = currentTeam.name;
  dom.aliasGameScoreBadge.textContent = "+0";
  dom.aliasGameTimer.textContent = game.timerSeconds;
  dom.aliasGameTimer.classList.remove("alias-timer-warning");

  // Сложность на карточке
  const diffLabels = { easy: "🟢 Легкое слово", medium: "🟡 Среднее слово", hard: "🔴 Сложное слово" };
  dom.aliasWordDiffLabel.textContent = diffLabels[state.alias.difficulty] || "Слово";

  // Выдаем первое слово
  drawNextAliasWord();

  showScreen("aliasGame");

  // Запуск таймера
  clearInterval(game.timerInterval);
  game.timerInterval = setInterval(() => {
    game.timerSeconds--;
    dom.aliasGameTimer.textContent = game.timerSeconds;

    if (game.timerSeconds <= 10) {
      dom.aliasGameTimer.classList.add("alias-timer-warning");
    }

    if (game.timerSeconds <= 0) {
      finishAliasRound();
    }
  }, 1000);
}

function drawNextAliasWord() {
  const game = state.alias.game;

  // Если колода закончилась — перетасовываем заново
  if (game.deck.length === 0) {
    const sourceWords = ALIAS_WORDS[state.alias.difficulty] || ALIAS_WORDS.easy;
    game.deck = shuffleArray(sourceWords);
  }

  game.currentWord = game.deck.pop();
  dom.aliasWordText.textContent = game.currentWord;

  // Анимация смены слова
  dom.aliasWordCard.classList.remove("anim-pop");
  void dom.aliasWordCard.offsetWidth; // trigger reflow
  dom.aliasWordCard.classList.add("anim-pop");
}

function handleAliasAnswer(isCorrect) {
  const game = state.alias.game;
  if (!game.currentWord) return;

  // Записываем результат слова
  game.roundWords.push({
    word: game.currentWord,
    isCorrect: isCorrect
  });

  // Обновляем текущий счёт раунда
  if (isCorrect) {
    game.roundScore++;
  } else if (state.alias.penaltyEnabled) {
    game.roundScore--;
  }

  const sign = game.roundScore > 0 ? "+" : "";
  dom.aliasGameScoreBadge.textContent = sign + game.roundScore;

  drawNextAliasWord();
}

function finishAliasRound() {
  const game = state.alias.game;
  clearInterval(game.timerInterval);

  showScreen("aliasReview");
  renderAliasReviewScreen();
}

function renderAliasReviewScreen() {
  const game = state.alias.game;
  const currentTeam = game.teams[game.currentTeamIndex];

  dom.aliasReviewSubtitle.textContent = currentTeam.name;
  dom.aliasReviewWordsList.innerHTML = "";

  if (game.roundWords.length === 0) {
    const emptyRow = document.createElement("p");
    emptyRow.className = "hint";
    emptyRow.textContent = "В этом раунде не было ответов";
    dom.aliasReviewWordsList.appendChild(emptyRow);
  } else {
    game.roundWords.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "alias-review-row";

      const wordSpan = document.createElement("span");
      wordSpan.className = "alias-review-word";
      wordSpan.textContent = item.word;

      const badge = document.createElement("button");
      badge.type = "button";
      badge.className = "alias-review-status-badge " + (item.isCorrect ? "status-correct" : "status-skip");
      badge.textContent = item.isCorrect ? "✓ Угадано" : "× Пропуск";

      // Возможность ведущему исправить статус слова кликом
      row.addEventListener("click", () => {
        item.isCorrect = !item.isCorrect;
        badge.className = "alias-review-status-badge " + (item.isCorrect ? "status-correct" : "status-skip");
        badge.textContent = item.isCorrect ? "✓ Угадано" : "× Пропуск";
        recalculateAliasReviewScore();
      });

      row.appendChild(wordSpan);
      row.appendChild(badge);
      dom.aliasReviewWordsList.appendChild(row);
    });
  }

  recalculateAliasReviewScore();
}

function recalculateAliasReviewScore() {
  const game = state.alias.game;
  let correctCount = 0;
  let skipCount = 0;

  game.roundWords.forEach((w) => {
    if (w.isCorrect) correctCount++;
    else skipCount++;
  });

  const penalty = state.alias.penaltyEnabled ? skipCount : 0;
  const netScore = correctCount - penalty;
  game.roundScore = netScore;

  const sign = netScore > 0 ? "+" : "";
  dom.aliasReviewRoundScore.textContent = sign + netScore;
}

function confirmAliasRoundReview() {
  const game = state.alias.game;
  const currentTeam = game.teams[game.currentTeamIndex];

  // Применяем счёт раунда к общему счёту команды (не опускаем ниже 0)
  currentTeam.score = Math.max(0, currentTeam.score + game.roundScore);

  // Проверяем победу
  const winner = game.teams.find((t) => t.score >= state.alias.targetScore);
  if (winner) {
    showAliasWinnerScreen(winner);
  } else {
    // Передаем ход следующей команде
    game.currentTeamIndex = (game.currentTeamIndex + 1) % game.teams.length;
    showScreen("aliasReady");
    renderAliasReadyScreen();
  }
}

function showAliasWinnerScreen(winnerTeam) {
  dom.aliasWinnerTeamName.textContent = winnerTeam.name;
  dom.aliasWinnerScoreboard.innerHTML = "";

  const sorted = state.alias.game.teams.slice().sort((a, b) => b.score - a.score);

  sorted.forEach((t, i) => {
    const row = document.createElement("div");
    row.className = "alias-scoreboard-row" + (t === winnerTeam ? " active-team" : "");

    const info = document.createElement("div");
    info.className = "alias-scoreboard-info";

    const rankSpan = document.createElement("span");
    rankSpan.className = "alias-team-rank";
    rankSpan.textContent = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "#" + (i + 1);

    const nameSpan = document.createElement("span");
    nameSpan.className = "alias-team-name-text";
    nameSpan.textContent = t.name;

    info.appendChild(rankSpan);
    info.appendChild(nameSpan);

    const scoreBadge = document.createElement("span");
    scoreBadge.className = "alias-team-score-badge";
    scoreBadge.textContent = t.score + " очков";

    row.appendChild(info);
    row.appendChild(scoreBadge);
    dom.aliasWinnerScoreboard.appendChild(row);
  });

  showScreen("aliasWinner");
}

/* =========================================================
   СТАРТ
   ========================================================= */
document.addEventListener("DOMContentLoaded", init);
