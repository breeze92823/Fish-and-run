// Every tunable constant lives here; the rest of src/ holds no theme values.

// --- Identity -------------------------------------------------------------
export const GAME_SLUG = import.meta.env.VITE_GAME_SLUG || 'fish-and-run' // slug registered on bloxity.io (matchmaker, hosting)
export const GAME_TITLE = 'Fish and Run'

// Forces the Bloxity SDK and avatar CDN to be treated as unavailable (see .env.example).
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'

// --- World (metres: +X east, +Z south, +Y up) -------------------------------
export const GROUND_Y = 0
export const SPAWN = { x: 0, y: 0.05, z: 26 } // hub centre, the finish line ahead
export const SPAWN_FACING = Math.PI // yaw the character faces on spawn (PI = toward -Z)

// --- The hub (src/hub/) ----------------------------------------------------------
// A walled lime "baseplate" yard. The checkered finish line runs east-west at z = 0;
// the hub is south of it (+Z), the run lane north of it (-Z). 1 Roblox stud ~ 0.36 m.
export const HUB = {
  halfWidth: 44, // x of the inner face of the east / west walls (hub and lane share them)
  south: 78, // z of the inner face of the south wall
  laneEnd: -975, // z of the wall closing the lane, just past the last zone
  wall: { height: 16, thick: 4, grassLip: 0.9, overhang: 0.35 },
  colors: {
    ground: '#62c80a', // albedo; lit it reads as the reference #74e00a
    groundStud: '#4fae06',
    groundStudLight: '#86ec2a',
    wall: '#ff8a0a',
    wallDark: '#e86a00',
    wallLight: '#ffa82a',
    grassTop: '#66cf0c',
  },
  studSize: 0.38, // m per stud on the ground texture
  line: { z: 0, width: 1.5, square: 0.75 }, // checkered finish line: two rows of squares
}

// The multiplayer link (net.js): backend room "world" (Colyseus, ../Fish-and-run-backend). Deployed
// builds find a pod through the Bloxity matchmaker; VITE_SERVER_URL (e.g. ws://localhost:2567) points a
// dev build at a local server. The room holds PLOTS.length players (backend ROOM_MAX_CLIENTS): each owns one plot.
export const SERVER_URL = import.meta.env.VITE_SERVER_URL || ''
export const NET = {
  poseHz: 12, // pose messages per second
  saveEvery: 5, // s: a changed snapshot is saved at most this often
  retry: 3, // s: first reconnect delay (doubles up to retryMax)
  retryMax: 30,
  rejoin: 2, // s before resolving a new endpoint after a drop
  joinWait: 9, // s the loading screen waits for a room (and your plot) before starting offline
  remoteLerp: 14, // 1/s ease of a remote player toward its pose
  predictMax: 0.25, // s of dead reckoning
  maxRemotes: 8, // drawn at once (plots = room size, minus you)
  maxRemotesTouch: 6,
  remoteFade: 50, // m: farther players are hidden
  plotFish: 12, // most fish a plot snapshot lists (the pool swims these)
}

// Player plots: a fenced pool each (fish swim in it), the owner's head tag over it, a
// treadmill + upgrade sign in front. `facing` = yaw the plot's front (toward the hub
// centre) looks along: 0 = +Z (south), PI = -Z (north), PI/2 = +X (east), -PI/2 = -X.
export const PLOT = {
  pool: { length: 17, width: 11 }, // inside the fence (length runs along the wall): the deck + the pond
  deck: 2.6, // m: the walkway inside the front fence; the pond fills the rest
  gate: { x: 2.6, width: 3.4 }, // the opening in the front fence (plot-local x of its centre, m wide)
  baseSign: { x: 6.3, z: 1.7 }, // the Base upgrade sign: plot-local x, m out in front of the fence
  fence: { height: 1.05, post: 0.32, postEvery: 2.6, rail: 0.16, border: 0.55, color: '#c7782f', dark: '#9a5420', light: '#e09048' },
  water: { color: '#2fd4f6', light: '#9ff6ff', deep: '#14b7e6' },
  tagHeight: 10.5, // m above ground of the owner's head tag
  houseHeight: 4.2, // m of the "your plot" house icon
  treadmillGap: 4.5, // m from the fence front to the treadmill centre
}
// 8 plots: 3 along the west wall, 3 along the south wall, 2 along the east wall.
export const PLOTS = [
  { x: -36, z: 15, facing: Math.PI / 2 },
  { x: -36, z: 36, facing: Math.PI / 2 },
  { x: -36, z: 57, facing: Math.PI / 2 },
  { x: -21.2, z: 71, facing: Math.PI },
  { x: 0, z: 71, facing: Math.PI },
  { x: 21.2, z: 71, facing: Math.PI },
  { x: 36, z: 57, facing: -Math.PI / 2 },
  { x: 36, z: 36, facing: -Math.PI / 2 },
]
export const MY_PLOT = 4 // index into PLOTS the local player owns (until the server assigns one)

// Stalls at the finish line, facing the hub. Touching the glowing pad opens the shop.
export const STALLS = [
  { id: 'rods', label: 'FISHING RODS', x: 23, z: -1.6, awning: ['#2f8cf0', '#ffffff'], pad: '#3fe6ff', keeper: 'rods', labelFill: ['#ffffff', '#ffb6f2'], labelOutline: '#5a2a9a' },
  { id: 'trails', label: 'TRAILS', x: 33.5, z: -1.6, awning: ['#ffa516', '#ffffff'], pad: '#ffd21a', keeper: 'trails', labelFill: 'rainbow', labelOutline: '#3a1a6a' },
  { id: 'sell', label: 'SELL FISH', x: -33, z: -1.6, awning: ['#ff2a2a', '#ffffff'], pad: '#ff4a4a', keeper: 'sell', labelFill: ['#c8ff2a', '#38e000'], labelOutline: '#1a3a10' },
]
export const STALL_SCALE = 1.3 // stalls are modelled at 1.0 and drawn this much bigger
// The boards on Bloxity's own trophy button (bloxity.js declares them; the game server reports the
// saved scores). Cash/s first: the portal opens on it. Keep in step with the backend's PLATFORM_BOARDS.
export const LEADERBOARDS = [
  { id: 'income', label: 'Most Cash/s', order: 'desc', mode: 'best', format: 'compact', reset: 'none' },
  { id: 'caught', label: 'Most Fish Caught', order: 'desc', mode: 'best', format: 'compact', reset: 'none' },
  { id: 'earned', label: 'Most Cash Earned', order: 'desc', mode: 'best', format: 'compact', reset: 'none' },
]
export const LEADERBOARD = {
  x: 40, z: 9, yaw: -Math.PI / 2 - 0.55, // faces the hub centre from beside the Trails stall
  title: 'MOST CASH/S',
  rows: [], // the server's top earners (net.js leaderboard); offline only your own row shows
}

// Treadmill looks, one per tier.
export const TREADMILLS = {
  stone: { frame: '#8d8f9e', frameDark: '#6c6e7c', belt: '#3a3b44', trim: '#b4b6c4', screen: '#bfe8ff' },
  wood: { frame: '#9a5a2a', frameDark: '#6e3c18', belt: '#3b2a1e', trim: '#c27a3a', screen: '#ffe2a0' },
  gold: { frame: '#ffc21a', frameDark: '#e59a00', belt: '#ffd84a', trim: '#fff1a0', screen: '#fff6c8', sparkle: true },
  amethyst: { frame: '#4a2a9a', frameDark: '#2e1868', belt: '#7a3cf0', trim: '#6a44d8', screen: '#ff4ad8', candles: '#c070ff', spikes: true },
}

// Fish rarities: label colour of each tier.
export const RARITY = {
  COMMON: '#ffffff',
  UNCOMMON: '#4cff4c',
  RARE: '#3aa8ff',
  EPIC: '#c24bff',
  LEGENDARY: '#ffd21a',
  MYTHIC: '#ff3a3a',
  SECRET: '#c8c8d0',
}
// Fish species: shape (fish.js builder), size (m, nose to tail), earnings per second.
// Colours: body, belly, fin, pattern colour; `rainbow` paints a rainbow along the body.
// Earnings of the lane species: a base per rarity, x4 for every zone further out.
const EARN_BASE = { COMMON: 5, UNCOMMON: 20, RARE: 80, EPIC: 400, LEGENDARY: 2000, MYTHIC: 10000, SECRET: 100000 }
const zoneEarn = (rarity, zoneIndex) => Math.round(EARN_BASE[rarity] * 4 ** zoneIndex)

