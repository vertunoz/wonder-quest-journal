import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT = path.resolve(import.meta.dirname, "..");
const HTML_PATH = path.join(ROOT, "public", "atlas.html");
const QA_REPORT_PATH = path.join(ROOT, "atlas-data-qa-report.csv");
const USER_AGENT = "WonderQuestJournal/1.0 (https://github.com/vertunoz/wonder-quest-journal)";

const ANCIENT_LIGHTHOUSE = {
  name: "Александрийский маяк",
  lat: 31.2139,
  lng: 29.8856,
  country: "Египет",
  category: "engineering",
  kind: "human",
  en: "Lighthouse of Alexandria",
  wikiEnTitle: "Lighthouse of Alexandria",
  wikiRuTitle: "Александрийский маяк",
  tags: ["ancient7"],
};

const RU_NAME_OVERRIDES = {
  "Pyramids of Giza": "Пирамиды Гизы",
  "Hanging Gardens of Babylon": "Висячие сады Семирамиды",
  "Statue of Zeus at Olympia": "Статуя Зевса в Олимпии",
  "Temple of Artemis at Ephesus": "Храм Артемиды в Эфесе",
  "Mausoleum at Halicarnassus": "Мавзолей в Галикарнасе",
  "Colossus of Rhodes": "Колосс Родосский",
  "Lighthouse of Alexandria": "Александрийский маяк",
  "Xinjiang Tianshan": "Синьцзян-Тяньшань",
  "Qinghai Hoh Xil": "Цинхай Хох-Сил",
  "Stevns Klint": "Стевнс-Клинт",
  "Great Himalayan National Park Conservation Area": "Национальный парк Грейт-Хималаян",
  "El Pinacate and Gran Desierto de Altar Biosphere Reserve":
    "Биосферный резерват Эль-Пинакате и Гран-Десьерто-де-Алтар",
  "Mount Hamiguitan Range Wildlife Sanctuary": "Заповедник хребта Хамигитан",
  "Trang An Landscape Complex": "Ландшафтный комплекс Чанган",
  "Landscapes of Dauria": "Ландшафты Даурии",
  "Mbanza Kongo, Vestiges of the Capital of the former Kingdom of Kongo":
    "Мбанза-Конго, остатки столицы бывшего королевства Конго",
  "Rio de Janeiro: Carioca Landscapes between the Mountain and the Sea":
    "Рио-де-Жанейро: ландшафты кариока между горами и морем",
  "Valongo Wharf Archaeological Site": "Археологический объект Причал Валонгу",
  "Cidade Velha, Historic Centre of Ribeira Grande":
    "Сидади-Велья, исторический центр Рибейра-Гранде",
  "Temple Zone of Sambor Prei Kuk, Archaeological Site of Ancient Ishanapura":
    "Храмовая зона Самбор-Прей-Кук, археологический памятник древней Ишанапуры",
  "Landscape of Grand Pré": "Ландшафт Гран-Пре",
  "Cultural Landscape of Honghe Hani Rice Terraces":
    "Культурный ландшафт рисовых террас хани в Хунхэ",
  "West Lake Cultural Landscape of Hangzhou": "Культурный ландшафт озера Сиху в Ханчжоу",
  "Site of Xanadu": "Памятник Шанду",
  "The Grand Canal": "Великий канал",
  "Kulangsu, a Historic International Settlement": "Кулансу, историческое международное поселение",
  "Precolumbian Chiefdom Settlements with Stone Spheres of the Diquís":
    "Доколумбовы поселения вождей с каменными сферами Дикиса",
  "Historic Monuments and Sites in Kaesong": "Исторические памятники и места Кэсона",
  "Kujataa Greenland: Norse and Inuit Farming at the Edge of the Ice Cap":
    "Куятаа в Гренландии: норвежское и инуитское земледелие у края ледникового щита",
  "Asmara: A Modernist African City": "Асмэра: модернистский город Африки",
  "From the Great Saltworks of Salins-les-Bains to the Royal Saltworks of Arc-et-Senans, the Production of Open-pan Salt":
    "От больших солеварен Сален-ле-Бен до королевских солеварен Арк-э-Сенан",
  "Strasbourg, Grande-Île and Neustadt": "Страсбург, Гранд-Иль и Нойштадт",
  "Nord-Pas de Calais Mining Basin": "Горнодобывающий бассейн Нор-Па-де-Кале",
  "Decorated Cave of Pont d’Arc, known as Grotte Chauvet-Pont d’Arc, Ardèche":
    "Пещера Пон-д’Арк, известная как Шове-Пон-д’Арк",
  "Bauhaus and its Sites in Weimar, Dessau and Bernau":
    "Баухаус и его памятники в Веймаре, Дессау и Бернау",
  "Rani-ki-Vav (the Queen’s Stepwell) at Patan, Gujarat":
    "Рани-ки-Вав, ступенчатый колодец королевы в Патане",
  "Cultural Landscape of Bali Province: the Subak System as a Manifestation of the Tri Hita Karana Philosophy":
    "Культурный ландшафт Бали: система субак и философия Три Хита Карана",
  "Shushtar Historical Hydraulic System": "Историческая гидравлическая система Шуштара",
  "Masjed-e Jāmé of Isfahan": "Соборная мечеть Исфахана",
  "Historic City of Yazd": "Исторический город Йезд",
  "Medici Villas and Gardens in Tuscany": "Виллы и сады Медичи в Тоскане",
  "Sacred Island of Okinoshima and Associated Sites in the Munakata Region":
    "Священный остров Окиносима и связанные объекты региона Мунаката",
  "Rachid Karami International Fair-Tripoli": "Международная ярмарка Рашида Караме в Триполи",
  "Rabat, Modern Capital and Historic City: a Shared Heritage":
    "Рабат, современная столица и исторический город",
  "Rock Islands Southern Lagoon": "Южная лагуна Скалистых островов",
  "Wieliczka and Bochnia Royal Salt Mines": "Королевские соляные шахты Величка и Бохня",
  "Tarnowskie Góry Lead-Silver-Zinc Mine and its Underground Water Management System":
    "Свинцово-серебряно-цинковая шахта Тарновске-Гуры и подземная система водоотведения",
  "University of Coimbra – Alta and Sofia": "Университет Коимбры, Алта и София",
  "Al Zubarah Archaeological Site": "Археологический объект Аль-Зубара",
  "Bolgar Historical and Archaeological Complex": "Болгарский историко-археологический комплекс",
  "Assumption Cathedral and Monastery of the town-island of Sviyazhsk":
    "Успенский собор и монастырь острова-града Свияжск",
  "Saloum Delta": "Дельта Салума",
  "Bassari Country: Bassari, Fula and Bedik Cultural Landscapes":
    "Страна бассари: культурные ландшафты бассари, фула и бедик",
  "Levoča, Spišský Hrad and the Associated Cultural Monuments":
    "Левоча, Спишский Град и связанные культурные памятники",
  "ǂKhomani Cultural Landscape": "Культурный ландшафт кхомани",
  "Cathedral, Alcázar and Archivo de Indias in Seville": "Севильский собор, Алькасар и Архив Индий",
  "Hebron/Al-Khalil Old Town": "Старый город Хеврона / Аль-Халиля",
  "Decorated Farmhouses of Hälsingland": "Расписные фермерские дома Хельсингланда",
  "La Chaux-de-Fonds / Le Locle, Watchmaking Town Planning":
    "Ла-Шо-де-Фон и Ле-Локль, города часового дела",
  "Neolithic Site of Çatalhöyük": "Неолитическое поселение Чатал-Хююк",
  "Bursa and Cumalıkızık: the Birth of the Ottoman Empire":
    "Бурса и Джумалыкызык: рождение Османской империи",
  "Pergamon and its Multi-Layered Cultural Landscape":
    "Пергам и его многослойный культурный ландшафт",
  "Ancient City of Tauric Chersonese and its Chora":
    "Древний город Херсонес Таврический и его хора",
  "The Historic Centre of Odesa": "Исторический центр Одессы",
  "Pontcysyllte Aqueduct and Canal": "Акведук и канал Понткисиллте",
  "Monumental Earthworks of Poverty Point": "Монументальные земляные сооружения Поверти-Пойнт",
  "Landmarks of the Ancient Kingdom of Saba, Marib": "Памятники древнего царства Саба в Марибе",
  "Qhapaq Ñan, Andean Road System": "Капак-Ньян, Андская дорожная система",
  "Silk Roads: the Routes Network of Chang'an-Tianshan Corridor":
    "Шелковые пути: сеть маршрутов коридора Чанъань-Тяньшань",
  "Venetian Works of Defence between the 16th and 17th Centuries: Stato da Terra – Western Stato da Mar":
    "Венецианские оборонительные сооружения XVI-XVII веков",
  "Wooden Tserkvas of the Carpathian Region in Poland and Ukraine":
    "Деревянные церкви Карпатского региона в Польше и Украине",
  "Heritage of Mercury. Almadén and Idrija": "Наследие ртути: Альмаден и Идрия",
  "Funerary Tradition in the Prehistory of Sardinia – The domus de janas":
    "Погребальная традиция доисторической Сардинии: домус-де-янас",
  "Delta Works / Netherlands North Sea Protection Works":
    "Дельта-проект и защитные сооружения Северного моря в Нидерландах",
  "Barotse Floodplain Cultural Landscape": "Культурный ландшафт поймы Баротсе",
  "Belfast Assembly Rooms": "Ассамблейные залы Белфаста",
  "Bhuj Historic Water Systems": "Исторические водные системы Бхуджа",
  "Buddhist Grottoes of Maijishan and Yungang": "Буддийские гроты Майцзишань и Юньган",
  "Chapel of the Sorbonne": "Часовня Сорбонны",
  "Chief Ogiamien’s House": "Дом вождя Огиамиена",
  "Cinema Studio Namibe": "Киностудия Намибе",
  "Erdene Zuu Buddhist Monastery": "Буддийский монастырь Эрдэнэ-Зуу",
  "Gaza Historic Urban Fabric": "Историческая городская ткань Газы",
  "Historic City of Antakya": "Исторический город Антакья",
  "Historic Lighthouses of Maine": "Исторические маяки Мэна",
  "Jewish Heritage of Debdou": "Еврейское наследие Дебду",
  "Kyiv Teacher’s House": "Киевский дом учителя",
  "Monasteries of the Drino Valley": "Монастыри долины Дрино",
  "Musi Heritage Revitalization Project / Musi River Historic Buildings":
    "Проект возрождения наследия Муси и исторические здания реки Муси",
  "Noto Peninsula Heritage Sites": "Объекты наследия полуострова Ното",
  "Ruins of Old Belchite": "Руины старого Бельчите",
  "Serifos Historic Mining Landscape": "Исторический горнодобывающий ландшафт Серифоса",
  "Swahili Coast Heritage Sites": "Объекты наследия побережья Суахили",
  "Terracotta Sculptures of Alcobaça Monastery": "Терракотовые скульптуры монастыря Алкобаса",
  "The Great Trading Path": "Великий торговый путь",
  "Waru Waru Agricultural Fields": "Сельскохозяйственные поля вару-вару",
  "Water Reservoirs of Tunis Medina": "Водохранилища медины Туниса",
  "Arakelots Monastery and Settlement": "Монастырь и поселение Аракелоц",
  "Nyborg Castle": "Замок Нюборг",
  "Castle of Monemvasia": "Крепость Монемвасия",
  "Great Synagogue in Orla": "Большая синагога в Орле",
  "Generalštab Modernist Complex in Belgrade": "Модернистский комплекс Генштаба в Белграде",
  "Valhalla Swimming Hall, Gothenburg": "Плавательный зал Валгалла в Гётеборге",
  "Victoria Tower Gardens, London": "Сады башни Виктории в Лондоне",
  Biertan: "Бьертан",
  "Chorá of Patmos": "Хора острова Патмос",
  Coro: "Коро",
  Fez: "Фес",
  Icherisheher: "Ичери-шехер",
  "Lalitpur (Patan)": "Лалитпур (Патан)",
  Lunenburg: "Луненберг",
  Mérida: "Мерида",
  Miagao: "Миагао",
  Neringa: "Неринга",
  Roros: "Рёрус",
  "Saint-Louis": "Сен-Луи",
  "San Pablo Villa de Mitla": "Сан-Пабло-Вилья-де-Митла",
  "São Luís": "Сан-Луис",
  "Tel-Aviv-Yafo": "Тель-Авив-Яффо",
};

