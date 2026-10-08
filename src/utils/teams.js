// src/utils/teams.js — league team lists, used to tell which sport a
// hand-typed bet is about. Full names only; nicknames shared between leagues
// (Kings, Rangers, Panthers, Cardinals, Giants, Jets…) are matched by full
// name only, so an ambiguous bet is never filed under the wrong sport.

export const LEAGUE_TEAMS = {
  NBA: [
    'Atlanta Hawks', 'Boston Celtics', 'Brooklyn Nets', 'Charlotte Hornets', 'Chicago Bulls',
    'Cleveland Cavaliers', 'Dallas Mavericks', 'Denver Nuggets', 'Detroit Pistons', 'Golden State Warriors',
    'Houston Rockets', 'Indiana Pacers', 'Los Angeles Clippers', 'Los Angeles Lakers', 'Memphis Grizzlies',
    'Miami Heat', 'Milwaukee Bucks', 'Minnesota Timberwolves', 'New Orleans Pelicans', 'New York Knicks',
    'Oklahoma City Thunder', 'Orlando Magic', 'Philadelphia 76ers', 'Phoenix Suns', 'Portland Trail Blazers',
    'Sacramento Kings', 'San Antonio Spurs', 'Toronto Raptors', 'Utah Jazz', 'Washington Wizards',
  ],
  NFL: [
    'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens', 'Buffalo Bills', 'Carolina Panthers',
    'Chicago Bears', 'Cincinnati Bengals', 'Cleveland Browns', 'Dallas Cowboys', 'Denver Broncos',
    'Detroit Lions', 'Green Bay Packers', 'Houston Texans', 'Indianapolis Colts', 'Jacksonville Jaguars',
    'Kansas City Chiefs', 'Las Vegas Raiders', 'Los Angeles Chargers', 'Los Angeles Rams', 'Miami Dolphins',
    'Minnesota Vikings', 'New England Patriots', 'New Orleans Saints', 'New York Giants', 'New York Jets',
    'Philadelphia Eagles', 'Pittsburgh Steelers', 'San Francisco 49ers', 'Seattle Seahawks',
    'Tampa Bay Buccaneers', 'Tennessee Titans', 'Washington Commanders',
  ],
  MLB: [
    'Arizona Diamondbacks', 'Atlanta Braves', 'Baltimore Orioles', 'Boston Red Sox', 'Chicago Cubs',
    'Chicago White Sox', 'Cincinnati Reds', 'Cleveland Guardians', 'Colorado Rockies', 'Detroit Tigers',
    'Houston Astros', 'Kansas City Royals', 'Los Angeles Angels', 'Los Angeles Dodgers', 'Miami Marlins',
    'Milwaukee Brewers', 'Minnesota Twins', 'New York Mets', 'New York Yankees', 'Athletics',
    'Philadelphia Phillies', 'Pittsburgh Pirates', 'San Diego Padres', 'San Francisco Giants',
    'Seattle Mariners', 'St. Louis Cardinals', 'Tampa Bay Rays', 'Texas Rangers', 'Toronto Blue Jays',
    'Washington Nationals',
  ],
  NHL: [
    'Anaheim Ducks', 'Boston Bruins', 'Buffalo Sabres', 'Calgary Flames', 'Carolina Hurricanes',
    'Chicago Blackhawks', 'Colorado Avalanche', 'Columbus Blue Jackets', 'Dallas Stars', 'Detroit Red Wings',
    'Edmonton Oilers', 'Florida Panthers', 'Los Angeles Kings', 'Minnesota Wild', 'Montreal Canadiens',
    'Nashville Predators', 'New Jersey Devils', 'New York Islanders', 'New York Rangers', 'Ottawa Senators',
    'Philadelphia Flyers', 'Pittsburgh Penguins', 'San Jose Sharks', 'Seattle Kraken', 'St. Louis Blues',
    'Tampa Bay Lightning', 'Toronto Maple Leafs', 'Utah Mammoth', 'Vancouver Canucks',
    'Vegas Golden Knights', 'Washington Capitals', 'Winnipeg Jets',
  ],
  WNBA: [
    'Atlanta Dream', 'Chicago Sky', 'Connecticut Sun', 'Dallas Wings', 'Golden State Valkyries',
    'Indiana Fever', 'Las Vegas Aces', 'Los Angeles Sparks', 'Minnesota Lynx', 'New York Liberty',
    'Phoenix Mercury', 'Portland Fire', 'Seattle Storm', 'Toronto Tempo', 'Washington Mystics',
  ],
};

const norm = (s) => ` ${String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;

// Nicknames (everything after the city) that belong to exactly one league.
// Single words that are also everyday words ("heat", "magic", "sun", "sky",
// "wild", "fire", "storm"…) are excluded so ordinary text can't trigger them.
const EVERYDAY_WORDS = new Set(['heat', 'magic', 'jazz', 'thunder', 'suns', 'kings', 'sun', 'sky', 'wild', 'fire', 'storm', 'dream', 'fever', 'wings', 'liberty', 'lynx', 'aces', 'mercury', 'stars', 'blues', 'reds', 'rays', 'twins', 'giants', 'jets', 'bills', 'saints', 'chiefs', 'athletics', 'tempo']);

function nickname(full) {
  const words = full.split(' ');
  if (words.length === 1) return full;
  // Two-word cities.
  const twoWordCity = /^(Los Angeles|New York|New Orleans|New England|New Jersey|Golden State|Oklahoma City|San Antonio|San Francisco|San Diego|San Jose|St\. Louis|Tampa Bay|Kansas City|Green Bay|Las Vegas)\b/;
  const match = full.match(twoWordCity);
  return match ? full.slice(match[0].length).trim() : words.slice(1).join(' ');
}

const NICKNAME_LEAGUES = new Map();
Object.entries(LEAGUE_TEAMS).forEach(([league, teams]) => teams.forEach(team => {
  const nick = nickname(team).toLowerCase();
  if (!NICKNAME_LEAGUES.has(nick)) NICKNAME_LEAGUES.set(nick, new Set());
  NICKNAME_LEAGUES.get(nick).add(league);
}));

const LEAGUE_WORDS = [
  ['WNBA', /\bwnba\b/], ['NBA', /\bnba\b/], ['NFL', /\bnfl\b/], ['MLB', /\bmlb\b/], ['NHL', /\bnhl\b/],
  ['UFC', /\b(ufc|mma|fight)\b/],
];

// Returns a league name, or 'Other' when nothing (or more than one league)
// matches.
export function detectLeague(text) {
  const raw = String(text || '').toLowerCase();
  for (const [league, re] of LEAGUE_WORDS) if (re.test(raw)) return league;
  const haystack = norm(text);
  const found = new Set();
  Object.entries(LEAGUE_TEAMS).forEach(([league, teams]) => {
    teams.forEach(team => { if (haystack.includes(norm(team))) found.add(league); });
  });
  if (!found.size) {
    NICKNAME_LEAGUES.forEach((leagues, nick) => {
      if (leagues.size !== 1 || EVERYDAY_WORDS.has(nick)) return;
      if (haystack.includes(norm(nick))) found.add([...leagues][0]);
    });
  }
  return found.size === 1 ? [...found][0] : 'Other';
}