export const FISH = {
  guppy: { name: 'Guppy', rarity: 'COMMON', earn: 4, shape: 'fish', size: 1.5, body: '#ff8a1a', belly: '#ffd36a', fin: '#2f7dff', pattern: 'tailfan' },
  neon_tetra: { name: 'Neon Tetra', rarity: 'COMMON', earn: 5, shape: 'fish', size: 1.4, body: '#2a6cff', belly: '#ff3a3a', fin: '#c8e8ff', pattern: 'neonstripe', accent: '#4ff6ff' },
  black_moor: { name: 'Black Moor Goldfish', rarity: 'UNCOMMON', earn: 44, shape: 'fish', size: 1.5, body: '#2b2b33', belly: '#4a4a55', fin: '#1c1c22' },
  royal_gramma: { name: 'Royal Gramma', rarity: 'COMMON', earn: 8, shape: 'fish', size: 1.6, body: '#c03cff', belly: '#ffd21a', fin: '#ffd21a', pattern: 'halfhalf' },
  angelfish: { name: 'Angelfish', rarity: 'UNCOMMON', earn: 24, shape: 'angel', size: 1.9, body: '#ffe46a', belly: '#fff6c8', fin: '#ffe46a', pattern: 'bands', accent: '#2a2a2a' },
  seahorse: { name: 'Seahorse', rarity: 'UNCOMMON', earn: 30, shape: 'seahorse', size: 2.0, body: '#ff9a3a', belly: '#ffd08a', fin: '#ffc070' },
  lobster: { name: 'Lobster', rarity: 'RARE', earn: 60, shape: 'lobster', size: 2.1, body: '#e8321e', belly: '#ff7a4a', fin: '#b81e12' },
  moray_eel: { name: 'Moray Eel', rarity: 'RARE', earn: 16000, shape: 'eel', size: 5, body: '#b8a020', belly: '#e8d870', fin: '#8a7810', pattern: 'spots', accent: '#3a3410' },
  mahi_mahi: { name: 'Mahi Mahi', rarity: 'RARE', earn: 26000, shape: 'mahi', size: 3.8, body: '#2ec84a', belly: '#ffe23a', fin: '#2a7aff', pattern: 'speckle', accent: '#1a8ad8' },
  sea_turtle: { name: 'Sea Turtle', rarity: 'EPIC', earn: 24000, shape: 'turtle', size: 3.2, body: '#8a5a2a', belly: '#d8b070', fin: '#a87a3a', pattern: 'shell', accent: '#5a3a18' },
  great_white: { name: 'Great White Shark', rarity: 'EPIC', earn: 240000, shape: 'shark', size: 9, body: '#6f8494', belly: '#f0f2f4', fin: '#5a6e7e' },
  electric_eel: { name: 'Electric Eel', rarity: 'LEGENDARY', earn: 320000, shape: 'eel', size: 6.5, body: '#1e2a1e', belly: '#3a4a2a', fin: '#141c14', pattern: 'zigzag', accent: '#ffe21a', aura: '#7ad8ff' },
  orca: { name: 'Orca', rarity: 'LEGENDARY', earn: 3100000, shape: 'orca', size: 10, body: '#121418', belly: '#ffffff', fin: '#121418' },
  whale_shark: { name: 'Whale Shark', rarity: 'MYTHIC', earn: 8200000, shape: 'shark', size: 13, body: '#2f5fb8', belly: '#dfe8f6', fin: '#284f9a', pattern: 'whitespots', aura: '#8ae0ff' },
  rainbow_mosasaur: { name: 'Rainbow Mosasaur', rarity: 'MYTHIC', earn: 52000000, shape: 'mosasaur', size: 12, body: '#ffffff', belly: '#ffffff', fin: '#ffffff', rainbow: true, aura: '#ffffff' },
  goldfish: { name: 'Goldfish', rarity: 'COMMON', earn: zoneEarn('COMMON', 0), shape: 'fish', size: 1.5, body: '#ff8a1a', belly: '#ffc04a', fin: '#ff9a3a', pattern: 'tailfan' },
  betta: { name: 'Betta', rarity: 'COMMON', earn: zoneEarn('COMMON', 0), shape: 'fish', size: 1.5, body: '#3a4aff', belly: '#ff3a6a', fin: '#ff3a6a', pattern: 'tailfan' },
  clownfish: { name: 'Clownfish', rarity: 'UNCOMMON', earn: zoneEarn('UNCOMMON', 0), shape: 'fish', size: 1.4, body: '#ff7a1a', belly: '#ff7a1a', fin: '#1a1a1a', pattern: 'bands', accent: '#ffffff' },
  pufferfish: { name: 'Pufferfish', rarity: 'UNCOMMON', earn: zoneEarn('UNCOMMON', 0), shape: 'puffer', size: 1.5, body: '#e8d070', belly: '#fff6d0', fin: '#8a7a40', pattern: 'spots', accent: '#6a5a20' },
  arctic_char: { name: 'Arctic Char', rarity: 'UNCOMMON', earn: zoneEarn('UNCOMMON', 1), shape: 'fish', size: 1.8, body: '#5a8ab0', belly: '#ff8a6a', fin: '#c84a3a', pattern: 'speckle', accent: '#ffffff' },
  snow_lionfish: { name: 'Snow Lionfish', rarity: 'UNCOMMON', earn: zoneEarn('UNCOMMON', 1), shape: 'lionfish', size: 1.8, body: '#e8f4ff', belly: '#ffffff', fin: '#8ac8f0', pattern: 'bands', accent: '#7ab0e0' },
  ice_carp: { name: 'Ice Carp', rarity: 'UNCOMMON', earn: zoneEarn('UNCOMMON', 1), shape: 'fish', size: 2.0, body: '#b8d8f0', belly: '#ffffff', fin: '#8ab8e0' },
  frost_pike: { name: 'Frost Pike', rarity: 'UNCOMMON', earn: zoneEarn('UNCOMMON', 1), shape: 'mahi', size: 2.6, body: '#7a9ab8', belly: '#e8f0f8', fin: '#5a7a98', pattern: 'spots', accent: '#ffffff' },
  frost_scorpionfish: { name: 'Frost Scorpionfish', rarity: 'UNCOMMON', earn: zoneEarn('UNCOMMON', 1), shape: 'lionfish', size: 1.7, body: '#a8c8e8', belly: '#e8f4ff', fin: '#6a9ac8', pattern: 'speckle', accent: '#ffffff' },
  ice_puffer: { name: 'Ice Puffer', rarity: 'RARE', earn: zoneEarn('RARE', 1), shape: 'puffer', size: 1.7, body: '#bfe8ff', belly: '#ffffff', fin: '#7ac8f0' },
  glacier_grouper: { name: 'Glacier Grouper', rarity: 'RARE', earn: zoneEarn('RARE', 1), shape: 'fish', size: 2.6, body: '#6aa8d8', belly: '#d8eef8', fin: '#4a88b8', pattern: 'spots', accent: '#e8f8ff' },
  ice_angler: { name: 'Ice Anglerfish', rarity: 'RARE', earn: zoneEarn('RARE', 1), shape: 'angler', size: 2.2, body: '#2a4a6a', belly: '#4a6a8a', fin: '#1a3a5a', accent: '#bff6ff' },
  river_crab: { name: 'River Crab', rarity: 'UNCOMMON', earn: zoneEarn('UNCOMMON', 2), shape: 'crab', size: 2.0, body: '#d8501a', belly: '#ff9a5a', fin: '#b83a10' },
  crayfish: { name: 'Crayfish', rarity: 'UNCOMMON', earn: zoneEarn('UNCOMMON', 2), shape: 'lobster', size: 1.8, body: '#8a3a1a', belly: '#c86a3a', fin: '#6a2a10' },
  leafy_seadragon: { name: 'Leafy Seadragon', rarity: 'RARE', earn: zoneEarn('RARE', 2), shape: 'seahorse', size: 2.0, body: '#9ad83a', belly: '#e8f08a', fin: '#5ab02a' },
  mantis_shrimp: { name: 'Mantis Shrimp', rarity: 'RARE', earn: zoneEarn('RARE', 2), shape: 'lobster', size: 1.8, body: '#3ad8a0', belly: '#ffd23a', fin: '#ff3a6a' },
  amazon_puffer: { name: 'Amazon Puffer', rarity: 'RARE', earn: zoneEarn('RARE', 2), shape: 'puffer', size: 1.6, body: '#8ac83a', belly: '#f8f0a0', fin: '#5a8a2a', pattern: 'spots', accent: '#3a5a1a' },
  leatherback: { name: 'Leatherback Turtle', rarity: 'EPIC', earn: zoneEarn('EPIC', 2), shape: 'turtle', size: 3.0, body: '#3a4a3a', belly: '#8a9a8a', fin: '#2a3a2a', pattern: 'shell', accent: '#1a2a1a' },
  sand_shark: { name: 'Sand Shark', rarity: 'RARE', earn: zoneEarn('RARE', 3), shape: 'shark', size: 5, body: '#d8b87a', belly: '#f8ecd0', fin: '#b8985a' },
  desert_grouper: { name: 'Desert Grouper', rarity: 'RARE', earn: zoneEarn('RARE', 3), shape: 'fish', size: 3, body: '#c8a060', belly: '#f0dca8', fin: '#a8803a', pattern: 'spots', accent: '#8a6020' },
  barracuda: { name: 'Barracuda', rarity: 'RARE', earn: zoneEarn('RARE', 3), shape: 'mahi', size: 3.5, body: '#a8b0b8', belly: '#e8ecf0', fin: '#7a8088', pattern: 'bands', accent: '#5a6068' },
  yellowfin_tuna: { name: 'Yellowfin Tuna', rarity: 'EPIC', earn: zoneEarn('EPIC', 3), shape: 'fish', size: 3, body: '#2a4a8a', belly: '#e8e8f0', fin: '#ffd21a' },
  swordfish: { name: 'Swordfish', rarity: 'EPIC', earn: zoneEarn('EPIC', 3), shape: 'marlin', size: 5, body: '#4a5a7a', belly: '#d8e0e8', fin: '#3a4a6a' },
  blue_marlin: { name: 'Blue Marlin', rarity: 'EPIC', earn: zoneEarn('EPIC', 3), shape: 'marlin', size: 5.5, body: '#1a4ab8', belly: '#e8f0ff', fin: '#1a3a98' },
  sailfish: { name: 'Sailfish', rarity: 'LEGENDARY', earn: zoneEarn('LEGENDARY', 3), shape: 'sail', size: 5.5, body: '#2a5ac8', belly: '#e8f0ff', fin: '#4a8aff', pattern: 'spots', accent: '#8ac8ff' },
  sand_whale: { name: 'Sand Whale', rarity: 'LEGENDARY', earn: zoneEarn('LEGENDARY', 3), shape: 'whale', size: 12, body: '#d8b070', belly: '#f8e8c8', fin: '#b89050' },
  bog_puffer: { name: 'Bog Puffer', rarity: 'EPIC', earn: zoneEarn('EPIC', 4), shape: 'puffer', size: 1.8, body: '#6a7a3a', belly: '#c8c88a', fin: '#4a5a2a', pattern: 'spots', accent: '#3a4a1a' },
  swamp_angler: { name: 'Swamp Anglerfish', rarity: 'EPIC', earn: zoneEarn('EPIC', 4), shape: 'angler', size: 2.4, body: '#3a4a2a', belly: '#5a6a3a', fin: '#2a3a1a', accent: '#c8ff6a' },
  mud_octopus: { name: 'Mud Octopus', rarity: 'EPIC', earn: zoneEarn('EPIC', 4), shape: 'octopus', size: 2.8, body: '#8a5a3a', belly: '#c89a7a', fin: '#6a3a2a', accent: '#a87a5a' },
  lantern_angler: { name: 'Lantern Anglerfish', rarity: 'EPIC', earn: zoneEarn('EPIC', 4), shape: 'angler', size: 2.4, body: '#2a2a4a', belly: '#4a4a6a', fin: '#1a1a3a', accent: '#ffe04a' },
  swamp_eel: { name: 'Swamp Eel', rarity: 'EPIC', earn: zoneEarn('EPIC', 4), shape: 'eel', size: 4, body: '#4a5a2a', belly: '#8a9a4a', fin: '#2a3a1a', pattern: 'spots', accent: '#2a3010' },
  giant_catfish: { name: 'Giant Catfish', rarity: 'LEGENDARY', earn: zoneEarn('LEGENDARY', 4), shape: 'catfish', size: 4.5, body: '#5a5040', belly: '#a89a80', fin: '#3a3020' },
  bull_shark: { name: 'Bull Shark', rarity: 'LEGENDARY', earn: zoneEarn('LEGENDARY', 4), shape: 'shark', size: 7, body: '#7a8a7a', belly: '#e8ece8', fin: '#5a6a5a' },
  cave_shark: { name: 'Cave Shark', rarity: 'EPIC', earn: zoneEarn('EPIC', 5), shape: 'shark', size: 6, body: '#4a4a6a', belly: '#a8a8c8', fin: '#3a3a5a' },
  crystal_shark: { name: 'Crystal Shark', rarity: 'EPIC', earn: zoneEarn('EPIC', 5), shape: 'shark', size: 6.5, body: '#6ad8ff', belly: '#e8faff', fin: '#3ab8f0', aura: '#8ae8ff' },
  narwhal: { name: 'Narwhal', rarity: 'LEGENDARY', earn: zoneEarn('LEGENDARY', 5), shape: 'narwhal', size: 8, body: '#9aa8b8', belly: '#e8ecf0', fin: '#7a8898', pattern: 'spots', accent: '#5a6878' },
  goblin_shark: { name: 'Goblin Shark', rarity: 'LEGENDARY', earn: zoneEarn('LEGENDARY', 5), shape: 'sawfish', size: 6, body: '#d8a0a8', belly: '#f0d0d4', fin: '#b88088' },
  crystal_megalodon: { name: 'Crystal Megalodon', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 5), shape: 'megalodon', size: 10, body: '#5ac8f0', belly: '#d8f4ff', fin: '#3aa8e0', aura: '#8ae8ff' },
  abyss_whale: { name: 'Abyss Whale', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 5), shape: 'whale', size: 14, body: '#1a1a3a', belly: '#3a3a6a', fin: '#101028', aura: '#6a6aff' },
  giant_grouper: { name: 'Giant Grouper', rarity: 'LEGENDARY', earn: zoneEarn('LEGENDARY', 6), shape: 'fish', size: 3.5, body: '#6a5a3a', belly: '#c8b08a', fin: '#4a3a20', pattern: 'spots', accent: '#3a2a10' },
  bluefin_tuna: { name: 'Bluefin Tuna', rarity: 'LEGENDARY', earn: zoneEarn('LEGENDARY', 6), shape: 'fish', size: 3.5, body: '#1a2a6a', belly: '#d8dce8', fin: '#3a5aa8' },
  island_crab: { name: 'Island Crab', rarity: 'LEGENDARY', earn: zoneEarn('LEGENDARY', 6), shape: 'crab', size: 3, body: '#ff6a3a', belly: '#ffb08a', fin: '#d84a1a' },
  plesiosaur: { name: 'Plesiosaur', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 6), shape: 'mosasaur', size: 11, body: '#3a8a8a', belly: '#c8e8e0', fin: '#2a6a6a' },
  blue_whale: { name: 'Blue Whale', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 6), shape: 'whale', size: 16, body: '#3a6ab8', belly: '#c8d8f0', fin: '#2a5aa0', pattern: 'spots', accent: '#8ab0e0' },
  coral_mosasaur: { name: 'Coral Mosasaur', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 6), shape: 'mosasaur', size: 12, body: '#ff6a8a', belly: '#ffd0d8', fin: '#e84a6a' },
  coral_megalodon: { name: 'Coral Megalodon', rarity: 'SECRET', earn: zoneEarn('SECRET', 6), shape: 'megalodon', size: 12, body: '#ff7a5a', belly: '#ffe0d0', fin: '#e85a3a', aura: '#ffb0a0' },
  toadstool_puffer: { name: 'Toadstool Puffer', rarity: 'LEGENDARY', earn: zoneEarn('LEGENDARY', 7), shape: 'puffer', size: 2, body: '#e83a2a', belly: '#fff4e8', fin: '#c82a1a', pattern: 'spots', accent: '#ffffff' },
  spore_puffer: { name: 'Spore Puffer', rarity: 'LEGENDARY', earn: zoneEarn('LEGENDARY', 7), shape: 'puffer', size: 2, body: '#a85ae8', belly: '#f0e0ff', fin: '#8a3ac8', pattern: 'spots', accent: '#e8c8ff' },
  fungal_angler: { name: 'Fungal Anglerfish', rarity: 'LEGENDARY', earn: zoneEarn('LEGENDARY', 7), shape: 'angler', size: 2.6, body: '#6a3a8a', belly: '#9a6aba', fin: '#4a2a6a', accent: '#7affb0' },
  fungi_lionfish: { name: 'Fungi Lionfish', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 7), shape: 'lionfish', size: 2.4, body: '#e85a2a', belly: '#fff0e0', fin: '#c83a1a', pattern: 'bands', accent: '#ffffff' },
  coelacanth: { name: 'Coelacanth', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 7), shape: 'fish', size: 4, body: '#3a5a8a', belly: '#6a8ab0', fin: '#2a4a7a', pattern: 'spots', accent: '#c8d8f0' },
  sawfish: { name: 'Sawfish', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 7), shape: 'sawfish', size: 8, body: '#8a8a7a', belly: '#e0e0d0', fin: '#6a6a5a' },
  mushroom_shark: { name: 'Mushroom Shark', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 7), shape: 'shark', size: 8, body: '#c84a8a', belly: '#f8d8e8', fin: '#a83a6a', pattern: 'whitespots' },
  mycelium_whale: { name: 'Mycelium Whale', rarity: 'SECRET', earn: zoneEarn('SECRET', 7), shape: 'whale', size: 16, body: '#8a6ab8', belly: '#e0d0f8', fin: '#6a4a98', pattern: 'spots', accent: '#c8ffd8', aura: '#c8ffd8' },
  sakura_betta: { name: 'Sakura Betta', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 8), shape: 'fish', size: 2, body: '#ff8ac8', belly: '#ffe0f0', fin: '#ff5aa8', pattern: 'tailfan' },
  blossom_puffer: { name: 'Blossom Puffer', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 8), shape: 'puffer', size: 2.2, body: '#ffb0d8', belly: '#fff0f8', fin: '#ff7ab8' },
  petal_carp: { name: 'Petal Carp', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 8), shape: 'fish', size: 2.6, body: '#ffc0d8', belly: '#ffffff', fin: '#ff8ab0', pattern: 'spots', accent: '#ff5a8a' },
  sakura_koi: { name: 'Sakura Koi', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 8), shape: 'fish', size: 3, body: '#ffffff', belly: '#ffffff', fin: '#ff6a8a', pattern: 'spots', accent: '#ff4a6a' },
  sakura_swordfish: { name: 'Sakura Swordfish', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 8), shape: 'marlin', size: 6, body: '#ff9ac8', belly: '#fff0f8', fin: '#e86aa8' },
  sakura_mahi: { name: 'Sakura Mahi Mahi', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 8), shape: 'mahi', size: 4, body: '#ff8ac8', belly: '#ffe08a', fin: '#c86ae8', pattern: 'speckle', accent: '#ffffff' },
  blossom_shark: { name: 'Blossom Shark', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 8), shape: 'shark', size: 8, body: '#ffa8d0', belly: '#fff4fa', fin: '#e87ab0' },
  sakura_leviathan: { name: 'Sakura Leviathan', rarity: 'SECRET', earn: zoneEarn('SECRET', 8), shape: 'mosasaur', size: 14, body: '#ff8ac8', belly: '#fff0f8', fin: '#c85aa8', aura: '#ffc8e8' },
  gummy_fish: { name: 'Gummy Fish', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 9), shape: 'fish', size: 2.4, body: '#ff3a6a', belly: '#ff8aa8', fin: '#ffd23a', pattern: 'bands', accent: '#3ae0ff' },
  jellybean_puffer: { name: 'Jellybean Puffer', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 9), shape: 'puffer', size: 2.4, body: '#a8ff3a', belly: '#ffff8a', fin: '#ff3ab8', pattern: 'spots', accent: '#3ad8ff' },
  taffy_carp: { name: 'Taffy Carp', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 9), shape: 'fish', size: 3, body: '#ffb0e0', belly: '#ffffff', fin: '#8ad8ff', pattern: 'bands', accent: '#ffffff' },
  lollipop_shark: { name: 'Lollipop Shark', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 9), shape: 'shark', size: 7, body: '#ff6ab8', belly: '#ffffff', fin: '#ffd23a', pattern: 'bands', accent: '#ffffff' },
  bubblegum_shark: { name: 'Bubblegum Shark', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 9), shape: 'shark', size: 8, body: '#ff9ad8', belly: '#ffe0f4', fin: '#ff6ab8' },
  cotton_candy_shark: { name: 'Cotton Candy Shark', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 9), shape: 'shark', size: 8.5, body: '#a8d8ff', belly: '#ffd0f0', fin: '#ff9ad8' },
  jawbreaker_whale: { name: 'Jawbreaker Whale', rarity: 'MYTHIC', earn: zoneEarn('MYTHIC', 9), shape: 'whale', size: 14, body: '#3a8aff', belly: '#ffd23a', fin: '#ff3a6a', pattern: 'bands', accent: '#ffffff' },
  candy_orca: { name: 'Candy Orca', rarity: 'SECRET', earn: zoneEarn('SECRET', 9), shape: 'orca', size: 12, body: '#ff3a8a', belly: '#ffffff', fin: '#ff3a8a', aura: '#ffc0e0' },
  rainbow_megalodon: { name: 'Rainbow Megalodon', rarity: 'MYTHIC', earn: 95000000, shape: 'megalodon', size: 12, body: '#ffffff', belly: '#ffffff', fin: '#ffffff', rainbow: true, aura: '#ffffff' },
}