function parseLocations(html) {
  const match = html.match(/const locations = (\[[\s\S]*?\n\s*\]);/u);
  if (!match) throw new Error("Could not find locations array.");
  return Function(`return ${match[1]};`)();
}

function q(value) {
  return JSON.stringify(value);
}

function formatLocation(loc) {
  const parts = [
    `name: ${q(loc.name)}`,
    `lat: ${Number(loc.lat)}`,
    `lng: ${Number(loc.lng)}`,
    `country: ${q(loc.country)}`,
    `category: ${q(loc.category)}`,
    `kind: ${q(loc.kind || "natural")}`,
    `en: ${q(loc.en)}`,
  ];
  if (loc.wikiEnTitle) parts.push(`wikiEnTitle: ${q(loc.wikiEnTitle)}`);
  if (loc.wikiRuTitle) parts.push(`wikiRuTitle: ${q(loc.wikiRuTitle)}`);
  if (Array.isArray(loc.tags) && loc.tags.length) parts.push(`tags: ${q(loc.tags)}`);
  if (loc.unescoId) parts.push(`unescoId: ${q(loc.unescoId)}`);
  if (loc.image) parts.push(`image: ${q(loc.image)}`);
  return `  { ${parts.join(", ")} }`;
}

function hasCyrillic(value) {
  return /[А-Яа-яЁё]/u.test(String(value || ""));
}

