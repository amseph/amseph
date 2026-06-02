import { readFile, writeFile } from "node:fs/promises";

const USERNAME = process.env.GITHUB_USER_NAME || "amseph";
const TOKEN = process.env.GITHUB_TOKEN;
const SVG_FILES = [
  "assets/puzzle-bobble.svg",
  "assets/puzzle-bobble-dark.svg",
];

if (!TOKEN) {
  throw new Error("GITHUB_TOKEN is required to fetch contribution calendar data.");
}

const query = `
  query ContributionCalendar($userName: String!) {
    user(login: $userName) {
      contributionsCollection {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              date
              contributionCount
              color
              contributionLevel
              weekday
            }
          }
        }
      }
    }
  }
`;

const response = await fetch("https://api.github.com/graphql", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    query,
    variables: { userName: USERNAME },
  }),
});

if (!response.ok) {
  throw new Error(`GitHub GraphQL request failed: ${response.status} ${response.statusText}`);
}

const payload = await response.json();

if (payload.errors?.length) {
  throw new Error(`GitHub GraphQL errors: ${JSON.stringify(payload.errors)}`);
}

const calendar = payload.data?.user?.contributionsCollection?.contributionCalendar;

if (!calendar) {
  throw new Error(`No contribution calendar found for ${USERNAME}.`);
}

const days = calendar.weeks
  .flatMap((week) => week.contributionDays)
  .sort((a, b) => a.date.localeCompare(b.date));

const activeCells = days.filter((day) => day.contributionCount > 0).length;
const totalContributions = calendar.totalContributions;
const bestDay = days.reduce(
  (best, day) => (day.contributionCount > best.contributionCount ? day : best),
  days[0],
);
const longestStreak = getLongestStreak(days);
const currentStreak = getCurrentStreak(days);

const stats = {
  activeCells,
  totalContributions,
  bestDayName: formatWeekday(bestDay.date),
  bestDayCount: bestDay.contributionCount,
  longestStreak,
  currentStreak,
};

for (const file of SVG_FILES) {
  const original = await readFile(file, "utf8");
  let svg = ensureArcadeSkin(original);
  svg = patchContributionCells(svg, days);
  svg = upsertAnalyticsHud(svg, stats);
  svg = upsertMetadata(svg, days);
  await writeFile(file, svg);
}

console.log(
  `Updated ${SVG_FILES.join(", ")} from real GitHub contribution data for ${USERNAME}: ` +
    `${totalContributions} total, ${activeCells} active days.`,
);

function getLongestStreak(days) {
  let longest = 0;
  let current = 0;

  for (const day of days) {
    if (day.contributionCount > 0) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  return longest;
}

function getCurrentStreak(days) {
  let streak = 0;

  for (let index = days.length - 1; index >= 0; index -= 1) {
    const day = days[index];

    if (day.contributionCount > 0) {
      streak += 1;
      continue;
    }

    if (index === days.length - 1) {
      continue;
    }

    break;
  }

  return streak;
}

function formatWeekday(date) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    timeZone: "UTC",
  })
    .format(new Date(`${date}T00:00:00Z`))
    .toUpperCase();
}