// Your head on your plot's owner tag (other players' plots get one picked from their name).
export const MY_HEAD = { skin: '#f2c79a', hair: '#c4561a', face: 'smile' }

// The run lane beyond the finish line. Only its shell for now (walls, ground, the first
// river with a tunnel through each wall); the lane's contents come later.
export const LANE = {
  river: { width: 8, color: '#4fdcfa', bank: '#a98cf0', bankDark: '#8a6ed8', curbWidth: 0.7, curbHeight: 0.32, tunnel: '#9a82e8', tunnelDark: '#7a62c8' },
}

// Lane zones, south to north. Crossing into one shows its banner. Each has one river
// (z = centre line) where the rod can be cast, the fish it holds (weighted picks,
// weight range in kg) and the guard that chases a player carrying a fish out.
export const ZONES = [
  {
    id: 'forest',
    name: 'FOREST',
    start: 0, // z where the zone begins (the finish line)
    end: -69, // z where the next zone begins (the far bank of its last river)
    banner: ['#d8ff4a', '#3ac800'], // gradient of the banner text
    speed: 5, // recommended speed (SPEED; the HUD shows x SPEED.display = 50): a new player (1) must train first
    rivers: [-20, -64], // river centre lines: the fishing river and the one closing the zone
    guard: { kind: 'bear', home: { x: 14, z: -75 }, roam: { hx: 22, hz: 3 } }, // just over the closing river, guarding the way into Winter
    fish: [['neon_tetra', 30], ['guppy', 30], ['goldfish', 24], ['royal_gramma', 20], ['betta', 18], ['clownfish', 8], ['pufferfish', 7], ['black_moor', 6]],
    weight: [0.3, 1.4],
  },
  // Zones 2+: `theme` dresses the ground, wall facings, river and ambient effects
  // from `from` (z, default the zone start) to the zone's end; `props` picks the
  // set dressing in lane/themes.js; `sky` tints the sky and light while inside.
  {
    id: 'winter',
    name: 'WINTER',
    start: -69,
    end: -169,
    banner: ['#ffffff', '#6ad0ff'],
    speed: 20,
    rivers: [-155],
    guard: { kind: 'wolf', home: { x: 12, z: -164 }, roam: { hx: 24, hz: 3 } },
    theme: { from: -95, ground: ['#f2f5f8', '#d8e0ea', '#ffffff'], wall: ['#b8b2cc', '#9a94b2', '#cfcae0', '#f6f8fb'], step: 0.22, props: 'winter', ambient: 'snow' },
    sky: { zenith: '#7ab8e8', horizon: '#eef6fb', hemiGround: '#e0e8f0' },
    fish: [['arctic_char', 30], ['snow_lionfish', 28], ['ice_carp', 26], ['frost_pike', 22], ['frost_scorpionfish', 20], ['ice_puffer', 9], ['glacier_grouper', 8], ['ice_angler', 6]],
    weight: [0.5, 2.2],
  },
  {
    id: 'jungle',
    name: 'JUNGLE',
    start: -169,
    end: -269,
    banner: ['#9aff4a', '#1a9a2a'],
    speed: 80,
    rivers: [-255],
    guard: { kind: 'tiger', home: { x: 10, z: -264 }, roam: { hx: 22, hz: 3 } },
    theme: { ground: ['#5cd61c', '#46b812', '#78ea36'], wall: ['#b82818', '#8a1a10', '#d03a28', '#5cd61c'], step: 0, props: 'jungle', ambient: 'fireflies', water: '#3ae8e0' },
    fish: [['seahorse', 30], ['river_crab', 28], ['crayfish', 26], ['leafy_seadragon', 12], ['mantis_shrimp', 11], ['amazon_puffer', 10], ['sea_turtle', 4], ['leatherback', 3]],
    weight: [0.6, 3],
  },
  {
    id: 'desert',
    name: 'DESERT',
    start: -269,
    end: -369,
    banner: ['#ffe68a', '#e89a2a'],
    speed: 300,
    rivers: [-355],
    guard: { kind: 'lion', home: { x: -8, z: -364 }, roam: { hx: 22, hz: 3 } },
    theme: { ground: ['#f8c41a', '#e8a810', '#ffd84a'], wall: ['#f0a018', '#d0860c', '#ffbc3a', '#f8c41a'], plate: ['#f0b414', '#d8960c'], step: 0, props: 'desert', ambient: 'dust' },
    sky: { horizon: '#fff2d8', sunColor: '#fff2d8' },
    fish: [['sand_shark', 30], ['desert_grouper', 28], ['barracuda', 26], ['yellowfin_tuna', 12], ['swordfish', 11], ['blue_marlin', 10], ['sailfish', 4], ['sand_whale', 3]],
    weight: [0.8, 6],
  },
  {
    id: 'swamp',
    name: 'SWAMP',
    start: -369,
    end: -469,
    banner: ['#d8e86a', '#6a7a1a'],
    speed: 1200,
    rivers: [-455],
    guard: { kind: 'panther', home: { x: 6, z: -464 }, roam: { hx: 22, hz: 3 } },
    theme: { ground: ['#9e9a14', '#84800c', '#b6b02a'], wall: ['#a8201a', '#7a1410', '#c0342a', '#7a8a1a'], step: 0, props: 'swamp', ambient: 'fireflies', water: '#3aa89a' },
    fish: [['bog_puffer', 26], ['swamp_angler', 24], ['mud_octopus', 22], ['lantern_angler', 20], ['swamp_eel', 18], ['electric_eel', 6], ['giant_catfish', 5], ['bull_shark', 4]],
    weight: [1, 8],
  },
  {
    id: 'cave',
    name: 'CAVE',
    start: -469,
    end: -569,
    banner: ['#9ae8ff', '#5a6aff'],
    speed: 5000,
    rivers: [-555],
    guard: { kind: 'ankylo', home: { x: -8, z: -564 }, roam: { hx: 22, hz: 3 } },
    theme: { ground: ['#7a8aaa', '#647494', '#90a0c0'], wall: ['#3c5a8a', '#2c4470', '#4c6c9e', '#3c5a8a'], plate: ['#8898b8', '#5a6a8a'], step: 0, props: 'cave', ambient: 'crystal', water: '#3ae8ff' },
    fish: [['cave_shark', 26], ['great_white', 24], ['crystal_shark', 22], ['narwhal', 9], ['goblin_shark', 8], ['orca', 7], ['crystal_megalodon', 3], ['abyss_whale', 2]],
    weight: [2, 15],
  },
  {
    id: 'coral',
    name: 'CORAL',
    start: -569,
    end: -669,
    banner: ['#ffb0d0', '#ff5a8a'],
    speed: 2e4,
    rivers: [-655],
    guard: { kind: 'dragon', home: { x: 4, z: -664 }, roam: { hx: 22, hz: 3 } },
    theme: { ground: ['#f8e6bc', '#ead2a0', '#fff4d8'], wall: ['#f0a87a', '#d8885a', '#ffc094', '#6ad83a'], plate: ['#f0d8a8', '#dcc08a'], step: 0, props: 'coral', ambient: 'bubbles', water: '#3ae0f8' },
    fish: [['giant_grouper', 26], ['bluefin_tuna', 24], ['island_crab', 22], ['plesiosaur', 9], ['blue_whale', 8], ['whale_shark', 7], ['coral_mosasaur', 6], ['coral_megalodon', 1]],
    weight: [3, 20],
  },
  {
    id: 'mushroom',
    name: 'MUSHROOM',
    start: -669,
    end: -769,
    banner: ['#ffb0f0', '#a84ae8'],
    speed: 8e4,
    rivers: [-755],
    guard: { kind: 'unicorn', home: { x: -6, z: -764 }, roam: { hx: 22, hz: 3 } },
    theme: { ground: ['#8ae010', '#70c008', '#a8f030'], wall: ['#f08a1a', '#d06a0a', '#ffa030', '#8ae010'], step: 0, props: 'mushroom', ambient: 'spores', water: '#ff2ae0', curb: ['#3a8aff', '#2a6ad8'], waterfall: true },
    fish: [['toadstool_puffer', 26], ['spore_puffer', 24], ['fungal_angler', 22], ['fungi_lionfish', 9], ['coelacanth', 8], ['sawfish', 7], ['mushroom_shark', 6], ['mycelium_whale', 1]],
    weight: [3, 25],
  },
  {
    id: 'sakura',
    name: 'SAKURA',
    start: -769,
    end: -869,
    banner: ['#ffe0f0', '#ff6ab0'],
    speed: 3e5,
    rivers: [-855],
    guard: { kind: 'phoenix', home: { x: 6, z: -864 }, roam: { hx: 22, hz: 3 } },
    theme: { ground: ['#8ae818', '#72c810', '#a6f43a'], wall: ['#e8c48c', '#d0a86c', '#f8dcac', '#8ae818'], plate: ['#8ae818', '#e8c48c'], step: 0, props: 'sakura', ambient: 'petals', water: '#3ae8f8', curb: ['#a8d8f8', '#88b8e0'], waterfall: true },
    fish: [['sakura_betta', 16], ['blossom_puffer', 15], ['petal_carp', 14], ['sakura_koi', 13], ['sakura_swordfish', 12], ['sakura_mahi', 11], ['blossom_shark', 10], ['sakura_leviathan', 1]],
    weight: [4, 30],
  },
  {
    id: 'candy',
    name: 'CANDY',
    start: -869,
    end: -969,
    banner: ['#fff0a0', '#ff5ac8'],
    speed: 1.2e6,
    rivers: [-955],
    guard: { kind: 'flamingo', home: { x: -4, z: -964 }, roam: { hx: 22, hz: 3 } },
    theme: { ground: ['#f8b8e0', '#e8a0d0', '#ffd8f0'], wall: ['#f8a8d4', '#e088b8', '#ffc8e6', '#ffffff'], plate: ['#ffffff', '#f0c8e0'], step: 0, props: 'candy', ambient: 'sprinkles', water: '#ff9ad8', curb: ['#ffffff', '#f0c8e0'] },
    fish: [['gummy_fish', 16], ['jellybean_puffer', 15], ['taffy_carp', 14], ['lollipop_shark', 13], ['bubblegum_shark', 12], ['cotton_candy_shark', 11], ['jawbreaker_whale', 10], ['candy_orca', 1]],
    weight: [5, 40],
  },
]
// Zone banner on entering a zone.
export const ZONE_BANNER = { hold: 1.8, fade: 0.6 } // s

