# Part 0 — Контракты данных (полная версия)

Загружай этот файл ТОЛЬКО когда строишь слой данных / БД / миграции.
В остальных частях достаточно компактной версии из `AGENTS.md`.

Содержит полную схему `Place`, `User`, `Board`, `BoardItem`, `TasteProfile`,
`Verdict` (см. AGENTS.md) плюс заметки по хранению:

- `scores.*` — целые 1..10. `opinionDistribution` — гистограмма мнений сообщества,
  заполняется со временем; на старте можно null.
- `safety.lastUpdated` — ISO-дата; в UI показывать «актуально на …».
- `decision.bestMonths/worstMonths` — номера месяцев 1..12.
- `BoardItem.status` — это и есть воронка по месту (dream→planning→going→visited).
- `Verdict` НЕ хранится в `Place`: вычисляется из `Place.scores` + `TasteProfile`
  (Part 3). Можно кэшировать по ключу (placeId, profileHash).
- Индексы, которые понадобятся: Place(coordinates) для Nearby (Part 8),
  Place(decision.bestMonths) для триггеров сезона (Part 7), Board(ownerId),
  Board(collaborators) для совместных бордов (Part 6).

Definition of done для Part 0: схема создана, миграции применяются, есть сидинг
20–30 тестовых мест с заполненными scores/decision/safety.