function ensureArcadeSkin(svg) {
  if (!svg.includes('viewBox="0 0 1166 249"')) {
    svg = svg.replace(
      '<svg width="1166" height="249" xmlns="http://www.w3.org/2000/svg">',
      '<svg width="1166" height="249" viewBox="0 0 1166 249" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges">',
    );
  }

  if (svg.includes('id="arcadeBg"')) {
    return svg;
  }

  const chrome = `<defs><linearGradient id="arcadeBg" x1="0" y1="0" x2="1166" y2="249" gradientUnits="userSpaceOnUse"><stop stop-color="#061126"/><stop offset="0.48" stop-color="#0B2148"/><stop offset="1" stop-color="#123B68"/></linearGradient><linearGradient id="panelGlow" x1="24" y1="20" x2="1142" y2="218" gradientUnits="userSpaceOnUse"><stop stop-color="#122A5B"/><stop offset="0.55" stop-color="#142F63"/><stop offset="1" stop-color="#173D70"/></linearGradient><pattern id="pixelGrid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#63DFFF" stroke-opacity="0.08" stroke-width="1"/></pattern><pattern id="scanlines" width="1" height="8" patternUnits="userSpaceOnUse"><rect width="1" height="2" fill="#FFFFFF" fill-opacity="0.055"/></pattern><filter id="cyanGlow" x="-8%" y="-32%" width="116%" height="164%"><feGaussianBlur stdDeviation="2.2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs><rect width="1166" height="249" fill="url(#arcadeBg)"/><rect width="1166" height="249" fill="url(#pixelGrid)"/><rect x="18" y="18" width="1130" height="205" fill="url(#panelGlow)" stroke="#4A6FB5" stroke-opacity="0.65" stroke-width="2"/><rect x="1.5" y="1.5" width="1163" height="246" fill="none" stroke="#45DFFF" stroke-width="3" filter="url(#cyanGlow)"/><rect x="7.5" y="7.5" width="1151" height="234" fill="none" stroke="#D6EEFF" stroke-opacity="0.24" stroke-width="2"/><rect x="14.5" y="14.5" width="1137" height="220" fill="none" stroke="#45DFFF" stroke-opacity="0.22" stroke-width="1"/><rect x="28" y="220" width="175" height="5" fill="#45DFFF" fill-opacity="0.85"/><rect x="214" y="220" width="56" height="5" fill="#FFE16A" fill-opacity="0.86"/><rect x="282" y="220" width="34" height="5" fill="#FF6E6E" fill-opacity="0.86"/><rect x="828" y="220" width="54" height="5" fill="#73F08C" fill-opacity="0.82"/><rect x="894" y="220" width="138" height="5" fill="#45DFFF" fill-opacity="0.72"/><rect width="1166" height="249" fill="url(#scanlines)" opacity="0.85"/>`;

  return svg.replace(
    /(<desc>.*?<\/desc>)<rect width="100%" height="100%" fill="#[0-9A-Fa-f]{6}"\/>/s,
    `$1${chrome}`,
  );
}

function patchContributionCells(svg, days) {
  const contributionCellPattern =
    /<circle\b(?=[^>]*\br="9"\b)(?=[^>]*\bcx="(?!0(?:\.0)?")[^"]+")[^>]*>[\s\S]*?<\/circle>/g;

  let index = 0;
  return svg.replace(contributionCellPattern, (cell) => {
    const cx = Number(cell.match(/\bcx="([^"]+)"/)?.[1]);
    const cy = Number(cell.match(/\bcy="([^"]+)"/)?.[1]);
    const isCalendarCell = Number.isFinite(cx) && Number.isFinite(cy) && cy >= 25 && cy <= 157;

    if (!isCalendarCell) {
      return cell;
    }

    if (index >= days.length) {
      index += 1;
      return cell;
    }

    const day = days[index];
    index += 1;

    const color = toArcadeColor(day.contributionLevel, day.contributionCount);
    let patched = replaceAttribute(cell, "fill", color);
    patched = patchFillAnimate(patched, color);
    patched = patched.replace(/\sdata-date="[^"]*"/g, "");
    patched = patched.replace(/\sdata-count="[^"]*"/g, "");
    patched = patched.replace(/\sdata-level="[^"]*"/g, "");
    patched = patched.replace(
      /<circle\b/,
      `<circle data-date="${day.date}" data-count="${day.contributionCount}" data-level="${day.contributionLevel}"`,
    );

    if (!patched.includes('stroke="#7FB9FF"')) {
      patched = patched.replace(
        /<circle([^>]*)>/,
        '<circle$1 stroke="#7FB9FF" stroke-opacity="0.26" stroke-width="1">',
      );
    }

    return patched;
  });
}

function replaceAttribute(markup, name, value) {
  const pattern = new RegExp(`${name}="[^"]*"`);

  if (pattern.test(markup)) {
    return markup.replace(pattern, `${name}="${value}"`);
  }

  return markup.replace(/<circle\b/, `<circle ${name}="${value}"`);
}