// Fishing (src/lane/fishing.js).
export const FISHING = {
  reach: 3.2, // m from the bank (either side) the Cast button shows
  castDistance: 4.5, // m out over the water the bobber lands
  castTime: 0.55, // s the bobber flies
  bite: [1.4, 3.2], // s range before a fish bites
  clicks: { COMMON: 10, UNCOMMON: 13, RARE: 16, EPIC: 20, LEGENDARY: 24, MYTHIC: 28 }, // clicks to land it
  decay: 0.16, // progress lost per second without clicks (0..1)
  timeLimit: 9, // s before the fish gets away
  leapTime: 0.75, // s the caught fish flies from the water to the player's hands
  lineColor: '#d9c9a0',
}

// The zone guard (src/lane/guard.js).
// Each zone's guard chases a player carrying a fish caught in its own zone (guards of
// the zones run back through leave them alone), and anyone without a fish reaching the
// end part of its zone: from `approach` m before the zone's end (never over a river's
// fishing banks) up to `gateDepth` m into the next zone. It blocks the way on until the
// player is fast enough to outrun it, so every guard roams near its zone's end. Its chase
// speed comes from the zone's recommended `speed` (SPEED.chaseFactor), not from the animal.
// overtake: below a zone's recommended speed its guard runs at least this x your run speed and
// chases you past the gate until it catches you (lane/index.js), so every zone needs training.
export const GUARD = {
  gateDepth: 60,
  approach: 6,
  overtake: 1.25,
  // build: type 'quadruped' (default) or 'bird'. Quadruped: body voxels [x, y, z], legH /
  // legW (m), head 'round' | 'snout', ears 'round' | 'pointed' | 'none', tail 'none' |
  // 'thin' | 'bushy' | 'thick' | 'club' | 'long' | 'rainbow', coat pattern, and extras
  // (mane colour | 'rainbow', horn, horns, wings, plates, ridge, teeth, neck, glowing eyes).
  // Bird: body voxels, legH, wingspan, beak, legs colour, flying + hover height.
  bear: { length: 4.2, walkSpeed: 2.2, catchRadius: 1.9, roar: 0.7, rear: 0.75, body: '#a08262', dark: '#7a6248', light: '#c8ae8a', nose: '#2a2018', build: { body: [10, 9, 17], legH: 1.15, legW: 0.55, head: 'round', ears: 'round', tail: 'none', paws: '#5a4634', legs: '#7a6248' } },
  wolf: { length: 4.6, walkSpeed: 2.8, catchRadius: 2.0, roar: 0.6, rear: 0.25, body: '#9a9ca6', dark: '#6a6c78', light: '#f2f3f6', nose: '#1c1c22', dust: '#ffffff', build: { body: [8, 8, 17], legH: 1.35, legW: 0.42, head: 'snout', ears: 'pointed', tail: 'bushy', pattern: 'saddle', chest: true, paws: '#f2f3f6' } },
  tiger: { length: 4.8, walkSpeed: 2.6, catchRadius: 2.0, roar: 0.6, rear: 0.4, body: '#f49a1a', dark: '#1e1a18', light: '#fff4e0', nose: '#e86a7a', build: { body: [8, 9, 18], legH: 1.25, legW: 0.5, head: 'round', ears: 'round', tail: 'thin', pattern: 'stripes', chest: true, paws: '#fff4e0' } },
  lion: { length: 4.8, walkSpeed: 2.4, catchRadius: 2.0, roar: 0.8, rear: 0.4, body: '#e8c48a', dark: '#c09a5a', light: '#f8e4bc', nose: '#5a3020', mane: '#6a3a1a', dust: '#ffe08a', build: { body: [9, 8, 17], legH: 1.25, legW: 0.5, head: 'round', ears: 'round', tail: 'thin', tuft: true, mane: true } },
  panther: { length: 4.8, walkSpeed: 2.6, catchRadius: 2.0, roar: 0.6, rear: 0.4, body: '#22222a', dark: '#101016', light: '#34343e', nose: '#0a0a10', build: { body: [8, 8, 18], legH: 1.25, legW: 0.46, head: 'round', ears: 'round', tail: 'thin', eyes: '#ffe020' } },
  ankylo: { length: 6.2, walkSpeed: 2.0, catchRadius: 2.6, roar: 0.7, rear: 0.2, body: '#c07a3a', dark: '#6a3a1a', light: '#e8b070', nose: '#3a2010', build: { body: [12, 7, 20], legH: 0.75, legW: 0.62, head: 'snout', ears: 'none', tail: 'club', pattern: 'armour', plates: '#e8c890' } },
  dragon: { length: 6.4, walkSpeed: 2.4, catchRadius: 2.4, roar: 0.9, rear: 0.6, body: '#d82418', dark: '#7a0e0a', light: '#f4dcae', nose: '#3a0a0a', roarFx: 'glow', roarColor: '#ff7a1a', build: { body: [8, 9, 18], legH: 1.5, legW: 0.5, head: 'snout', ears: 'none', tail: 'long', chest: true, horns: '#f4e4c0', wings: '#3a1414', ridge: '#7a0e0a', teeth: true, neck: true, legs: '#c01e14', paws: '#5a0a0a' } },
  unicorn: { length: 4.4, walkSpeed: 2.6, catchRadius: 2.0, roar: 0.6, rear: 0.7, body: '#f8f8fc', dark: '#dcdce6', light: '#ffffff', nose: '#e8b8c8', roarFx: 'spark', roarColor: '#ffe0ff', build: { body: [7, 8, 16], legH: 1.9, legW: 0.36, head: 'snout', ears: 'pointed', tail: 'rainbow', mane: 'rainbow', horn: '#ffd84a', neck: true, paws: '#b8a8f8' } },
  phoenix: { length: 6.8, walkSpeed: 3.0, catchRadius: 2.6, roar: 0.6, body: '#ff6a1a', dark: '#d8380a', light: '#ffd21a', roarFx: 'glow', roarColor: '#ffb020', build: { type: 'bird', body: [7, 6, 14], legH: 0.8, wingspan: 7, beak: '#ffe23a', legs: '#c84a0a', flying: true, hover: 3.2 } },
  flamingo: { length: 3.2, walkSpeed: 2.4, catchRadius: 2.0, roar: 0.5, body: '#ff7ab8', dark: '#e0508a', light: '#ffc4e0', dust: '#ffd0e8', build: { type: 'bird', body: [7, 6, 11], legH: 1.9, wingspan: 3.2, beak: '#1a1a1a', legs: '#ff6aa8' } },
}
// Being caught: thrown back to the start of the zone, lie there, stand up.
export const KNOCKBACK = { flight: 1.15, height: 8, lie: 1.3, getUp: 0.45, landZ: -4 }

