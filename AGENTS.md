# AGENTS.md — Travel Wonders

> Codex читает этот файл перед каждой задачей. Здесь лежит ДУРABLE-контекст:
> продукт, контракты данных и правила. В запросе ты ссылаешься на одну часть
> из `parts/`, а контракты тянутся отсюда автоматически — не вставляй их руками.

## Продукт
Личный атлас + доска мечты + планировщик самых красивых мест Земли.
Маховик: Мечтаю (vision board) → Решаю (вердикт «стоит ли ехать мне») →
Планирую (маршрут, с друзьями) → Еду → Коллекционирую → Делюсь (клонируемый борд).
Ядро = vision board (высокочастотный объект) + персональный вердикт (наш клин).

## Стек
- Frontend: статический `public/atlas.html` + Leaflet + Tailwind CDN; основной app-shell в Vite/TanStack Start.
- Backend: нет в текущем MVP, персональные данные хранятся в `localStorage`.
- БД: нет; текущий датасет встроен в `public/atlas.html`.
- Тесты/проверки: ESLint, Vite build, локальная проверка `atlas.html`.

## Команды (Codex прогоняет их перед завершением задачи)
- Установка: `npm install` (только если зависимости отсутствуют).
- Линт: `npm run lint`.
- Сборка: `npm run build`.
- Локальный статический preview: `node scripts/serve-preview.mjs 5178`.

## Правила работы
1. Контракты типов ниже — единственный источник истины. Не выдумывай свои поля и
   не меняй схему без явного запроса в промпте.
2. Один запрос = один вертикальный срез одной части. Не трогай соседние части.
3. Test-first: сначала падающие тесты, потом реализация до зелёного. Тесты не менять.
4. Для сложных частей сперва выдай план, дождись «ок», только потом код.
5. Definition of done каждой части — внутри её файла в `parts/`.

## Контракты данных (компактно; полная версия — contracts.md)
```ts
type Coordinates = { lat: number; lng: number };

interface Place {
  id: string; name: string; country: string; region: string;
  coordinates: Coordinates; type: string; category: string;
  unesco: boolean; sourceRanking?: number;
  aesthetic: { vibeTags: string[]; palette: string[]; heroPhoto: string };
  decision: { shortVerdict: string; whySpecial: string[];
              bestMonths: number[]; worstMonths: number[]; timeNeeded: string };
  logistics: { nearestAirport: string; nearestCity: string; accessType: string;
               transport: string[]; requiresGuide: boolean; permitNeeded: boolean };
  scores: { beauty: number; uniqueness: number; accessibility: number;
            family: number; safety: number; cost: number; hypeVsReality: number;
            opinionDistribution?: Record<string, number> };   // 1..10
  safety: { crimeRisk: string; medicalAccess: string; roadRisk: string;
            naturalRisk: string; emergencyNotes: string; lastUpdated: string };
  family: { childFriendly: 'yes'|'caution'|'no'; strollerFriendly: boolean;
            heatRisk: boolean; waterRisk: boolean; heightRisk: boolean;
            recommendedAge?: number };
  content: { description: string; photos: string[]; userTips: string[];
             officialLinks: string[]; wikipediaLink?: string };
}

interface TasteProfile {            // выход квиза (Part 2)
  archetype: string;                // напр. "Remote Wilderness Seeker"
  tags: string[];                   // предпочтения по vibe
  constraints: { withKids: boolean; budget: 'low'|'mid'|'high';
                 riskTolerance: 'low'|'mid'|'high' };
}

interface Verdict {                 // выход decision-движка (Part 3)
  placeId: string; profileId: string;
  badge: 'must_see'|'worth_detour'|'hidden_gem'|'overrated'|'hard_adventure';
  reasons: string[]; personalized: boolean;
}

type BoardItemStatus = 'dream'|'planning'|'going'|'visited';
interface BoardItem { placeId: string; status: BoardItemStatus; note?: string; addedAt: string }
interface Board {
  id: string; ownerId: string; title: string; theme?: string;
  collaborators: string[]; items: BoardItem[]; coverLayout?: unknown;
}

interface User { id: string; name: string; profile?: TasteProfile;
                 visited: string[]; boards: string[] }
```