function cleanRuTitle(value) {
  return String(value || "")
    .replace(/\s+-\s+.*$/iu, "")
    .replace(/\s+\([^)]*(значения|фильм|альбом|песня|группа|значения)\)$/iu, "")
    .trim();
}

function stripHtml(value) {
  return String(value || "")
    .replace(/<[^>]*>/gu, "")
    .replace(/&amp;/gu, "&")
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/[^a-z0-9а-яё]+/giu, " ")
    .replace(/\b(the|a|an|of|and|de|la|le|el|los|las|san|santa|saint|st)\b/giu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function imageFromPage(page) {
  return page?.original?.source || page?.thumbnail?.source || "";
}

function isJunkImageTitle(title) {
  return /commons-logo|wikimedia|wikipedia|wikidata|symbol|icon|flag[\s_-]of|flag\.|coat[\s_-]of[\s_-]arms|locator|location[\s_-]map|emblem|diagram|chart|graph|infobox|orthographic|relief[\s_-]map|topographic[\s_-]map/iu.test(
    title,
  );
}

async function api(lang, params) {
  const url = `https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({
    format: "json",
    origin: "*",
    ...params,
  })}`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`${lang}.wikipedia ${response.status}`);
  return response.json();
}

async function wikidata(params) {
  const url = `https://www.wikidata.org/w/api.php?${new URLSearchParams({
    format: "json",
    origin: "*",
    ...params,
  })}`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`wikidata ${response.status}`);
  return response.json();
}