// The bat (hotbar slot 2, src/bat.js): swing it at another player out in the lane (never in the
// hub, z >= 0) to knock them flying and steal the fish they carry overhead. The backend checks
// every hit (BONK in its constants.ts: range + latency slack, cooldown, immunity): keep `range`
// and `cooldown` in step with it.
export const BAT = {
  range: 4.2, // m from you to the target
  cone: 0.25, // cos of the half-angle in front of you a target must be in (~75 deg)
  cooldown: 0.6, // s between swings (backend cooldownMs 550)
  windup: 0.12, // s of wind-up before the strike lands
  swing: 0.42, // s of the whole swing animation
  shield: 300, // s (5 min) anyone bonked is safe from every attacker, shown as a bubble (backend shieldMs)
  immune: 600, // s before you can bonk the SAME player again (others are fine) (backend immuneMs)
  // The victim's flight: knocked up and away from the attacker, spinning, then lies dizzy.
  knock: { distance: 9, height: 6.5, flight: 0.95, lie: 1.0, getUp: 0.4 },
  hitStop: 0.075, // s the world nearly freezes on a hit you land / take
  shake: { hit: 0.35, bonked: 0.6 }, // camera shake (m) for the attacker / the victim
  bubble: 2.6, // s a chat bubble stays over a head
  // Chat bubbles: the attacker taunts (with a fish / without), the victim answers.
  taunts: ['Mine now!', 'Thanks for the fish!', 'Yoink!', 'Too slow!', 'Finders keepers!', 'Get bonked!'],
  bonks: ['BONK!', 'Home run!', 'Get bonked!', 'Bye bye!', 'Out of the park!'],
  ouch: ['Hey!!', 'My fish!!', 'Noooo!', 'Ouch!', 'Not cool!', "I'll get you!"],
  feedMax: 3, // lines in the bonk feed
  feedHold: 5, // s each feed line stays
}

