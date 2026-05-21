# Part 3 — Decision-движок «Стоит ли ехать»  (V1)

**Цель:** наш клин — персональный вердикт под профиль пользователя.
**Зависит от:** contracts: `Place.scores`, `TasteProfile` → `Verdict`.
**Контракт вход → выход:** `(place, profile)` → `Verdict` (badge + reasons + personalized).
**Собрать:**
- Чистая функция `computeVerdict(place, profile): Verdict` (без UI, без БД).
- Два слоя: объективная логистика (факты) vs субъективные scores; правила бейджа.
- Персонализация: один и тот же place → разный badge для withKids vs соло.
- Блок вердикта в карточке (Part 1) с раскрытием «почему этот бейдж».
**Definition of done:** табличные тесты — набор (place, profile) → ожидаемый badge; смена `constraints.withKids` меняет вердикт.
**Не загружать:** борд, маршруты, AI.