async function commons(params) {
  const url = `https://commons.wikimedia.org/w/api.php?${new URLSearchParams({
    format: "json",
    origin: "*",
    ...params,
  })}`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!response.ok) throw new Error(`commons ${response.status}`);
  return response.json();
}

async function queryTitles(lang, titles) {
  if (!titles.length) return new Map();
  const data = await api(lang, {
    action: "query",
    titles: titles.join("|"),
    prop: "langlinks|pageimages|pageprops",
    lllang: lang === "en" ? "ru" : "en",
    lllimit: "1",
    piprop: "thumbnail|original|name",
    pithumbsize: "960",
    redirects: "1",
  });

  const pages = Object.values(data.query?.pages || {});
  const byTitle = new Map();
  const redirects = new Map();
  for (const redirect of data.query?.redirects || []) {
    redirects.set(normalize(redirect.from), normalize(redirect.to));
  }
  for (const page of pages) {
    if (page.missing !== undefined || !page.title) continue;
    byTitle.set(normalize(page.title), page);
  }
  const out = new Map();
  for (const title of titles) {
    const key = normalize(title);
    const redirected = redirects.get(key);
    const page = byTitle.get(redirected || key) || byTitle.get(key);
    if (page) out.set(title, page);
  }
  return out;
}

async function queryWikidata(ids) {
  const out = new Map();
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < uniqueIds.length; i += 50) {
    const batch = uniqueIds.slice(i, i + 50);
    const data = await wikidata({
      action: "wbgetentities",
      ids: batch.join("|"),
      props: "labels|claims",
      languages: "ru|en",
    });
    for (const [id, entity] of Object.entries(data.entities || {})) {
      if (entity.missing !== undefined) continue;
      out.set(id, entity);
    }
    await sleep(80);
  }
  return out;
}