// Economy (local until saves exist). Offline earnings are `offlineRate` of the online rate.
export const ECONOMY = { startMoney: 0, startGems: 0, offlineRate: 0.025, slowModeSpeed: 0.5 }
// The rotating "best fish" offer in the top-right of the HUD: [species, % of best, price].
// `price` is in cash (money); the fish arrives in your hands with earn = species earn x earnMult.
export const OFFERS = [
  { fish: 'rainbow_mosasaur', percent: 135, price: 250e6, earnMult: 1 },
  { fish: 'rainbow_megalodon', percent: 200, price: 900e6, earnMult: 1 },
]
// The HUD's x2 Speed tile: costs `price` cash, doubles the speed stat for `duration` s (this session).
export const SPEED_BOOST = { price: 150000, duration: 600, mult: 2 }
export const OFFER_ROTATE = 60 // s each offer stays up

export const TRAIL = { points: 44, spacing: 0.35, life: 1.0, height: 0.35, width: 1.0, teleport: 12 } // a flat glowing ribbon just above the ground; a jump over `teleport` m in one frame restarts it

// --- Trails (src/trails/) ------------------------------------------------------------------
// Bought with cash at the TRAILS stall. The equipped trail streams behind the player and
// multiplies the speed stat by `speed` (no trail = x1; see SPEED). `ball` = the card's swatch (CSS
// gradient stops, drawn diagonally), `colors` = the 3D ribbon from runner to tail.
// A new player owns no trail (x1 speed); a trail with `start: true` would be owned and equipped at boot.
export const TRAILS = [
  { id: 'grey', name: 'Grey Trail', rarity: 'Common', speed: 1.25, price: 0, ball: ['#e6e9ee', '#b4bac3', '#7c8591'], colors: ['#f2f4f8', '#9aa2ae'] },
  { id: 'green', name: 'Green Trail', rarity: 'Uncommon', speed: 1.5, price: 15e3, ball: ['#4ff090', '#22c46a', '#119a4c'], colors: ['#5dff9a', '#13b85a'] },
  { id: 'yellow', name: 'Yellow Trail', rarity: 'Uncommon', speed: 1.75, price: 100e3, ball: ['#ffe04a', '#ffbe2a', '#ff9a14'], colors: ['#fff23a', '#ffa21a'] },
  { id: 'blue', name: 'Blue Trail', rarity: 'Rare', speed: 2, price: 500e3, ball: ['#5ec4ff', '#2a8cf2', '#1658d8'], colors: ['#6acfff', '#1a5cff'] },
  { id: 'purple', name: 'Purple Trail', rarity: 'Rare', speed: 2.3, price: 10e6, ball: ['#c070ff', '#9246f0', '#6a2ad8'], colors: ['#c47aff', '#6a1aff'] },
  { id: 'red', name: 'Red Trail', rarity: 'Epic', speed: 2.6, price: 75e6, ball: ['#ff5a62', '#ec2a40', '#b4102c'], colors: ['#ff4a5a', '#c00a24'] },
  { id: 'galaxy', name: 'Galaxy Trail', rarity: 'Legendary', speed: 3, price: 750e6, ball: ['#e050ff', '#8a4af4', '#3a5aff'], colors: ['#e05aff', '#7a4aff', '#2a50ff'] },
  { id: 'fire', name: 'Fire Trail', rarity: 'Mythic', speed: 3.5, price: 5e9, ball: ['#ffd23a', '#ff8a1a', '#ff4a14', '#e8201a'], colors: ['#ffe03a', '#ff7a14', '#ff2a10'] },
  { id: 'rainbow', name: 'Rainbow Trail', rarity: 'Secret', speed: 4.5, price: 20e9, ball: ['#ff6a2a', '#ffb81a', '#ffe82a', '#6af23a', '#1ae0b0', '#1aa0ff', '#3a6aff'], colors: ['#ff3a3a', '#ffa21a', '#fff23a', '#3aff5a', '#1ad8ff', '#3a5aff', '#b03aff'] },
  { id: 'sakura', name: 'Sakura Trail', rarity: 'Exotic', speed: 5.5, price: 60e12, ball: ['#ff5ab4', '#ffa0d0', '#ff3a9a', '#ffb4c8', '#f04ab0', '#ff9ac0', '#ff3aa8'], colors: ['#ffb8d8', '#ff5ab4', '#ff9ac0', '#e83a9a'] },
  { id: 'aurora', name: 'Aurora Trail', rarity: 'Exotic', speed: 7, price: 200e12, ball: ['#2a6aff', '#a04aff', '#ff4ad0', '#ff7ab8', '#3ae8d0', '#2ab4ff', '#7a4aff'], colors: ['#3ae8d0', '#2ab4ff', '#a04aff', '#ff4ad0'] },
]

// --- Speed (src/speed.js, src/hub/treadmill.js) -------------------------------------------
// The speed stat (HUD bolt) = trained speed (the plot treadmill) x the equipped trail's
// `speed`. Run speed = walk / sprint speed x (1 + log10(stat) x perDecade), so every x10
// adds the same step: stat 1 -> 14 m/s sprint, 1K -> 28.7, 1M -> 43.4. Each zone has a
// recommended `speed`; its guard sprints at chaseFactor x a player sprinting at it, so
// below it the guard is the faster one.
// `display`: the HUD, treadmill and zone banners show the stat x display (a new player's 1 reads 10).
export const SPEED = { start: 1, display: 10, perDecade: 0.35, chaseFactor: 0.95 }

// The treadmill in front of your plot. Step on the belt: you walk by yourself toward the
// console (any key takes over) and the belt carries you back, so you stay on it; every
// `every` s on it is +`per` trained speed (the trail multiplies it). `walk` m/s auto
// walk, `drift` m/s the belt pushes you back while you stand still or walk against it.
// The Upgrade sign beside it (E / tap within `range` m) buys the next level for `cost`
// (the price of that level); `look` picks the TREADMILLS model.
export const TREADMILL = {
  range: 3.2,
  every: 2,
  walk: 4.5,
  drift: 1.6,
  levels: [
    // `per` is in stat units: the HUD shows it x SPEED.display, so 0.1 reads +1.
    { look: 'stone', per: 0.1, cost: 0 },
    { look: 'stone', per: 0.3, cost: 2500 },
    { look: 'wood', per: 1, cost: 15e3 },
    { look: 'wood', per: 3, cost: 100e3 },
    { look: 'gold', per: 10, cost: 750e3 },
    { look: 'gold', per: 30, cost: 6e6 },
    { look: 'amethyst', per: 100, cost: 60e6 },
    { look: 'amethyst', per: 300, cost: 600e6 },
  ],
}

