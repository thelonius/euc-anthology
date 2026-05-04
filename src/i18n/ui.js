// UI dictionary. Keys are Russian source strings (gettext-style).
// Missing key falls back to the key itself (i.e. Russian source).

export const UI = {
  en: {
    // Sidebar branding. The Russian title splits across two lines
    // ("Моноколесо" / "Изнутри"); in English the natural order is
    // "Inside / the Wheel" with the cyan accent on the bottom line.
    'Антология': 'Anthology',
    'Моноколесо': 'Inside',
    'Изнутри': 'the Wheel',

    // Parts
    'Часть I · Тело': 'Part I · The Body',
    'Часть II · Архитектура': 'Part II · Architecture',
    'Часть III · Управление': 'Part III · Control',
    'Часть IV · Границы': 'Part IV · Limits',
    'Часть V · Практика': 'Part V · Practice',

    // Chapter labels
    'Пролог': 'Prologue',
    'Глава I': 'Chapter I',
    'Глава II': 'Chapter II',
    'Глава III': 'Chapter III',
    'Глава IV': 'Chapter IV',
    'Глава V': 'Chapter V',
    'Глава VI': 'Chapter VI',
    'Глава VII': 'Chapter VII',
    'Глава VIII': 'Chapter VIII',
    'Глава IX': 'Chapter IX',
    'Глава X': 'Chapter X',
    'Глава XI': 'Chapter XI',
    'Глава XII': 'Chapter XII',
    'Глава XIII': 'Chapter XIII',
    'Глава XIV': 'Chapter XIV',

    // Chapter subtitles
    'Падение': 'The Fall',
    'Железо': 'Hardware',
    'Чувства': 'Senses',
    'Пробуждение': 'Awakening',
    'Состояния': 'States',
    'Цикл': 'The Loop',
    'Карта': 'The Map',
    'Равновесие': 'Balance',
    'Поток': 'The Flux',
    'Наблюдатель': 'The Observer',
    'Инжекция': 'Injection',
    'Ослабление': 'Weakening',
    'Тепло': 'Heat',
    'Голос': 'The Voice',
    'Ремесло': 'The Craft',

    // Header buttons / tooltips
    'Скопировать ссылку на эту главу': 'Copy link to this chapter',
    '🔗 Ссылка': '🔗 Link',
    '✓ Скопировано': '✓ Copied',

    // Glossary tooltip footer
    'ЗАФИКСИРОВАНО · ESC чтобы закрыть': 'PINNED · ESC TO CLOSE',
    'КЛИК ЧТОБЫ ЗАФИКСИРОВАТЬ': 'CLICK TO PIN',
    'копировать': 'copy',
    '✓ скопировано': '✓ copied',

    // Translation-pending badge
    'Перевод в работе': 'Translation in progress',
    'Эта глава пока доступна только на русском. Английская версия в работе.':
      'This chapter is only available in Russian for now. The English version is in progress.',

    // Document title and meta tags
    'Моноколесо Изнутри · Антология прошивки EUC':
      'Inside the EUC · A Firmware Anthology',
    'Моноколесо Изнутри': 'Inside the EUC',
    'Моноколесо Изнутри — интерактивная антология прошивки EUC: STM32, FOC, IMU, BLE-телеметрия на примере Begode ET Max.':
      'Inside the EUC — an interactive anthology of EUC firmware: STM32, FOC, IMU, BLE telemetry through the Begode ET Max.',
    'Антология реверс-инжиниринга прошивки электрического моноколеса. 14 глав, интерактивные симуляторы, реальный декомпилированный код.':
      'A reverse-engineering anthology of electric unicycle firmware. 14 chapters, interactive simulators, real decompiled code.',
  },
}