async function resolveCommonsImages(filenames) {
  const out = new Map();
  const files = [...new Set(filenames.filter(Boolean))].filter((name) => !isJunkImageTitle(name));
  for (let i = 0; i < files.length; i += 50) {
    const batch = files.slice(i, i + 50).map((name) => `File:${name}`);
    const data = await commons({
      action: "query",
      titles: batch.join("|"),
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: "960",
    });
    for (const page of Object.values(data.query?.pages || {})) {
      const url = page.imageinfo?.[0]?.thumburl || page.imageinfo?.[0]?.url;
      if (page.title && url) out.set(page.title.replace(/^File:/u, ""), url);
    }
    await sleep(80);
  }
  return out;
}

async function searchTitle(lang, query) {
  if (!query) return null;
  const data = await api(lang, {
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: "1",
    srprop: "",
  });
  return data.query?.search?.[0]?.title || null;
}

async function enrichLocations(locations) {
  const titles = [
    ...new Set(
      locations
        .map((loc) => loc.wikiEnTitle || loc.en)
        .filter(Boolean)
        .map((title) => String(title).trim()),
    ),
  ];

  const titleToPage = new Map();
  for (let i = 0; i < titles.length; i += 40) {
    const batch = titles.slice(i, i + 40);
    const pages = await queryTitles("en", batch);
    for (const [title, page] of pages) titleToPage.set(title, page);
    await sleep(80);
  }

  let ruFilled = 0;
  let nameFilled = 0;
  let imageFilled = 0;
  let wikiFilledBySearch = 0;
  const locToQid = new Map();

  for (const loc of locations) {
    loc.name = stripHtml(loc.name);
    loc.en = stripHtml(loc.en);
    loc.wikiEnTitle = stripHtml(loc.wikiEnTitle);
    loc.wikiRuTitle = stripHtml(loc.wikiRuTitle);
    const title = loc.wikiEnTitle || loc.en;
    let page = titleToPage.get(title);

    if (!page && !loc.wikiEnTitle && loc.en) {
      const found = await searchTitle("en", loc.en);
      if (found) {
        const pages = await queryTitles("en", [found]);
        page = pages.get(found);
        if (page) {
          loc.wikiEnTitle = page.title;
          wikiFilledBySearch += 1;
        }
      }
      await sleep(80);
    }

    if (!page) continue;
    if (!loc.wikiEnTitle) loc.wikiEnTitle = page.title;
    if (page.pageprops?.wikibase_item) locToQid.set(loc, page.pageprops.wikibase_item);

    const ruTitle = page.langlinks?.find((item) => item.lang === "ru")?.["*"];
    if (!loc.wikiRuTitle && ruTitle) {
      loc.wikiRuTitle = ruTitle;
      ruFilled += 1;
    }
    if (!hasCyrillic(loc.name) && loc.wikiRuTitle) {
      loc.name = cleanRuTitle(loc.wikiRuTitle);
      nameFilled += 1;
    }
    if (!loc.image) {
      const image = imageFromPage(page);
      if (image) {
        loc.image = image;
        imageFilled += 1;
      }
    }
  }

  const wikidataIds = [];
  for (const loc of locations) {
    if (locToQid.has(loc) && (!hasCyrillic(loc.name) || !loc.wikiRuTitle || !loc.image)) {
      wikidataIds.push(locToQid.get(loc));
    }
  }
  const entities = await queryWikidata(wikidataIds);
  const imageClaims = new Map();
  for (const [loc, qid] of locToQid.entries()) {
    const entity = entities.get(qid);
    if (!entity) continue;
    const ruLabel = entity.labels?.ru?.value;
    if (!loc.wikiRuTitle && ruLabel) {
      loc.wikiRuTitle = ruLabel;
      ruFilled += 1;
    }
    if (!hasCyrillic(loc.name) && ruLabel) {
      loc.name = cleanRuTitle(ruLabel);
      nameFilled += 1;
    }
    const imageName = entity.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (!loc.image && imageName) imageClaims.set(loc, imageName);
  }
  const commonsUrls = await resolveCommonsImages([...imageClaims.values()]);
  for (const [loc, imageName] of imageClaims.entries()) {
    const image = commonsUrls.get(imageName);
    if (image) {
      loc.image = image;
      imageFilled += 1;
    }
  }

  for (const loc of locations) {
    const override =
      RU_NAME_OVERRIDES[stripHtml(loc.en)] || RU_NAME_OVERRIDES[stripHtml(loc.wikiEnTitle)];
    if (override) {
      if (!loc.wikiRuTitle) loc.wikiRuTitle = override;
      if (!hasCyrillic(loc.name)) loc.name = override;
    }
  }

  return { ruFilled, nameFilled, imageFilled, wikiFilledBySearch };
}