// --- Your base (src/hub/base.js, looks in src/hub/baseDecor.js) ----------------------------
// The Base upgrade sign in front of your plot (E / tap within `range` m) buys the next level.
// Each level is { slots (fish that can swim in the pond and earn), cost (price of that level),
// tier (BASE.tiers: what the plot looks like) }. Level 2 adds the treadmill (tier 1+).
// Every change stays inside the plot's own fence, so neighbouring plots are never touched.
export const BASE = {
  range: 3.2,
  levels: [
    { slots: 4, cost: 0, tier: 0 },
    { slots: 5, cost: 5, tier: 1 },
    { slots: 6, cost: 500, tier: 1 },
    { slots: 7, cost: 2500, tier: 1 },
    { slots: 8, cost: 10e3, tier: 2 },
    { slots: 9, cost: 35e3, tier: 2 },
    { slots: 10, cost: 100e3, tier: 2 },
    { slots: 11, cost: 300e3, tier: 2 },
    { slots: 12, cost: 1e6, tier: 3 },
    { slots: 13, cost: 3e6, tier: 3 },
    { slots: 14, cost: 10e6, tier: 3 },
    { slots: 15, cost: 30e6, tier: 3 },
    { slots: 16, cost: 100e6, tier: 4 },
    { slots: 17, cost: 350e6, tier: 4 },
    { slots: 18, cost: 1.2e9, tier: 4 },
    { slots: 19, cost: 4e9, tier: 4 },
    { slots: 20, cost: 15e9, tier: 5 },
    { slots: 21, cost: 50e9, tier: 5 },
    { slots: 22, cost: 200e9, tier: 5 },
    { slots: 23, cost: 800e9, tier: 5 },
    { slots: 24, cost: 3e12, tier: 6 },
    { slots: 25, cost: 12e12, tier: 6 },
  ],
  // Looks, cumulative: fence (kind wood = the planks texture, else plain colour), deck, and
  // what each tier adds (lanterns + lily pads, rocks, a fountain + planters, flags + a glowing
  // pond rim, crystals). `treadmill`: tier 1 and up.
  tiers: [
    { name: 'Starter', fence: { kind: 'wood' }, deck: { color: '#c9a46a' } },
    { name: 'Wooden', fence: { kind: 'wood' }, deck: { kind: 'wood' } },
    { name: 'Cozy', fence: { kind: 'wood' }, deck: { kind: 'wood' }, lanterns: '#ffcf6a', lily: true },
    { name: 'Stone', fence: { color: '#a9adb8', dark: '#7c808c', light: '#c8ccd6' }, deck: { color: '#b4b8c2' }, lanterns: '#ffcf6a', lily: true, rocks: true },
    { name: 'Garden', fence: { color: '#f2f2f6', dark: '#c8c8d2', light: '#ffffff' }, deck: { color: '#d8c8a8' }, lanterns: '#ffe08a', lily: true, rocks: true, fountain: true, planters: true },
    { name: 'Golden', fence: { color: '#ffc21a', dark: '#e09a00', light: '#fff1a0', metal: true }, deck: { color: '#f6e2a8' }, lanterns: '#fff2a0', lily: true, rocks: true, fountain: true, planters: true, flags: '#ff3a3a', rim: '#ffe23a' },
    { name: 'Crystal', fence: { color: '#7a4ae8', dark: '#4a2a9a', light: '#c8a8ff', glow: '#a070ff' }, deck: { color: '#d8ccf4' }, lanterns: '#e0b0ff', lily: true, rocks: true, fountain: true, planters: true, flags: '#c070ff', rim: '#ff5ae8', crystals: '#c8a0ff' },
  ],
}
// --- Active fish (src/activeFish.js, src/hud/fishPanel.js) ------------------------------
// Up to the base's `slots` (BASE.levels) backpack fish swim in your pond ("active") and earn
// every second. START_FISH joins the backpack of a new player ({ species, weight kg, earn $/s,
// mutation, equipped }); mutation 'gold' shows the gold badge on the card.
export const START_FISH = [] // a new player starts with an empty backpack

// --- Player modes (modes.js) -------------------------------------------------
// 'character' = third-person chase cam with the avatar on screen.
// 'player' = first-person, the camera is the player's eyes and the avatar is hidden.
export const MODES = ['character', 'player']
export const START_MODE = 'character'

// --- Physics (physics.js, player.js) ------------------------------------------
export const PHYSICS = {
  gravity: -22, // m/s^2 for dynamic bodies and the player
  fixedStep: 1 / 60, // s per physics tick; rendering interpolates between ticks
  maxSubSteps: 5, // a long frame never runs more ticks than this
  walkSpeed: 8, // m/s
  sprintSpeed: 14, // m/s: the player always runs at this (no walk / sprint key)
  accel: 70, // m/s^2 toward the target velocity on the ground
  airAccel: 22, // m/s^2 steering while airborne
  decel: 60, // m/s^2 when no key is held
  turnSpeed: 12, // rad/s the body turns toward its heading
  jumpSpeed: 8.5, // m/s
  coyoteTime: 0.1, // s after leaving a ledge a jump still counts
  jumpBuffer: 0.12, // s a jump pressed before landing is remembered
  stepHeight: 0.45, // m autostep
  maxSlope: 50, // degrees the player can walk up
  snapToGround: 0.4, // m the controller stays glued to downward steps and slopes
  pushMass: 80, // kg the character weighs when shoving crates
  killY: -6, // sank this far: respawn
}
export const PLAYER_DIMS = { radius: 0.75, height: 1.8 } // capsule the character controller moves

// --- Look ------------------------------------------------------------------
export const RENDER = { exposure: 1.0, toneMapping: 'neutral' } // neutral keeps the toy colours saturated (ACES greys them)
export const FOG = { near: 100, far: 240 } // fully fogged by `far`, so anything past it can be culled (camera far, lane VISIBLE)
// The two lighting moods lighting.js blends between (key N toggles).
export const TIME_OF_DAY = {
  transition: 2.5, // s to blend day <-> night
  day: {
    // Bright cartoon noon: deep blue overhead fading to a pale cyan-white horizon.
    zenith: '#4cbcf6',
    horizon: '#e4fafb',
    sunColor: '#fff8ea',
    sunIntensity: 2.2,
    sunElevation: 62, // degrees above the horizon
    sunAzimuth: 35, // degrees, 0 = from +Z
    hemiSky: '#eef8ff',
    hemiGround: '#9ad860',
    hemiIntensity: 1.1,
    envIntensity: 0.5,
    lampIntensity: 0,
    stars: 0,
    exposure: 1.0,
  },
  night: {
    zenith: '#050b22',
    horizon: '#24345e',
    sunColor: '#9fb4ff', // the moon
    sunIntensity: 0.55,
    sunElevation: 38,
    sunAzimuth: -60,
    hemiSky: '#3a4c80',
    hemiGround: '#1a1a22',
    hemiIntensity: 0.35,
    envIntensity: 0.25,
    lampIntensity: 30,
    stars: 1,
    exposure: 1.15,
  },
}
export const LIGHT = {
  shadowRange: 40, // half-width of the sun's shadow box around the player
  lampColor: '#ffb35c',
  lampDistance: 22,
}

// Default (fallback) character look, used only when player.glb cannot load.
export const CHARACTER_COLORS = { skin: '#f2c79a', suit: '#2f6fd0', hair: '#4a2f1c' }

export const MATERIAL_PBR = {
  PLAYER: { roughness: 0.7, metalness: 0 },
  GROUND: { roughness: 0.95, metalness: 0 },
}

// --- Graphics presets, picked by the Bloxity graphics_quality setting ----------
export const GRAPHICS_PRESETS = {
  Low: { shadows: false, shadowMap: 512, antialias: false, dpr: 1, bloom: false, particles: 0.35 },
  Medium: { shadows: true, shadowMap: 1024, antialias: false, dpr: 1.25, bloom: false, particles: 0.6 },
  High: { shadows: true, shadowMap: 2048, antialias: true, dpr: 2, bloom: true, particles: 1 },
  Ultra: { shadows: true, shadowMap: 4096, antialias: true, dpr: 2, bloom: true, particles: 1 },
}

// Bloom (postfx.js): only HDR-bright pixels (above threshold, linear, before
// tone mapping) glow: neon rails, waterfall, VIP gate, particles. Sunlit sand
// stays under the threshold.
export const BLOOM = { strength: 0.6, radius: 0.35, threshold: 2.0 }
// Neon materials (propkit.js): k = HDR colour multiplier with bloom on; with
// bloom off they are capped at plainMax so they stay coloured, not white.
export const NEON = { k: 3.5, plainMax: 1.2 }

// Phones and tablets default to a lighter preset when the portal sends no value,
// and any preset is capped there (a phone at DPR 3 renders 9x the pixels; bloom
// is a full-screen multi-pass blur, so it stays off on phones).
export const COARSE_POINTER = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
export const DEFAULT_GRAPHICS = COARSE_POINTER ? 'Medium' : 'High'
export const MOBILE_GRAPHICS_CAP = { dpr: 1.5, shadowMap: 1024, particles: 0.6 }

// The preset to render with on this device.
export function graphicsPreset(name) {
  const p = GRAPHICS_PRESETS[name] ?? GRAPHICS_PRESETS[DEFAULT_GRAPHICS]
  if (!COARSE_POINTER) return p
  const cap = MOBILE_GRAPHICS_CAP
  return { ...p, dpr: Math.min(p.dpr, cap.dpr), shadowMap: Math.min(p.shadowMap, cap.shadowMap), bloom: false, particles: Math.min(p.particles, cap.particles) }
}

// --- Touch controls (touch.js) --------------------------------------------------
export const TOUCH = {
  deadZone: 0.12, // fraction of the joystick radius that does nothing
  lookScale: 1.5, // touch drag pixels -> look, relative to a mouse pixel
  pinchPixelsPerNotch: 30, // finger spread change that equals one wheel notch
}

// --- Camera (camera.js) -------------------------------------------------------
export const CAMERA = {
  fov: 70,
  near: 0.1,
  far: 1200, // must reach the sky dome (500) and clouds; fog + lane zone culling do the real draw-distance work
  startPitch: 0.24, // radians above the horizon
  minPitch: -0.35,
  maxPitch: 1.25,
  firstPersonPitch: 1.45, // |pitch| limit looking up/down in player mode
  eyeHeight: 0.92, // eye height as a fraction of player height (player mode)
  distance: 10,// resting boom length, m (the reference frames the avatar small, mid-screen)
  minDistance: 2.5, // wheel in past this enters player mode
  maxDistance: 34,
  followLerp: 14, // 1/s: the one smoothing stage, on the point the camera follows
  targetHeight: 1.2, // look-at point as a fraction of player height
  lookSensitivity: 0.0026, // rad per pixel of mouse movement
  zoomStep: 0.9, // m per wheel notch
  zoomEase: 12, // 1/s the zoom glides to its target
  speedFov: 6, // degrees the FOV widens at sprint speed
  speedEase: 3, // 1/s the speed framing eases in and out
  clearEase: 6, // 1/s the boom eases back out once a wall stops blocking it
}

// --- Bloxity (bloxity.js, avatar/) -------------------------------------------------
// SDK setting keys this game listens for; registering a listener makes the control
// appear in the portal's settings menu.
export const SETTINGS = {
  graphics_quality: { def: DEFAULT_GRAPHICS, type: 'enum', values: ['Low', 'Medium', 'High', 'Ultra'] },
  camera_sensitivity: { def: '1', type: 'number', min: 0.1, max: 5 },
  show_fps: { def: 'false', type: 'bool' },
  fullscreen: { def: 'false', type: 'bool' },
}