function patchFillAnimate(markup, color) {
  return markup.replace(
    /(<animate\b(?=[^>]*attributeName="fill")[^>]*\bvalues=")([^"]*)(")/g,
    (_match, start, values, end) => {
      const length = values.split(";").length;
      return `${start}${Array.from({ length }, () => color).join(";")}${end}`;
    },
  );
}

function toArcadeColor(level, count) {
  if (count <= 0 || level === "NONE") return "#172A55";

  return {
    FIRST_QUARTILE: "#65F2C7",
    SECOND_QUARTILE: "#45DFFF",
    THIRD_QUARTILE: "#FFE16A",
    FOURTH_QUARTILE: "#FF6E6E",
  }[level] || "#45DFFF";
}

function upsertAnalyticsHud(svg, stats) {
  const hud = `<g class="analytics-hud" font-family="'Courier New', monospace" shape-rendering="crispEdges">
  <rect x="42" y="181" width="118" height="32" fill="#0B1B3A" stroke="#45DFFF" stroke-opacity="0.58" stroke-width="1"/>
  <rect x="48" y="187" width="7" height="7" fill="#45DFFF"/>
  <text x="62" y="191" font-size="7" font-weight="700" fill="#9CC8FF">ACTIVE</text>
  <text x="62" y="206" font-size="14" font-weight="700" fill="#F6FBFF">${stats.activeCells} CELLS</text>
  <rect x="172" y="181" width="118" height="32" fill="#0B1B3A" stroke="#45DFFF" stroke-opacity="0.44" stroke-width="1"/>
  <rect x="178" y="187" width="7" height="7" fill="#FFE16A"/>
  <text x="192" y="191" font-size="7" font-weight="700" fill="#9CC8FF">TOTAL</text>
  <text x="192" y="206" font-size="14" font-weight="700" fill="#FFE16A">${formatNumber(stats.totalContributions)} PTS</text>
  <rect x="738" y="181" width="128" height="32" fill="#0B1B3A" stroke="#45DFFF" stroke-opacity="0.44" stroke-width="1"/>
  <rect x="744" y="187" width="7" height="7" fill="#FF6E6E"/>
  <text x="758" y="191" font-size="7" font-weight="700" fill="#9CC8FF">BEST DAY</text>
  <text x="758" y="206" font-size="14" font-weight="700" fill="#F6FBFF">${stats.bestDayName} ${formatNumber(stats.bestDayCount)}</text>
  <rect x="878" y="181" width="128" height="32" fill="#0B1B3A" stroke="#45DFFF" stroke-opacity="0.44" stroke-width="1"/>
  <rect x="884" y="187" width="7" height="7" fill="#73F08C"/>
  <text x="898" y="191" font-size="7" font-weight="700" fill="#9CC8FF">STREAK</text>
  <text x="898" y="206" font-size="14" font-weight="700" fill="#73F08C">LONG ${formatNumber(stats.longestStreak)}</text>
  <text x="1018" y="192" font-size="7" font-weight="700" fill="#9CC8FF">NOW</text>
  <text x="1018" y="206" font-size="12" font-weight="700" fill="#D7F7FF">${formatNumber(stats.currentStreak)}</text>
</g>`;

  svg = svg.replace(/<g class="analytics-hud"[\s\S]*?<\/g>\s*/g, "");

  if (svg.includes('<g transform="translate(20 16) scale(0.96)">')) {
    return svg.replace('<g transform="translate(20 16) scale(0.96)">', `${hud}<g transform="translate(20 16) scale(0.96)">`);
  }

  return svg.replace(/(<text\b)/, `${hud}<g transform="translate(20 16) scale(0.96)">$1`).replace(/<\/svg>$/, "</g></svg>");
}

function upsertMetadata(svg, days) {
  const metadata = `<metadata id="github-contribution-calendar" data-source="GitHub GraphQL contributionsCollection.contributionCalendar" data-user="${USERNAME}">${JSON.stringify(days)}</metadata>`;

  svg = svg.replace(/<metadata id="github-contribution-calendar"[\s\S]*?<\/metadata>/g, "");
  return svg.replace("</desc>", `</desc>${metadata}`);
}

function formatNumber(value) {
  return Number(value).toLocaleString("en-US");
}