function ensureAncientSeven(locations) {
  const hasLighthouse = locations.some(
    (loc) => normalize(loc.en) === normalize("Lighthouse of Alexandria"),
  );
  if (!hasLighthouse) {
    locations.push({ ...ANCIENT_LIGHTHOUSE });
    return 1;
  }
  const loc = locations.find(
    (item) => normalize(item.en) === normalize("Lighthouse of Alexandria"),
  );
  loc.tags = [...new Set([...(loc.tags || []), "ancient7"])];
  loc.kind = loc.kind || "human";
  loc.category = loc.category || "engineering";
  loc.wikiEnTitle = loc.wikiEnTitle || "Lighthouse of Alexandria";
  loc.wikiRuTitle = loc.wikiRuTitle || "Александрийский маяк";
  if (!hasCyrillic(loc.name)) loc.name = "Александрийский маяк";
  return 0;
}

function qaRows(locations) {
  return locations.map((loc) => {
    const issues = [];
    if (!Number.isFinite(loc.lat) || !Number.isFinite(loc.lng)) issues.push("bad_coords");
    if (!hasCyrillic(loc.name)) issues.push("name_not_ru");
    if (!loc.wikiEnTitle) issues.push("missing_wiki_en");
    if (!loc.wikiRuTitle) issues.push("missing_wiki_ru");
    if (!loc.image) issues.push("missing_image");
    if (!loc.category) issues.push("missing_category");
    if (!loc.kind) issues.push("missing_kind");
    return {
      issues: issues.join("|"),
      en: loc.en,
      name: loc.name,
      country: loc.country,
      kind: loc.kind,
      category: loc.category,
      tags: (loc.tags || []).join("|"),
      wikiEnTitle: loc.wikiEnTitle || "",
      wikiRuTitle: loc.wikiRuTitle || "",
      image: loc.image || "",
    };
  });
}

function writeCsv(file, rows) {
  const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const esc = (value) => {
    const text = String(value ?? "");
    return /[",\n\r]/u.test(text) ? `"${text.replace(/"/gu, '""')}"` : text;
  };
  fs.writeFileSync(
    file,
    "\uFEFF" +
      [
        headers.join(","),
        ...rows.map((row) => headers.map((header) => esc(row[header])).join(",")),
      ].join("\n") +
      "\n",
    "utf8",
  );
}

function updateHtml(html, locations) {
  const total = locations.length;
  return html
    .replace(
      /const locations = \[[\s\S]*?\n\s*\];/u,
      [
        "const locations = [",
        `  // Combined World Wonders Atlas dataset: ${total} mapped records.`,
        ...locations.map(
          (loc, index) => `${formatLocation(loc)}${index === locations.length - 1 ? "" : ","}`,
        ),
        "];",
      ].join("\n"),
    )
    .replace(/World Wonders Atlas — \d+ Wonders/gu, `World Wonders Atlas — ${total} Wonders`)
    .replace(/World Wonders Atlas — \d+ чудес/gu, `World Wonders Atlas — ${total} чудес`)
    .replace(/>\d+ чудес<br>/u, `>${total} чудес<br>`)
    .replace(/id="visitedTotal">\d+</u, `id="visitedTotal">${total}<`);
}

const html = fs.readFileSync(HTML_PATH, "utf8");
const locations = parseLocations(html).map((loc) => ({ ...loc, kind: loc.kind || "natural" }));
const ancientAdded = ensureAncientSeven(locations);
const stats = await enrichLocations(locations);
const rows = qaRows(locations);
const issueRows = rows.filter((row) => row.issues);

fs.writeFileSync(HTML_PATH, updateHtml(html, locations), "utf8");
writeCsv(QA_REPORT_PATH, issueRows);

const tags = {};
for (const loc of locations) for (const tag of loc.tags || []) tags[tag] = (tags[tag] || 0) + 1;
console.log(
  JSON.stringify(
    {
      total: locations.length,
      ancientAdded,
      ancient7: tags.ancient7 || 0,
      issueRows: issueRows.length,
      ...stats,
      report: QA_REPORT_PATH,
    },
    null,
    2,
  ),
);