// The base rig, measured from player.glb: origin at the feet, 6.4 units tall at bind pose.
export const RIG_HEIGHT = 6.4
// Bind-pose values of the rig nodes the SDK proportions drive.
export const RIG = { armOffsetX: 2, legOffsetX: 0.6, neckOffsetY: 0.6 }
// getProportions() ranges, straight from the SDK spec; clamped before they reach the scene graph.
export const PROPORTIONS = {
  height: { def: 1, min: 0.5, max: 1.6 },
  shoulderWidth: { def: 1, min: 0.5, max: 1.5 },
  armLength: { def: 1, min: 0.05, max: 3 },
  legOffsetX: { def: 1, min: -0.7, max: 5 },
  torsoScaleX: { def: 1, min: 0.3, max: 2 },
  neckHeight: { def: 1, min: 0.94, max: 1.2 },
  headScale: { def: 1, min: 0.3, max: 2.6 },
}

// Procedural animation (avatar/animator.js), ported from Clean Leaves for Loot.
// Rotations are radians in CHARACTER space: +X swings a limb backward, +Y yaws, +Z rolls.
const deg = (d) => (d * Math.PI) / 180
export const ANIM = {
  airborneDelay: 0.07, // s off the ground before the air pose (ignores a step down a ledge)
  // Walk -> run is one cycle at two depths; phase advances with distance travelled.
  locomotion: {
    minFrequency: 0.7,
    maxFrequency: 3.6,
    strideDistance: 3.8, // m per cycle
    idleSpeed: 0.6,
    walkSpeed: 2.5,
    runSpeed: 8,
    sprintSpeed: 13,
    hipSwing: { walk: deg(22), run: deg(42), sprint: deg(56) },
    kneeBend: { walk: deg(30), run: deg(58), sprint: deg(72) },
    armSwing: { walk: deg(18), run: deg(36), sprint: deg(52) },
    elbowBend: { walk: deg(14), run: deg(44), sprint: deg(70) },
    torsoTwist: { walk: deg(4), run: deg(7), sprint: deg(9) },
    torsoLean: { walk: deg(3), run: deg(10), sprint: deg(18) },
    headCounterTwist: { walk: deg(2), run: deg(4), sprint: deg(5) },
    torsoRoll: { walk: deg(2), run: deg(3), sprint: deg(3) },
    bob: { walk: 0.03, run: 0.07, sprint: 0.09 }, // m, on the avatar root
    bankAngle: deg(9),
    bankRate: 8,
  },
  idle: {
    breathFrequency: 0.35,
    breathAmount: deg(1.8),
    breathBob: 0.007,
    basePose: {
      ArmL1: { x: deg(-4), z: deg(8) },
      ArmL2: { x: deg(12) },
      ArmR1: { x: deg(-4), z: deg(-8) },
      ArmR2: { x: deg(12) },
      LegL1: { x: deg(-4) },
      LegR1: { x: deg(4) },
    },
  },
  airborne: {
    rise: {
      LegL1: { x: deg(-38) }, LegR1: { x: deg(8) }, LegL2: { x: deg(62) }, LegR2: { x: deg(40) },
      ArmL1: { x: deg(-40), z: deg(34) }, ArmR1: { x: deg(-30), z: deg(-34) },
      ArmL2: { x: deg(30) }, ArmR2: { x: deg(30) }, Spine1: { x: deg(6) },
    },
    fall: {
      LegL1: { x: deg(-14) }, LegR1: { x: deg(10) }, LegL2: { x: deg(22) }, LegR2: { x: deg(18) },
      ArmL1: { x: deg(-70), z: deg(40) }, ArmR1: { x: deg(-60), z: deg(-40) },
      ArmL2: { x: deg(20) }, ArmR2: { x: deg(20) }, Spine1: { x: deg(-4) },
    },
    velocityReference: 8, // m/s vertical speed that reads as fully rising / falling
  },
  landing: {
    duration: 0.16,
    pose: {
      LegL1: { x: deg(-34) }, LegR1: { x: deg(-34) }, LegL2: { x: deg(58) }, LegR2: { x: deg(58) },
      ArmL1: { x: deg(-18), z: deg(20) }, ArmR1: { x: deg(-18), z: deg(-20) }, Spine1: { x: deg(14) },
    },
    bobY: -0.2,
  },
  transitions: { toLocomotion: 0.14, toAirborne: 0.12, toLanding: 0.06 }, // s to blend a pose change
}

export const FONT_FAMILY = 'Fredoka'

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n
}

// Coerce one raw SDK string against its SETTINGS entry.
export function coerceSetting(key, raw) {
  const spec = SETTINGS[key]
  if (!spec) return raw
  const value = raw === '' || raw == null ? spec.def : raw
  if (spec.type === 'bool') return value === 'true' || value === true
  if (spec.type === 'enum') return spec.values.includes(value) ? value : spec.def
  const n = Number(value)
  return clamp(Number.isFinite(n) ? n : Number(spec.def), spec.min, spec.max)
}

// --- Audio (src/audio/) ---------------------------------------------------------------
// Everything is synthesised at runtime (no sound files). volume = default master level.
export const AUDIO = {
  volume: 0.8,
  storageKey: 'fish-and-run.sound',
  buses: { ui: 0.8, sfx: 0.9, amb: 0.55, engine: 0.5 }, // per-bus levels before the master
  duck: 0.45, // world (ambience) level while a menu window is open
  maxVoices: 48, // one-shot sounds at once before low-priority ones are skipped
  maxVoicesTouch: 24,
  // Output buffer (s, the AudioContext latencyHint) and how far ahead every one-shot is scheduled.
  latency: 0.04,
  latencyTouch: 0.07,
  lead: 0.02,
  // Generated impulse response: pre-delay s, early reflections [ms, gain], tail decay s (to -60 dB),
  // tail level, how fast the tail darkens, and the default send level.
  reverb: { seconds: 1.8, preDelay: 0.012, early: [[19, 0.5], [31, 0.35], [47, 0.28], [73, 0.2], [97, 0.12]], decay: 1.4, tail: 0.18, darken: 1.6, send: 0.9 },
}

// --- Backpack + Sell Fish window (inventory.js, sellFish.js) -------------------------------
// A caught fish is { species (FISH id), weight kg, earn $/s }; it sells for earn * valuePerEarn.
// starterBackpack is what a new player carries (nothing: only the rod and the bat).
export const SELL = {
  valuePerEarn: 100,
  starterBackpack: [],
}

// --- Index window (fishIndex.js, hud/indexWindow.js) -----------------------------------------
// One page per zone (its fish, in the zone's order). A species is unlocked the first time it joins the
// backpack; each unlocked species pays its reward once (Claim!): cash + gems by rarity.
export const INDEX_REWARDS = {
  COMMON: { cash: 50, gems: 4 },
  UNCOMMON: { cash: 250, gems: 8 },
  RARE: { cash: 2500, gems: 15 },
  EPIC: { cash: 25000, gems: 25 },
  LEGENDARY: { cash: 250000, gems: 40 },
  MYTHIC: { cash: 2500000, gems: 75 },
  SECRET: { cash: 10000000, gems: 120 },
}

// --- Fishing Rods window (src/rods/) -----------------------------------------------------------
// Cards in shop order. Luck tilts each bite toward rarer fish (a fish's pick weight is
// multiplied by luck ^ (its rarity tier * ROD_LUCK_POWER)); catch speed shortens the wait
// for a bite and makes each click fill more of the Click Fast bar. `price` is cash; a
// price of 0 is owned from the start. `start` = the rod equipped on a new save.
export const ROD_LUCK_POWER = 1
export const RODS = [
  { id: 'branch', name: 'Branch Rod', rarity: 'Common', luck: 1, speed: 1, price: 0, start: true },
  { id: 'wooden', name: 'Wooden Rod', rarity: 'Common', luck: 1.1, speed: 1.1, price: 2500 },
  { id: 'reinforced_wood', name: 'Reinforced Wood', rarity: 'Uncommon', luck: 1.2, speed: 1.2, price: 10e3 },
  { id: 'reinforced_metal', name: 'Reinforced Metal', rarity: 'Uncommon', luck: 1.35, speed: 1.3, price: 75e3 },
  { id: 'golden', name: 'Golden', rarity: 'Rare', luck: 1.5, speed: 1.4, price: 250e3 },
  { id: 'frost', name: 'Frost', rarity: 'Rare', luck: 1.7, speed: 1.5, price: 5e6 },
  { id: 'candy', name: 'Candy', rarity: 'Epic', luck: 1.9, speed: 1.65, price: 30e6 },
  { id: 'mushroom', name: 'Mushroom Rod', rarity: 'Epic', luck: 2.2, speed: 1.8, price: 100e6 },
  { id: 'prehistoric', name: 'Prehistoric', rarity: 'Legendary', luck: 2.5, speed: 2, price: 500e6 },
  { id: 'anchor', name: 'Anchor', rarity: 'Legendary', luck: 2.8, speed: 2.2, price: 3.5e9 },
  { id: 'trident', name: 'Trident', rarity: 'Mythic', luck: 3.2, speed: 2.5, price: 10e9 },
  { id: 'angelic', name: 'Angelic', rarity: 'Secret', luck: 4, speed: 3, price: 50e9 },
  { id: 'bamboo', name: 'Bamboo Rod', rarity: 'Exotic', luck: 4.6, speed: 3.3, price: 15e12 },
  { id: 'katana', name: 'Katana Rod', rarity: 'Exotic', luck: 5.3, speed: 3.6, price: 60e12 },
  { id: 'candy_cane', name: 'Candy Cane Rod', rarity: 'Exotic', luck: 6, speed: 4, price: 250e12 },
]
