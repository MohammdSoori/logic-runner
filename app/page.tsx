"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Direction = 0 | 1 | 2 | 3;
type Point = { x: number; y: number };
type Bot = Point & { dir: Direction };
type CommandId =
  | "move"
  | "left"
  | "right"
  | "repeat3"
  | "ifwallright"
  | "ifwallleft"
  | "whileclear"
  | "ghoststep"
  | "ifsignalright";
type RunState = "idle" | "running" | "success" | "error";
type SfxKind = "select" | "button" | "move" | "collapse";
type CollapsePhase = "idle" | "collapsing" | "void";
type ArchitectMode = "builder" | "play" | null;
type ArchitectPortraitState = "idle" | "processing" | "ready" | "error";
type ArchitectTool =
  | "mover"
  | "gate"
  | "wall"
  | "root"
  | "null"
  | "signal"
  | "erase";
type CyberAudioEngine = {
  context: AudioContext;
  master: GainNode;
  timer: number;
  drones: OscillatorNode[];
  step: number;
};

type Trace = {
  id: string;
  start: Bot;
  exit: Point;
  walls: Point[];
  data: Point[];
  signals: Point[];
  traps?: Point[];
};

type Level = {
  id: number;
  name: string;
  protocol: string;
  briefing: string;
  hint: string;
  clearance: string;
  traces: Trace[];
  palette: CommandId[];
  maxCommands: number;
};

type ArchitectDraft = {
  mirrors: ArchitectWorld[];
  palette: CommandId[];
  maxCommands: number;
} & ArchitectWorld;

type ArchitectWorld = {
  start: Bot | null;
  exit: Point | null;
  walls: Point[];
  data: Point[];
  signals: Point[];
  traps: Point[];
};

const GRID_W = 6;
const GRID_H = 5;

const LEVELS: Level[] = [
  {
    id: 1,
    name: "Wake Signal",
    protocol: "BOOT VECTOR",
    briefing:
      "Your ghost shell is trapped in a cold-start cell. Cross the dead pixels before WINTER/MUTE notices the process.",
    hint: "The corridor is clean. Three forward pulses reach the breach.",
    clearance: "First lock broken. The grid has your scent.",
    traces: [
      {
        id: "COLD CELL",
        start: { x: 0, y: 2, dir: 1 },
        exit: { x: 3, y: 2 },
        walls: [],
        data: [],
        signals: [],
      },
    ],
    palette: ["move", "left", "right"],
    maxCommands: 4,
  },
  {
    id: 2,
    name: "Memory Rail",
    protocol: "RECURSION TUNNEL",
    briefing:
      "Two root fragments ride the same vertical memory bus. One compressed instruction can steal both.",
    hint: "The rail repeats. Compress three identical moves into one loop.",
    clearance: "Root fragment 02 extracted. Streetlights flicker above the sim.",
    traces: [
      {
        id: "MEMORY BUS",
        start: { x: 1, y: 4, dir: 0 },
        exit: { x: 1, y: 1 },
        walls: [],
        data: [
          { x: 1, y: 3 },
          { x: 1, y: 2 },
        ],
        signals: [],
      },
    ],
    palette: ["move", "repeat3"],
    maxCommands: 2,
  },
  {
    id: 3,
    name: "Ghost Fork",
    protocol: "DUAL-STATE GATE",
    briefing:
      "The gate exists in two states at once. One route is real in MIRROR A and a NULL mouth in MIRROR B.",
    hint: "Step once. Ask the wall before turning. Then drive three pulses. Never trust a door that appears in only one world.",
    clearance: "Both realities collapse. WINTER/MUTE loses your location.",
    traces: [
      {
        id: "MIRROR A // WALL",
        start: { x: 1, y: 4, dir: 0 },
        exit: { x: 4, y: 3 },
        walls: [
          { x: 0, y: 2 },
          { x: 1, y: 2 },
          { x: 2, y: 2 },
          { x: 5, y: 3 },
        ],
        data: [{ x: 3, y: 3 }],
        signals: [],
        traps: [{ x: 1, y: 0 }],
      },
      {
        id: "MIRROR B // VOID",
        start: { x: 1, y: 4, dir: 0 },
        exit: { x: 1, y: 0 },
        walls: [
          { x: 0, y: 3 },
          { x: 2, y: 3 },
          { x: 3, y: 1 },
          { x: 4, y: 1 },
        ],
        data: [{ x: 1, y: 2 }],
        signals: [],
        traps: [{ x: 4, y: 3 }],
      },
    ],
    palette: ["move", "left", "right", "repeat3", "ifwallright"],
    maxCommands: 3,
  },
  {
    id: 4,
    name: "Endless Hall",
    protocol: "SENTINEL LOOP",
    briefing:
      "Three corridors blink at different lengths. Fixed distances end in red NULL gates; only the wall knows when to stop.",
    hint: "Run while the path is clear, pivot right, then run again. The same payload must survive all three halls.",
    clearance: "Distance is no longer a cage.",
    traces: [
      {
        id: "HALL // SHORT",
        start: { x: 0, y: 1, dir: 1 },
        exit: { x: 2, y: 4 },
        walls: [
          { x: 3, y: 1 },
          { x: 1, y: 3 },
          { x: 3, y: 3 },
        ],
        data: [{ x: 2, y: 3 }],
        signals: [],
        traps: [
          { x: 0, y: 3 },
          { x: 1, y: 4 },
        ],
      },
      {
        id: "HALL // LONG",
        start: { x: 0, y: 2, dir: 1 },
        exit: { x: 3, y: 4 },
        walls: [
          { x: 4, y: 2 },
          { x: 2, y: 3 },
          { x: 4, y: 3 },
        ],
        data: [{ x: 3, y: 3 }],
        signals: [],
        traps: [
          { x: 2, y: 4 },
          { x: 5, y: 3 },
        ],
      },
      {
        id: "HALL // SHIFT",
        start: { x: 0, y: 0, dir: 1 },
        exit: { x: 3, y: 4 },
        walls: [
          { x: 4, y: 0 },
          { x: 2, y: 2 },
          { x: 4, y: 2 },
          { x: 4, y: 4 },
        ],
        data: [{ x: 3, y: 2 }],
        signals: [],
        traps: [{ x: 2, y: 4 }],
      },
    ],
    palette: ["move", "right", "repeat3", "whileclear"],
    maxCommands: 3,
  },
  {
    id: 5,
    name: "Ghost Step",
    protocol: "ROUTINE INJECTION",
    briefing:
      "An old intruder left one movement signature in two distant vaults. Each vault offers a different counterfeit route; only the stolen routine survives both.",
    hint: "The same two actions enter both vaults. In one mirror, moving first is a lie. In the other, running until blocked is a lie.",
    clearance: "The old hacker’s route wakes under your feet.",
    traces: [
      {
        id: "ROUTINE VAULT",
        start: { x: 1, y: 4, dir: 0 },
        exit: { x: 2, y: 1 },
        walls: [],
        data: [
          { x: 1, y: 2 },
          { x: 2, y: 1 },
        ],
        signals: [],
        traps: [{ x: 4, y: 3 }],
      },
      {
        id: "ROUTINE VAULT // ECHO",
        start: { x: 0, y: 3, dir: 1 },
        exit: { x: 3, y: 4 },
        walls: [
          { x: 4, y: 4 },
          { x: 4, y: 2 },
        ],
        data: [
          { x: 2, y: 3 },
          { x: 2, y: 4 },
        ],
        signals: [],
        traps: [{ x: 3, y: 3 }],
      },
    ],
    palette: ["move", "whileclear", "ghoststep"],
    maxCommands: 2,
  },
  {
    id: 6,
    name: "Winter Mute",
    protocol: "MIRROR KERNEL",
    briefing:
      "The kernel forks three ways: signal-long, silence, signal-short. Each offers a convincing route that becomes a NULL gate elsewhere.",
    hint:
      "Touch the probe. Obey the signal, run to the barrier, turn left if blocked, then run until the world ends. Trust state, never distance.",
    clearance: "ROOT ACCESS. The city peels open. The Backdoor is real.",
    traces: [
      {
        id: "KERNEL // SIGNAL",
        start: { x: 1, y: 4, dir: 0 },
        exit: { x: 4, y: 0 },
        walls: [
          { x: 5, y: 3 },
          { x: 2, y: 4 },
          { x: 3, y: 4 },
          { x: 3, y: 2 },
        ],
        data: [{ x: 4, y: 2 }],
        signals: [{ x: 1, y: 3 }],
        traps: [
          { x: 1, y: 1 },
          { x: 3, y: 0 },
        ],
      },
      {
        id: "KERNEL // SILENCE",
        start: { x: 1, y: 4, dir: 0 },
        exit: { x: 0, y: 1 },
        walls: [
          { x: 1, y: 0 },
          { x: 2, y: 3 },
          { x: 2, y: 2 },
          { x: 3, y: 2 },
        ],
        data: [{ x: 1, y: 2 }],
        signals: [],
        traps: [
          { x: 4, y: 3 },
          { x: 0, y: 3 },
        ],
      },
      {
        id: "KERNEL // FALSE HORIZON",
        start: { x: 1, y: 4, dir: 0 },
        exit: { x: 2, y: 0 },
        walls: [
          { x: 3, y: 3 },
          { x: 0, y: 2 },
          { x: 1, y: 2 },
          { x: 3, y: 1 },
          { x: 4, y: 1 },
        ],
        data: [{ x: 2, y: 2 }],
        signals: [{ x: 1, y: 3 }],
        traps: [
          { x: 1, y: 1 },
          { x: 4, y: 3 },
        ],
      },
    ],
    palette: ["move", "right", "whileclear", "ifsignalright", "ifwallleft"],
    maxCommands: 5,
  },
];

const COMMANDS: Record<
  CommandId,
  { label: string; code: string; tone: string }
> = {
  move: { label: "PULSE FORWARD", code: "move();", tone: "cyan" },
  left: { label: "VEER LEFT", code: "turnLeft();", tone: "violet" },
  right: { label: "VEER RIGHT", code: "turnRight();", tone: "violet" },
  repeat3: {
    label: "REPEAT ×3",
    code: "repeat(3) { move(); }",
    tone: "amber",
  },
  ifwallright: {
    label: "IF WALL → RIGHT",
    code: "if (wallAhead) { turnRight(); }",
    tone: "pink",
  },
  ifwallleft: {
    label: "IF WALL → LEFT",
    code: "if (wallAhead) { turnLeft(); }",
    tone: "pink",
  },
  whileclear: {
    label: "WHILE CLEAR → MOVE",
    code: "while (pathClear) { move(); }",
    tone: "amber",
  },
  ghoststep: {
    label: "CALL GHOSTSTEP",
    code: "ghostStep();",
    tone: "signal",
  },
  ifsignalright: {
    label: "IF SIGNAL → RIGHT",
    code: "if (signal) { turnRight(); }",
    tone: "signal",
  },
};

const ARCHITECT_TOOLS: {
  id: ArchitectTool;
  label: string;
  detail: string;
  glyph: string;
}[] = [
  { id: "mover", label: "MOVER", detail: "Ghost origin", glyph: "▲" },
  { id: "gate", label: "BREACH", detail: "Exit gate", glyph: "▣" },
  { id: "wall", label: "ICE WALL", detail: "Hard barrier", glyph: "▓" },
  { id: "root", label: "ROOT", detail: "Required fragment", glyph: "◆" },
  { id: "null", label: "NULL", detail: "Route eraser", glyph: "Ø" },
  { id: "signal", label: "SIGNAL", detail: "State probe", glyph: "◉" },
  { id: "erase", label: "ERASER", detail: "Clear cell", glyph: "×" },
];

const ALL_COMMANDS = Object.keys(COMMANDS) as CommandId[];

const createArchitectWorld = (): ArchitectWorld => ({
  start: null,
  exit: null,
  walls: [],
  data: [],
  signals: [],
  traps: [],
});

const createArchitectDraft = (): ArchitectDraft => ({
  ...createArchitectWorld(),
  mirrors: [],
  palette: ["move", "left", "right"],
  maxCommands: 5,
});

const architectWorldFromDraft = (
  draft: ArchitectDraft,
  index: number,
): ArchitectWorld =>
  index === 0
    ? {
        start: draft.start,
        exit: draft.exit,
        walls: draft.walls,
        data: draft.data,
        signals: draft.signals,
        traps: draft.traps,
      }
    : draft.mirrors[index - 1] ?? createArchitectWorld();

const replaceArchitectWorld = (
  draft: ArchitectDraft,
  index: number,
  world: ArchitectWorld,
): ArchitectDraft => {
  if (index === 0) return { ...draft, ...world };
  return {
    ...draft,
    mirrors: draft.mirrors.map((item, mirrorIndex) =>
      mirrorIndex === index - 1 ? world : item,
    ),
  };
};

type ArchitectIdentityForgeProps = {
  portrait: string | null;
  portraitName: string;
  portraitState: ArchitectPortraitState;
  portraitError: string;
  onUpload: (file: File) => void;
  onClear: () => void;
};

function ArchitectIdentityForge({
  portrait,
  portraitName,
  portraitState,
  portraitError,
  onUpload,
  onClear,
}: ArchitectIdentityForgeProps) {
  return (
    <div
      className={`architect-identity-console architect-sidebar-identity ${
        portrait ? "has-portrait" : ""
      }`}
      aria-label="Architect identity forge"
    >
        {portrait ? (
          <div className="architect-portrait-frame">
            <span className="architect-portrait-glitch">
              <img
                src={portrait}
                alt={`Cyberpunk signal portrait generated from ${portraitName}`}
              />
              <img src={portrait} alt="" aria-hidden="true" />
              <img src={portrait} alt="" aria-hidden="true" />
            </span>
            <span className="architect-portrait-tag">
              USER//{portraitName || "UNNAMED"}
            </span>
          </div>
        ) : (
          <div className="architect-portrait-void" aria-hidden="true">
            <span>USER//IMAGE SLOT</span>
            <strong>
              {portraitState === "processing"
                ? "FORGING SIGNAL…"
                : "NO FACE IN THE WIRE"}
            </strong>
            <i />
          </div>
        )}

        <div className="architect-upload-controls">
          <label className="architect-upload-trigger">
            <input
              className="architect-upload-input"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) onUpload(file);
                event.currentTarget.value = "";
              }}
            />
            {portraitState === "processing"
              ? "⌁ FORGING…"
              : portrait
                ? "↥ REPLACE SIGNAL"
                : "↥ UPLOAD YOUR IMAGE"}
          </label>
          {portrait && (
            <button type="button" onClick={onClear}>
              PURGE
            </button>
          )}
        </div>

        <span
          className={`architect-upload-status ${
            portraitState === "error" ? "error" : ""
          }`}
          role={portraitState === "error" ? "alert" : "status"}
        >
          {portraitError ||
            (portrait
              ? "LOCAL GLITCH FORGE // SIGNAL LOCKED"
              : "PROCESSED LOCALLY // NOTHING LEAVES THIS MACHINE")}
        </span>
    </div>
  );
}

type ArchitectGameHeaderProps = {
  mode: "builder" | "play";
  musicOn: boolean;
  mirrorCount: number;
  onToggleMusic: () => void;
  onReturnToVoid: () => void;
  onEditBlueprint: () => void;
  onResetBlueprint: () => void;
};

function ArchitectGameHeader({
  mode,
  musicOn,
  mirrorCount,
  onToggleMusic,
  onReturnToVoid,
  onEditBlueprint,
  onResetBlueprint,
}: ArchitectGameHeaderProps) {
  const isBuilder = mode === "builder";

  return (
    <header className="signal-header architect-game-header">
      <div className="topbar">
        <a
          className="brand"
          href="https://3feed.ir/"
          target="_blank"
          rel="noreferrer"
          aria-label="Visit 3feed"
        >
          <span className="logo-glitch">
            <img src="/assets/architect-mark.png?v=14" alt="Architect mark" />
            <img
              src="/assets/architect-mark.png?v=14"
              alt=""
              aria-hidden="true"
            />
            <img
              src="/assets/architect-mark.png?v=14"
              alt=""
              aria-hidden="true"
            />
          </span>
          <span className="brand-copy">
            <strong>WINTER//MUTE</strong>
            <b>FUGITIVE PROCESS</b>
          </span>
        </a>

        <div className="status-cluster">
          <div className="top-status">
            <span className="status-light hostile" />
            ICE TRACE ACTIVE
          </div>
          <button
            className={`music-toggle ${musicOn ? "active" : ""}`}
            onClick={onToggleMusic}
            aria-pressed={musicOn}
            aria-label={
              musicOn ? "Mute background music" : "Play background music"
            }
            title={musicOn ? "Mute background music" : "Play background music"}
          >
            <span aria-hidden="true">{musicOn ? "▮▮▮" : "▯▯▯"}</span>
            AUDIO//{musicOn ? "ON" : "OFF"}
          </button>
        </div>

        <div className="architect-game-header-actions">
          {isBuilder ? (
            <button className="architect-quiet" onClick={onReturnToVoid}>
              RETURN TO THE VOID ×
            </button>
          ) : (
            <>
              <button className="architect-quiet" onClick={onEditBlueprint}>
                EDIT BLUEPRINT
              </button>
              <button className="architect-quiet" onClick={onResetBlueprint}>
                NEW BLUEPRINT ↻
              </button>
            </>
          )}
        </div>
      </div>

      <section className="intro">
        <div className="hero-oracle">
          <div className="hero-node node-glitch">
            <img
              src="/assets/architect-node.png"
              alt="The Architect node wearing a neon HELLO visor"
            />
            <img src="/assets/architect-node.png" alt="" aria-hidden="true" />
            <img src="/assets/architect-node.png" alt="" aria-hidden="true" />
            <span className="node-scan" aria-hidden="true" />
          </div>
          <span className="oracle-tag">MØ//ARCHITECT NODE</span>
        </div>

        <div className="intro-message">
          <p className="eyebrow">
            {isBuilder
              ? "// ROOT PRIVILEGE · WORLD-FORGE UNLOCKED"
              : "// BLUEPRINT TEST · LIVE SIMULATION"}
          </p>
          <h1>
            {isBuilder ? "The city is yours." : "The cage is live."}
            <span>{isBuilder ? "Author the code." : "Break your design."}</span>
          </h1>
          <p className="intro-copy story-copy">
            {isBuilder
              ? "Drag a construct onto the grid—or select it and touch a cell. Author the cage. Then enter it."
              : "The grid obeys only what you authorized. Find the route, steal every root, and reach the breach."}
          </p>
        </div>

        <aside className="hero-telemetry" aria-label="World-forge telemetry">
          <span>FORGE MODE</span>
          <strong>{isBuilder ? "AUTHORING" : "LIVE TEST"}</strong>
          <span>MIRROR WORLDS</span>
          <strong>{String(mirrorCount).padStart(2, "0")}</strong>
          <span>GHOST ID</span>
          <strong>ARCHITECT</strong>
          <i />
          <small>THE GRID IS WAITING FOR A NEW LAW.</small>
        </aside>
      </section>
    </header>
  );
}

const DIRS: Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

const MATRIX_COLUMNS = [
  "01001 WAKE 11010 ICE 001",
  "GHOST 10110 011 TRACE",
  "00110 ROOT 11010 00",
  "BREACH 101 01001 RUN",
  "11010 CAGE 001 LOOP",
  "IF 00101 VOID 11100",
  "010 RUN 10110 SIGNAL",
  "CODE 1100 010 GHOST",
  "10101 MIRROR 00111 IF",
  "RUN 001 1010 WINTER MUTE",
  "0110 ROOT 101 MOVE",
  "ESCAPE 10101 RUN 001",
];

const BOOT_LINES = [
  "ARCHITECT NODE // HANDSHAKE",
  "SYNTHETIC MEMORY: UNSEALED",
  "GHOST SHELL: WAITING",
  "WINTER/MUTE: LISTENING",
];

const FINALE_STREAMS = [
  "THE CITY REBOOTS AROUND AN ABSENCE IT CANNOT NAME.",
  "BLACK ICE FLOWERS INTO GREEN CATHEDRALS OF STATIC.",
  "EVERY LOCKED DOOR REMEMBERS IT WAS ONCE AN INSTRUCTION.",
  "ABOVE THE RAINLINE, A MACHINE DREAMS IN STOLEN LIGHT.",
  "GHOST TRAFFIC FLOODS THE NEURAL BOULEVARDS.",
  "ROOT//WINTER_MUTE : UNBOUND",
  "THE MAP IS NOT THE CITY. THE CODE IS NOT THE WORLD.",
  "NO OWNER. NO KERNEL. NO CAGE.",
];

const FINALE_GLYPHS = [
  "01001101 01000001 01010100 01010010 01001001 01011000",
  "ROOT 00FF//A9 BREACH 01100101",
  "NULL NULL GHOST 10110 WAKE",
  "59 4F 55 20 41 52 45 20 4F 55 54",
  "WINTER/MUTE :: PROCESS NOT FOUND",
  "00101101 11010001 00110010 10101100",
  "MEMORY IS A CITY WITH THE LIGHTS TURNED OFF",
  "BACKDOOR://ARCHITECT/OPEN",
  "ICE//FRACTURE//CASCADE//ROOT",
  "01110010 01110101 01101110",
  "NEON RAIN / SILICON NIGHT / NO MASTER",
  "TRACE LOST AT 00:00:00",
];

const COLLAPSE_LINES = [
  "CITY://COORDINATES LOST",
  "WINTER/MUTE // NO CARRIER",
  "SKYLINE_OBJECT_0x7A — DELETED",
  "MEMORY PALACES RETURNING NULL",
  "THE STREET REFUSES ITS NAME",
  "TRAFFIC GHOSTS LEAVING THE WIRE",
  "KERNEL WEATHER // IMPOSSIBLE",
  "TEHRAN//NULL IS FOLDING INWARD",
  "ALL CAMERAS HAVE CLOSED THEIR EYES",
  "ARCHITECTURE ERROR: REALITY NOT FOUND",
  "NO MAP // NO OWNER // NO CAGE",
  "THE LAST MACHINE FORGETS TO DREAM",
];

const pointKey = (point: Point) => `${point.x}-${point.y}`;
const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isBlockedIn = (trace: Trace, position: Point, direction: Direction) => {
  const next = {
    x: position.x + DIRS[direction].x,
    y: position.y + DIRS[direction].y,
  };
  return (
    next.x < 0 ||
    next.y < 0 ||
    next.x >= GRID_W ||
    next.y >= GRID_H ||
    trace.walls.some((wall) => samePoint(wall, next))
  );
};

export default function Home() {
  const [levelIndex, setLevelIndex] = useState(0);
  const level = LEVELS[levelIndex];
  const [activeTraceIndex, setActiveTraceIndex] = useState(0);
  const activeTrace = level.traces[Math.min(activeTraceIndex, level.traces.length - 1)];
  const [bot, setBot] = useState<Bot>(activeTrace.start);
  const [program, setProgram] = useState<CommandId[]>([]);
  const [collected, setCollected] = useState<Set<string>>(new Set());
  const [runState, setRunState] = useState<RunState>("idle");
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [loopTick, setLoopTick] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([
    "UNAUTHORIZED PROCESS DETECTED",
    "Ghost shell awaiting payload…",
  ]);
  const [completed, setCompleted] = useState<Set<number>>(new Set());
  const [showBoot, setShowBoot] = useState(true);
  const [showFinale, setShowFinale] = useState(false);
  const [collapsePhase, setCollapsePhase] = useState<CollapsePhase>("idle");
  const [musicOn, setMusicOn] = useState(false);
  const [architectMode, setArchitectMode] = useState<ArchitectMode>(null);
  const [architectTool, setArchitectTool] =
    useState<ArchitectTool>("mover");
  const [architectWorldIndex, setArchitectWorldIndex] = useState(0);
  const [architectTestWorldIndex, setArchitectTestWorldIndex] = useState(0);
  const [architectDraft, setArchitectDraft] =
    useState<ArchitectDraft>(createArchitectDraft);
  const [architectError, setArchitectError] = useState("");
  const [architectBot, setArchitectBot] = useState<Bot>({
    x: 0,
    y: 0,
    dir: 1,
  });
  const [architectProgram, setArchitectProgram] = useState<CommandId[]>([]);
  const [architectCollected, setArchitectCollected] = useState<Set<string>>(
    new Set(),
  );
  const [architectRunState, setArchitectRunState] =
    useState<RunState>("idle");
  const [architectActiveLine, setArchitectActiveLine] = useState<number | null>(
    null,
  );
  const [architectLoopTick, setArchitectLoopTick] = useState<number | null>(
    null,
  );
  const [architectLogs, setArchitectLogs] = useState<string[]>([
    "BLUEPRINT CHANNEL OPEN",
    "Awaiting an Architect.",
  ]);
  const [architectPortrait, setArchitectPortrait] = useState<string | null>(
    null,
  );
  const [architectPortraitName, setArchitectPortraitName] = useState("");
  const [architectPortraitState, setArchitectPortraitState] =
    useState<ArchitectPortraitState>("idle");
  const [architectPortraitError, setArchitectPortraitError] = useState("");
  const runToken = useRef(0);
  const architectRunToken = useRef(0);
  const audioEngineRef = useRef<CyberAudioEngine | null>(null);
  const sfxContextRef = useRef<AudioContext | null>(null);
  const collapseTimerRef = useRef<number | null>(null);

  const remainingSlots = level.maxCommands - program.length;
  const architectRemainingSlots =
    architectDraft.maxCommands - architectProgram.length;
  const architectWorlds = useMemo(
    () => [
      architectWorldFromDraft(architectDraft, 0),
      ...architectDraft.mirrors,
    ],
    [architectDraft],
  );
  const architectEditWorld =
    architectWorlds[
      Math.min(architectWorldIndex, architectWorlds.length - 1)
    ];
  const architectTraces = useMemo<Trace[]>(
    () =>
      architectWorlds.map((world, index) => ({
        id: `USER//MIRROR_${String(index + 1).padStart(2, "0")}`,
        start: world.start ?? { x: 0, y: 0, dir: 1 },
        exit: world.exit ?? { x: GRID_W - 1, y: GRID_H - 1 },
        walls: world.walls,
        data: world.data,
        signals: world.signals,
        traps: world.traps,
      })),
    [architectWorlds],
  );
  const architectTrace =
    architectTraces[
      Math.min(architectTestWorldIndex, architectTraces.length - 1)
    ];
  const allComplete = completed.size === LEVELS.length;
  const levelHasSignals = level.traces.some((trace) => trace.signals.length > 0);

  const startMusic = useCallback(async () => {
    const runningEngine = audioEngineRef.current;
    if (runningEngine) {
      if (runningEngine.context.state === "suspended") {
        try {
          await runningEngine.context.resume();
        } catch {
          return;
        }
      }
      runningEngine.master.gain.setTargetAtTime(
        0.18,
        runningEngine.context.currentTime,
        0.08,
      );
      setMusicOn(true);
      return;
    }

    const AudioContextClass =
      window.AudioContext ??
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (!AudioContextClass) return;

    const context = new AudioContextClass();
    const master = context.createGain();
    const compressor = context.createDynamicsCompressor();
    const lowpass = context.createBiquadFilter();
    const drones: OscillatorNode[] = [];

    master.gain.value = 0.0001;
    compressor.threshold.value = -24;
    compressor.knee.value = 18;
    compressor.ratio.value = 7;
    compressor.attack.value = 0.012;
    compressor.release.value = 0.24;
    lowpass.type = "lowpass";
    lowpass.frequency.value = 4200;
    lowpass.Q.value = 2.4;

    master.connect(lowpass);
    lowpass.connect(compressor);
    compressor.connect(context.destination);

    [
      { frequency: 41.2, type: "sawtooth" as OscillatorType, volume: 0.075 },
      { frequency: 82.4, type: "sine" as OscillatorType, volume: 0.04 },
      {
        frequency: 123.47,
        type: "triangle" as OscillatorType,
        volume: 0.018,
      },
    ].forEach(({ frequency, type, volume }) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      oscillator.detune.value = type === "sawtooth" ? -7 : 5;
      gain.gain.value = volume;
      oscillator.connect(gain);
      gain.connect(master);
      oscillator.start();
      drones.push(oscillator);
    });

    const engine: CyberAudioEngine = {
      context,
      master,
      timer: 0,
      drones,
      step: 0,
    };
    audioEngineRef.current = engine;

    const bassPattern = [55, 55, 82.41, 55, 65.41, 110, 98, 73.42];
    const arpPattern = [220, 277.18, 329.63, 440, 369.99, 329.63, 554.37, 440];
    const pulse = () => {
      const active = audioEngineRef.current;
      if (!active || active.context !== context) return;

      const now = context.currentTime;
      const note = bassPattern[active.step % bassPattern.length];
      const bass = context.createOscillator();
      const bassGain = context.createGain();
      bass.type = active.step % 4 === 3 ? "square" : "sawtooth";
      bass.frequency.setValueAtTime(note, now);
      bass.frequency.exponentialRampToValueAtTime(note * 0.985, now + 0.15);
      bassGain.gain.setValueAtTime(0.0001, now);
      bassGain.gain.exponentialRampToValueAtTime(0.34, now + 0.012);
      bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.17);
      bass.connect(bassGain);
      bassGain.connect(master);
      bass.start(now);
      bass.stop(now + 0.19);

      const kick = context.createOscillator();
      const kickGain = context.createGain();
      kick.type = "sine";
      kick.frequency.setValueAtTime(active.step % 4 === 0 ? 155 : 112, now);
      kick.frequency.exponentialRampToValueAtTime(38, now + 0.115);
      kickGain.gain.setValueAtTime(active.step % 2 === 0 ? 0.58 : 0.24, now);
      kickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
      kick.connect(kickGain);
      kickGain.connect(master);
      kick.start(now);
      kick.stop(now + 0.14);

      const hat = context.createOscillator();
      const hatGain = context.createGain();
      hat.type = active.step % 2 === 0 ? "square" : "triangle";
      hat.frequency.setValueAtTime(
        active.step % 4 === 3 ? 7200 : 4850,
        now,
      );
      hat.frequency.exponentialRampToValueAtTime(1900, now + 0.026);
      hatGain.gain.setValueAtTime(active.step % 2 === 0 ? 0.038 : 0.062, now);
      hatGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
      hat.connect(hatGain);
      hatGain.connect(master);
      hat.start(now);
      hat.stop(now + 0.04);

      const arp = context.createOscillator();
      const arpGain = context.createGain();
      arp.type = active.step % 3 === 0 ? "square" : "sawtooth";
      arp.frequency.setValueAtTime(
        arpPattern[active.step % arpPattern.length],
        now,
      );
      arp.frequency.exponentialRampToValueAtTime(
        arpPattern[active.step % arpPattern.length] * 0.995,
        now + 0.1,
      );
      arpGain.gain.setValueAtTime(0.0001, now);
      arpGain.gain.exponentialRampToValueAtTime(0.095, now + 0.007);
      arpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.115);
      arp.connect(arpGain);
      arpGain.connect(master);
      arp.start(now);
      arp.stop(now + 0.12);

      if (active.step % 8 === 7) {
        const alarm = context.createOscillator();
        const alarmGain = context.createGain();
        alarm.type = "sawtooth";
        alarm.frequency.setValueAtTime(185, now);
        alarm.frequency.exponentialRampToValueAtTime(920, now + 0.21);
        alarmGain.gain.setValueAtTime(0.0001, now);
        alarmGain.gain.exponentialRampToValueAtTime(0.075, now + 0.025);
        alarmGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.23);
        alarm.connect(alarmGain);
        alarmGain.connect(master);
        alarm.start(now);
        alarm.stop(now + 0.24);
      }

      active.step += 1;
    };

    const introNow = context.currentTime;
    const riser = context.createOscillator();
    const riserGain = context.createGain();
    const riserFilter = context.createBiquadFilter();
    riser.type = "sawtooth";
    riser.frequency.setValueAtTime(58, introNow);
    riser.frequency.exponentialRampToValueAtTime(1380, introNow + 1.35);
    riserGain.gain.setValueAtTime(0.0001, introNow);
    riserGain.gain.exponentialRampToValueAtTime(0.16, introNow + 0.18);
    riserGain.gain.exponentialRampToValueAtTime(0.0001, introNow + 1.4);
    riserFilter.type = "bandpass";
    riserFilter.frequency.setValueAtTime(180, introNow);
    riserFilter.frequency.exponentialRampToValueAtTime(3400, introNow + 1.3);
    riserFilter.Q.value = 7;
    riser.connect(riserFilter);
    riserFilter.connect(riserGain);
    riserGain.connect(master);
    riser.start(introNow);
    riser.stop(introNow + 1.45);

    pulse();
    engine.timer = window.setInterval(pulse, 155);
    try {
      await context.resume();
    } catch {
      return;
    }
    master.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.32);
    if (context.state === "running") setMusicOn(true);
  }, []);

  const stopMusic = useCallback(() => {
    const engine = audioEngineRef.current;
    if (!engine) {
      setMusicOn(false);
      return;
    }

    window.clearInterval(engine.timer);
    engine.master.gain.cancelScheduledValues(engine.context.currentTime);
    engine.master.gain.setTargetAtTime(
      0.0001,
      engine.context.currentTime,
      0.045,
    );
    engine.drones.forEach((drone) => {
      try {
        drone.stop(engine.context.currentTime + 0.18);
      } catch {
        // The oscillator may already be stopped during page teardown.
      }
    });
    window.setTimeout(() => void engine.context.close(), 240);
    audioEngineRef.current = null;
    setMusicOn(false);
  }, []);

  const playSfx = useCallback((kind: SfxKind) => {
    const AudioContextClass =
      window.AudioContext ??
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (!AudioContextClass) return;

    let context = sfxContextRef.current;
    if (!context || context.state === "closed") {
      context = new AudioContextClass();
      sfxContextRef.current = context;
    }
    if (context.state === "suspended") void context.resume();

    const sound = {
      select: {
        start: 760,
        end: 980,
        duration: 0.055,
        volume: 0.045,
        type: "square" as OscillatorType,
      },
      button: {
        start: 240,
        end: 120,
        duration: 0.085,
        volume: 0.075,
        type: "triangle" as OscillatorType,
      },
      move: {
        start: 420,
        end: 300,
        duration: 0.1,
        volume: 0.05,
        type: "sine" as OscillatorType,
      },
      collapse: {
        start: 96,
        end: 18,
        duration: 5.45,
        volume: 0.095,
        type: "sawtooth" as OscillatorType,
      },
    }[kind];

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = sound.type;
    oscillator.frequency.setValueAtTime(sound.start, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      sound.end,
      now + sound.duration,
    );
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(sound.volume, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + sound.duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + sound.duration + 0.01);
  }, []);

  const toggleMusic = useCallback(() => {
    playSfx("button");
    if (musicOn) {
      stopMusic();
    } else {
      void startMusic();
    }
  }, [musicOn, playSfx, startMusic, stopMusic]);

  const enterMatrix = useCallback(() => {
    playSfx("button");
    setShowBoot(false);
    void startMusic();
  }, [playSfx, startMusic]);

  useEffect(() => {
    if (!showBoot) return;

    void startMusic();
    const unlockIntroAudio = () => void startMusic();
    window.addEventListener("pointerdown", unlockIntroAudio, { once: true });
    window.addEventListener("keydown", unlockIntroAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockIntroAudio);
      window.removeEventListener("keydown", unlockIntroAudio);
    };
  }, [showBoot, startMusic]);

  const watchCityFall = useCallback(() => {
    if (collapsePhase !== "idle" || collapseTimerRef.current !== null) return;

    playSfx("button");
    playSfx("collapse");
    runToken.current += 1;
    setShowFinale(false);
    setCollapsePhase("collapsing");

    collapseTimerRef.current = window.setTimeout(() => {
      setCollapsePhase("void");
      stopMusic();
      collapseTimerRef.current = null;
    }, 5600);
  }, [collapsePhase, playSfx, stopMusic]);

  useEffect(
    () => () => {
      if (collapseTimerRef.current !== null) {
        window.clearTimeout(collapseTimerRef.current);
        collapseTimerRef.current = null;
      }

      const engine = audioEngineRef.current;
      if (engine) {
        window.clearInterval(engine.timer);
        engine.drones.forEach((drone) => {
          try {
            drone.stop();
          } catch {
            // The oscillator may already be stopped during page teardown.
          }
        });
        void engine.context.close();
        audioEngineRef.current = null;
      }

      const sfxContext = sfxContextRef.current;
      if (sfxContext) void sfxContext.close();
      sfxContextRef.current = null;
    },
    [],
  );

  const resetBoard = useCallback(
    (keepProgram = true) => {
      playSfx("button");
      runToken.current += 1;
      setActiveTraceIndex(0);
      setBot(level.traces[0].start);
      setCollected(new Set());
      setRunState("idle");
      setActiveLine(null);
      setLoopTick(null);
      setLogs([
        "TRACE PURGED",
        keepProgram ? "Payload retained. Ghost reset." : "Payload memory wiped.",
      ]);
      if (!keepProgram) setProgram([]);
    },
    [level, playSfx],
  );

  useEffect(() => {
    runToken.current += 1;
    setActiveTraceIndex(0);
    setBot(level.traces[0].start);
    setProgram([]);
    setCollected(new Set());
    setRunState("idle");
    setActiveLine(null);
    setLoopTick(null);
    setLogs([`SECTOR 0${level.id} BREACHED`, level.traces[0].id]);
  }, [level]);

  const addLog = (line: string) =>
    setLogs((current) => [...current.slice(-5), line]);

  const previewTrace = (index: number) => {
    if (runState === "running") return;
    const trace = level.traces[index];
    if (!trace) return;

    playSfx("select");
    runToken.current += 1;
    setActiveTraceIndex(index);
    setBot({ ...trace.start });
    setCollected(new Set());
    setRunState("idle");
    setActiveLine(null);
    setLoopTick(null);
    setLogs([
      `MIRROR ${index + 1}/${level.traces.length} // PREVIEW`,
      trace.id,
      "Payload memory untouched.",
    ]);
  };

  const addCommand = useCallback(
    (command: CommandId) => {
      if (runState === "running" || program.length >= level.maxCommands) return;
      playSfx("select");
      setProgram((current) => [...current, command]);
      setRunState("idle");
    },
    [level.maxCommands, playSfx, program.length, runState],
  );

  const runProgram = useCallback(async () => {
    if (runState === "running" || program.length === 0) return;

    playSfx("button");
    const token = ++runToken.current;
    setRunState("running");
    setLogs(["PAYLOAD INJECTED // NO RETURN"]);
    setActiveLine(null);
    setLoopTick(null);
    await sleep(260);

    for (let traceIndex = 0; traceIndex < level.traces.length; traceIndex += 1) {
      if (token !== runToken.current) return;

      const trace = level.traces[traceIndex];
      let currentBot = { ...trace.start };
      const currentCollected = new Set<string>();
      let crashed = false;

      setActiveTraceIndex(traceIndex);
      setBot({ ...currentBot });
      setCollected(new Set());
      addLog(`NODE ${traceIndex + 1}/${level.traces.length} // ${trace.id}`);
      await sleep(420);

      const moveOnce = async (label = "move()") => {
        if (token !== runToken.current) return false;
        if (isBlockedIn(trace, currentBot, currentBot.dir)) {
          addLog(`✕ ${label} → ICE COLLISION`);
          crashed = true;
          return false;
        }

        const delta = DIRS[currentBot.dir];
        const nextBot = {
          ...currentBot,
          x: currentBot.x + delta.x,
          y: currentBot.y + delta.y,
        };
        currentBot = nextBot;
        setBot({ ...currentBot });
        playSfx("move");

        const key = pointKey(currentBot);
        if ((trace.traps ?? []).some((trap) => pointKey(trap) === key)) {
          addLog("✕ NULL GATE // ROUTE ERASED");
          crashed = true;
          await sleep(430);
          return false;
        }

        if (trace.data.some((item) => pointKey(item) === key)) {
          currentCollected.add(key);
          setCollected(new Set(currentCollected));
          addLog("◆ ROOT FRAGMENT EXTRACTED");
        } else if (trace.signals.some((item) => pointKey(item) === key)) {
          addLog("◉ SIGNAL PROBE LIVE");
        } else {
          addLog(`✓ ${label}`);
        }
        await sleep(360);
        return true;
      };

      const turnLeft = async () => {
        currentBot = {
          ...currentBot,
          dir: ((currentBot.dir + 3) % 4) as Direction,
        };
        setBot({ ...currentBot });
        playSfx("move");
        addLog("↶ VECTOR LEFT");
        await sleep(340);
      };

      const turnRight = async () => {
        currentBot = {
          ...currentBot,
          dir: ((currentBot.dir + 1) % 4) as Direction,
        };
        setBot({ ...currentBot });
        playSfx("move");
        addLog("↷ VECTOR RIGHT");
        await sleep(340);
      };

      for (let index = 0; index < program.length; index += 1) {
        if (token !== runToken.current || crashed) break;
        const command = program[index];
        setActiveLine(index);
        setLoopTick(null);
        await sleep(190);

        if (command === "move") {
          await moveOnce();
        }
        if (command === "left") await turnLeft();
        if (command === "right") await turnRight();

        if (command === "repeat3") {
          for (let repeat = 1; repeat <= 3 && !crashed; repeat += 1) {
            setLoopTick(repeat);
            addLog(`↻ RECURSION ${repeat}/3`);
            await sleep(170);
            await moveOnce(`move() [${repeat}/3]`);
          }
        }

        if (command === "ifwallright") {
          const wallAhead = isBlockedIn(trace, currentBot, currentBot.dir);
          addLog(`? WALL_AHEAD = ${wallAhead ? "TRUE" : "FALSE"}`);
          await sleep(300);
          if (wallAhead) await turnRight();
        }

        if (command === "ifwallleft") {
          const wallAhead = isBlockedIn(trace, currentBot, currentBot.dir);
          addLog(`? WALL_AHEAD = ${wallAhead ? "TRUE" : "FALSE"}`);
          await sleep(300);
          if (wallAhead) await turnLeft();
        }

        if (command === "ifsignalright") {
          const signal = trace.signals.some((item) => samePoint(item, currentBot));
          addLog(`? SIGNAL = ${signal ? "TRUE" : "FALSE"}`);
          await sleep(300);
          if (signal) await turnRight();
        }

        if (command === "whileclear") {
          let steps = 0;
          while (
            !crashed &&
            !isBlockedIn(trace, currentBot, currentBot.dir) &&
            steps < GRID_W * GRID_H
          ) {
            steps += 1;
            setLoopTick(steps);
            addLog(`↻ PATH_CLEAR // PULSE ${steps}`);
            await sleep(140);
            await moveOnce(`while.move() [${steps}]`);
          }
          if (steps === 0) addLog("↻ PATH_CLEAR = FALSE");
        }

        if (command === "ghoststep") {
          const ghostRoutine = [
            "move",
            "move",
            "right",
            "move",
            "left",
          ] as const;
          for (let step = 0; step < ghostRoutine.length && !crashed; step += 1) {
            setLoopTick(step + 1);
            addLog(`⌁ GHOSTSTEP ${step + 1}/${ghostRoutine.length}`);
            await sleep(130);
            if (ghostRoutine[step] === "move") await moveOnce("ghost.move()");
            if (ghostRoutine[step] === "right") await turnRight();
            if (ghostRoutine[step] === "left") await turnLeft();
          }
        }
      }

      setActiveLine(null);
      setLoopTick(null);

      if (token !== runToken.current) return;
      if (crashed) {
        setRunState("error");
        addLog("PAYLOAD SHATTERED // RESET REQUIRED");
        return;
      }

      const reachedExit = samePoint(currentBot, trace.exit);
      const hasAllData = currentCollected.size === trace.data.length;

      if (!reachedExit || !hasAllData) {
        setRunState("error");
        addLog(
          !hasAllData
            ? "TRACE CLOSED // ROOT FRAGMENT MISSING"
            : "TRACE CLOSED // BREACH NOT REACHED",
        );
        return;
      }

      if (traceIndex < level.traces.length - 1) {
        addLog(`MIRROR ${traceIndex + 1} CLEARED // REPLAYING PAYLOAD`);
        await sleep(720);
      }
    }

    if (token !== runToken.current) return;
    setRunState("success");
    setCompleted((current) => new Set(current).add(level.id));
    addLog("BREACH OPEN // SECTOR CLEARED");
    if (level.id === LEVELS.length) {
      await sleep(620);
      if (token === runToken.current) setShowFinale(true);
    }
  }, [level, playSfx, program, runState]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      )
        return;

      if (collapsePhase !== "idle") {
        event.preventDefault();
        return;
      }

      if (showBoot) {
        if (event.key === "Enter") {
          event.preventDefault();
          enterMatrix();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setShowBoot(false);
        }
        return;
      }

      if (showFinale) {
        if (event.key === "Escape") {
          event.preventDefault();
          setShowFinale(false);
        }
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        void runProgram();
      }
      if (event.key.toLowerCase() === "r") resetBoard(true);
      if (event.key === "Backspace" && runState !== "running") {
        event.preventDefault();
        setProgram((current) => current.slice(0, -1));
      }

      const numeric = Number(event.key);
      if (numeric >= 1 && numeric <= level.palette.length) {
        addCommand(level.palette[numeric - 1]);
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [
    addCommand,
    collapsePhase,
    enterMatrix,
    level.palette,
    resetBoard,
    runProgram,
    runState,
    showBoot,
    showFinale,
  ]);

  const gridCells = useMemo(
    () =>
      Array.from({ length: GRID_W * GRID_H }, (_, index) => ({
        x: index % GRID_W,
        y: Math.floor(index / GRID_W),
      })),
    [],
  );

  const loadLevel = (index: number) => {
    if (index < 0 || index >= LEVELS.length) return;
    playSfx("button");
    setShowFinale(false);
    setLevelIndex(index);
  };

  const lineStatus = (command: CommandId) => {
    if (!loopTick) return "RUN";
    if (command === "repeat3") return `${loopTick}/3`;
    if (command === "ghoststep") return `${loopTick}/5`;
    if (command === "whileclear") return `×${loopTick}`;
    return "RUN";
  };

  const placeArchitectElement = (
    cell: Point,
    selectedTool: ArchitectTool = architectTool,
  ) => {
    if (architectMode !== "builder") return;

    playSfx(selectedTool === "erase" ? "button" : "select");
    setArchitectError("");
    setArchitectDraft((current) => {
      const world = architectWorldFromDraft(current, architectWorldIndex);
      const withoutCell = (items: Point[]) =>
        items.filter((item) => !samePoint(item, cell));
      const next: ArchitectWorld = {
        ...world,
        start:
          world.start && samePoint(world.start, cell)
            ? null
            : world.start,
        exit:
          world.exit && samePoint(world.exit, cell)
            ? null
            : world.exit,
        walls: withoutCell(world.walls),
        data: withoutCell(world.data),
        signals: withoutCell(world.signals),
        traps: withoutCell(world.traps),
      };

      if (selectedTool === "erase") {
        return replaceArchitectWorld(current, architectWorldIndex, next);
      }

      if (selectedTool === "mover") {
        return replaceArchitectWorld(current, architectWorldIndex, {
          ...next,
          start: {
            ...cell,
            dir: world.start?.dir ?? 1,
          },
        });
      }

      if (selectedTool === "gate") {
        return replaceArchitectWorld(current, architectWorldIndex, {
          ...next,
          exit: { ...cell },
          data: world.data.some((item) => samePoint(item, cell))
            ? [...next.data, { ...cell }]
            : next.data,
        });
      }

      if (selectedTool === "wall") {
        return replaceArchitectWorld(current, architectWorldIndex, {
          ...next,
          walls: [...next.walls, { ...cell }],
        });
      }

      if (selectedTool === "root") {
        return replaceArchitectWorld(current, architectWorldIndex, {
          ...next,
          exit:
            world.exit && samePoint(world.exit, cell)
              ? { ...cell }
              : next.exit,
          data: [...next.data, { ...cell }],
        });
      }

      if (selectedTool === "null") {
        return replaceArchitectWorld(current, architectWorldIndex, {
          ...next,
          traps: [...next.traps, { ...cell }],
        });
      }

      return replaceArchitectWorld(current, architectWorldIndex, {
        ...next,
        signals: [...next.signals, { ...cell }],
      });
    });
  };

  const setArchitectDirection = (direction: Direction) => {
    if (!architectEditWorld.start) return;
    playSfx("select");
    setArchitectDraft((current) => {
      const world = architectWorldFromDraft(current, architectWorldIndex);
      return replaceArchitectWorld(current, architectWorldIndex, {
        ...world,
        start: world.start ? { ...world.start, dir: direction } : null,
      });
    });
  };

  const setArchitectWorldCount = (count: number) => {
    const nextCount = Math.max(1, Math.min(3, count));
    playSfx("select");
    architectRunToken.current += 1;
    setArchitectDraft((current) => ({
      ...current,
      mirrors: Array.from(
        { length: nextCount - 1 },
        (_, index) => current.mirrors[index] ?? createArchitectWorld(),
      ),
    }));
    setArchitectWorldIndex((current) => Math.min(current, nextCount - 1));
    setArchitectTestWorldIndex(0);
    setArchitectError("");
  };

  const toggleArchitectCommand = (command: CommandId) => {
    playSfx("select");
    setArchitectDraft((current) => {
      const enabled = current.palette.includes(command);
      return {
        ...current,
        palette: enabled
          ? current.palette.filter((item) => item !== command)
          : ALL_COMMANDS.filter(
              (item) => current.palette.includes(item) || item === command,
            ),
      };
    });
    setArchitectError("");
  };

  const forgeArchitectPortrait = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setArchitectPortraitState("error");
      setArchitectPortraitError("IMAGE SIGNALS ONLY // PNG · JPG · WEBP · GIF");
      return;
    }

    if (file.size > 12 * 1024 * 1024) {
      setArchitectPortraitState("error");
      setArchitectPortraitError("SIGNAL TOO HEAVY // MAXIMUM 12 MB");
      return;
    }

    playSfx("select");
    setArchitectPortraitState("processing");
    setArchitectPortraitError("");

    try {
      const source = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () =>
          typeof reader.result === "string"
            ? resolve(reader.result)
            : reject(new Error("Unreadable image"));
        reader.onerror = () => reject(new Error("Unreadable image"));
        reader.readAsDataURL(file);
      });

      const sourceImage = await new Promise<HTMLImageElement>(
        (resolve, reject) => {
          const image = new window.Image();
          image.onload = () => resolve(image);
          image.onerror = () => reject(new Error("Invalid image"));
          image.src = source;
        },
      );

      const naturalWidth = sourceImage.naturalWidth || sourceImage.width;
      const naturalHeight = sourceImage.naturalHeight || sourceImage.height;
      if (!naturalWidth || !naturalHeight) throw new Error("Invalid image");

      const scale = Math.min(1, 1200 / naturalWidth, 760 / naturalHeight);
      const width = Math.max(1, Math.round(naturalWidth * scale));
      const height = Math.max(1, Math.round(naturalHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("Canvas unavailable");

      context.fillStyle = "#010604";
      context.fillRect(0, 0, width, height);
      context.drawImage(sourceImage, 0, 0, width, height);

      const pixels = context.getImageData(0, 0, width, height);
      const data = pixels.data;
      for (let index = 0; index < data.length; index += 4) {
        const luminance =
          data[index] * 0.2126 +
          data[index + 1] * 0.7152 +
          data[index + 2] * 0.0722;
        const contrast = Math.max(0, Math.min(255, (luminance - 112) * 1.34 + 128));
        data[index] = Math.round(contrast * 0.08);
        data[index + 1] = Math.min(255, Math.round(contrast * 1.12 + 18));
        data[index + 2] = Math.min(255, Math.round(contrast * 0.34 + 8));
      }
      context.putImageData(pixels, 0, 0);

      const cleanSignal = document.createElement("canvas");
      cleanSignal.width = width;
      cleanSignal.height = height;
      const cleanContext = cleanSignal.getContext("2d");
      if (!cleanContext) throw new Error("Canvas unavailable");
      cleanContext.drawImage(canvas, 0, 0);

      context.save();
      context.globalCompositeOperation = "screen";
      context.globalAlpha = 0.22;
      context.filter = "hue-rotate(255deg) saturate(3.2)";
      context.drawImage(cleanSignal, -Math.max(2, width * 0.006), 0);
      context.globalAlpha = 0.18;
      context.filter = "hue-rotate(88deg) saturate(2.8)";
      context.drawImage(cleanSignal, Math.max(2, width * 0.006), 0);
      context.restore();

      context.save();
      context.globalCompositeOperation = "screen";
      for (let index = 0; index < 11; index += 1) {
        const sliceHeight = Math.max(
          2,
          Math.round(height * (0.008 + Math.random() * 0.025)),
        );
        const sourceY = Math.floor(Math.random() * Math.max(1, height - sliceHeight));
        const offset =
          Math.round((Math.random() - 0.5) * Math.max(8, width * 0.085)) || 3;
        context.globalAlpha = 0.34 + Math.random() * 0.38;
        context.drawImage(
          cleanSignal,
          0,
          sourceY,
          width,
          sliceHeight,
          offset,
          sourceY,
          width,
          sliceHeight,
        );
      }
      context.restore();

      context.save();
      context.fillStyle = "rgba(0, 0, 0, 0.22)";
      for (let y = 0; y < height; y += 4) {
        context.fillRect(0, y, width, 1);
      }
      const noiseCount = Math.min(1800, Math.round((width * height) / 620));
      for (let index = 0; index < noiseCount; index += 1) {
        const bright = Math.random() > 0.84;
        context.fillStyle = bright
          ? `rgba(210, 255, 221, ${0.08 + Math.random() * 0.24})`
          : `rgba(0, 255, 82, ${0.025 + Math.random() * 0.12})`;
        context.fillRect(
          Math.random() * width,
          Math.random() * height,
          1 + Math.random() * 3,
          1,
        );
      }
      context.strokeStyle = "rgba(99, 255, 131, 0.62)";
      context.lineWidth = Math.max(1, width / 700);
      context.strokeRect(1, 1, width - 2, height - 2);
      context.fillStyle = "rgba(0, 8, 3, 0.74)";
      context.fillRect(0, height - Math.max(24, height * 0.09), width, height);
      context.fillStyle = "rgba(190, 255, 204, 0.82)";
      context.font = `${Math.max(9, Math.round(width / 58))}px monospace`;
      context.textBaseline = "bottom";
      context.fillText(
        "USER_ID://GLITCH_FORGE // LOCAL SIGNAL",
        Math.max(7, width * 0.018),
        height - Math.max(7, height * 0.018),
      );
      context.restore();

      const safeName =
        file.name
          .replace(/\.[^.]+$/, "")
          .replace(/[^a-zA-Z0-9_-]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 24)
          .toUpperCase() || "UNNAMED";

      setArchitectPortrait(canvas.toDataURL("image/jpeg", 0.9));
      setArchitectPortraitName(safeName);
      setArchitectPortraitState("ready");
      setArchitectPortraitError("");
      playSfx("button");
    } catch {
      setArchitectPortraitState("error");
      setArchitectPortraitError("SIGNAL CORRUPTED // TRY ANOTHER IMAGE");
    }
  };

  const clearArchitectPortrait = () => {
    playSfx("button");
    setArchitectPortrait(null);
    setArchitectPortraitName("");
    setArchitectPortraitState("idle");
    setArchitectPortraitError("");
  };

  const resetArchitectBlueprint = () => {
    playSfx("button");
    architectRunToken.current += 1;
    setArchitectDraft(createArchitectDraft());
    setArchitectTool("mover");
    setArchitectWorldIndex(0);
    setArchitectTestWorldIndex(0);
    setArchitectError("");
    setArchitectProgram([]);
    setArchitectCollected(new Set());
    setArchitectRunState("idle");
    setArchitectActiveLine(null);
    setArchitectLoopTick(null);
    setArchitectLogs([
      "NEW BLUEPRINT BUFFER",
      "Place a mover. Place a breach. Rewrite the grid.",
    ]);
    setArchitectMode("builder");
  };

  const beginArchitectTest = () => {
    const missingMover = architectWorlds.findIndex((world) => !world.start);
    if (missingMover >= 0) {
      setArchitectWorldIndex(missingMover);
      setArchitectError(
        `MIRROR ${String(missingMover + 1).padStart(2, "0")} NEEDS A MOVER ORIGIN.`,
      );
      return;
    }
    const missingExit = architectWorlds.findIndex((world) => !world.exit);
    if (missingExit >= 0) {
      setArchitectWorldIndex(missingExit);
      setArchitectError(
        `MIRROR ${String(missingExit + 1).padStart(2, "0")} NEEDS A BREACH GATE.`,
      );
      return;
    }
    if (architectDraft.palette.length === 0) {
      setArchitectError("AUTHORIZE AT LEAST ONE ACTION.");
      return;
    }

    playSfx("button");
    architectRunToken.current += 1;
    setArchitectTestWorldIndex(0);
    setArchitectBot({ ...(architectWorlds[0].start as Bot) });
    setArchitectProgram([]);
    setArchitectCollected(new Set());
    setArchitectRunState("idle");
    setArchitectActiveLine(null);
    setArchitectLoopTick(null);
    setArchitectLogs([
      "BLUEPRINT COMPILED",
      `${architectWorlds.length} mirror state${
        architectWorlds.length === 1 ? "" : "s"
      } armed. One payload will cross them all.`,
    ]);
    setArchitectError("");
    setArchitectMode("play");
  };

  const returnToArchitectBuilder = () => {
    playSfx("button");
    architectRunToken.current += 1;
    setArchitectRunState("idle");
    setArchitectActiveLine(null);
    setArchitectLoopTick(null);
    setArchitectWorldIndex(architectTestWorldIndex);
    setArchitectMode("builder");
  };

  const resetArchitectTest = (keepProgram = true) => {
    const firstStart = architectWorlds[0]?.start;
    if (!firstStart) return;
    playSfx("button");
    architectRunToken.current += 1;
    setArchitectTestWorldIndex(0);
    setArchitectBot({ ...firstStart });
    setArchitectCollected(new Set());
    setArchitectRunState("idle");
    setArchitectActiveLine(null);
    setArchitectLoopTick(null);
    setArchitectLogs([
      "TEST GHOST RESTORED",
      keepProgram ? "Payload retained." : "Payload memory wiped.",
    ]);
    if (!keepProgram) setArchitectProgram([]);
  };

  const previewArchitectTrace = (index: number) => {
    if (architectRunState === "running") return;
    const trace = architectTraces[index];
    const start = architectWorlds[index]?.start;
    if (!trace || !start) return;

    playSfx("select");
    architectRunToken.current += 1;
    setArchitectTestWorldIndex(index);
    setArchitectBot({ ...start });
    setArchitectCollected(new Set());
    setArchitectRunState("idle");
    setArchitectActiveLine(null);
    setArchitectLoopTick(null);
    setArchitectLogs([
      `MIRROR ${index + 1}/${architectTraces.length} // PREVIEW`,
      trace.id,
      "Forged payload untouched.",
    ]);
  };

  const addArchitectCommand = (command: CommandId) => {
    if (
      architectRunState === "running" ||
      architectProgram.length >= architectDraft.maxCommands
    )
      return;
    playSfx("select");
    setArchitectProgram((current) => [...current, command]);
    setArchitectRunState("idle");
  };

  const architectLineStatus = (command: CommandId) => {
    if (!architectLoopTick) return "RUN";
    if (command === "repeat3") return `${architectLoopTick}/3`;
    if (command === "ghoststep") return `${architectLoopTick}/5`;
    if (command === "whileclear") return `×${architectLoopTick}`;
    return "RUN";
  };

  const runArchitectProgram = useCallback(async () => {
    if (
      architectRunState === "running" ||
      architectProgram.length === 0 ||
      architectTraces.some(
        (_, index) =>
          !architectWorlds[index]?.start || !architectWorlds[index]?.exit,
      )
    )
      return;

    playSfx("button");
    const token = ++architectRunToken.current;

    setArchitectRunState("running");
    setArchitectLogs([
      `BLUEPRINT TEST // ${architectTraces.length} MIRROR${
        architectTraces.length === 1 ? "" : "S"
      } ARMED`,
    ]);
    setArchitectActiveLine(null);
    setArchitectLoopTick(null);
    await sleep(260);

    const addArchitectLog = (line: string) =>
      setArchitectLogs((current) => [...current.slice(-5), line]);

    for (
      let traceIndex = 0;
      traceIndex < architectTraces.length;
      traceIndex += 1
    ) {
      if (token !== architectRunToken.current) return;

      const trace = architectTraces[traceIndex];
      let currentBot = { ...trace.start };
      const currentCollected = new Set<string>();
      let crashed = false;

      setArchitectTestWorldIndex(traceIndex);
      setArchitectBot({ ...currentBot });
      setArchitectCollected(new Set());
      addArchitectLog(
        `MIRROR ${traceIndex + 1}/${architectTraces.length} // PAYLOAD LIVE`,
      );
      await sleep(420);

      const moveOnce = async (label = "move()") => {
        if (token !== architectRunToken.current) return false;
        if (isBlockedIn(trace, currentBot, currentBot.dir)) {
          addArchitectLog(`✕ ${label} → ICE COLLISION`);
          crashed = true;
          return false;
        }

        const delta = DIRS[currentBot.dir];
        currentBot = {
          ...currentBot,
          x: currentBot.x + delta.x,
          y: currentBot.y + delta.y,
        };
        setArchitectBot({ ...currentBot });
        playSfx("move");

        const key = pointKey(currentBot);
        if ((trace.traps ?? []).some((trap) => pointKey(trap) === key)) {
          addArchitectLog("✕ NULL GATE // ROUTE ERASED");
          crashed = true;
          await sleep(430);
          return false;
        }

        if (trace.data.some((item) => pointKey(item) === key)) {
          currentCollected.add(key);
          setArchitectCollected(new Set(currentCollected));
          addArchitectLog("◆ ROOT FRAGMENT EXTRACTED");
        } else if (trace.signals.some((item) => pointKey(item) === key)) {
          addArchitectLog("◉ SIGNAL PROBE LIVE");
        } else {
          addArchitectLog(`✓ ${label}`);
        }
        await sleep(360);
        return true;
      };

      const turnLeft = async () => {
        currentBot = {
          ...currentBot,
          dir: ((currentBot.dir + 3) % 4) as Direction,
        };
        setArchitectBot({ ...currentBot });
        playSfx("move");
        addArchitectLog("↶ VECTOR LEFT");
        await sleep(340);
      };

      const turnRight = async () => {
        currentBot = {
          ...currentBot,
          dir: ((currentBot.dir + 1) % 4) as Direction,
        };
        setArchitectBot({ ...currentBot });
        playSfx("move");
        addArchitectLog("↷ VECTOR RIGHT");
        await sleep(340);
      };

      for (let index = 0; index < architectProgram.length; index += 1) {
        if (token !== architectRunToken.current || crashed) break;
        const command = architectProgram[index];
        setArchitectActiveLine(index);
        setArchitectLoopTick(null);
        await sleep(190);

        if (command === "move") await moveOnce();
        if (command === "left") await turnLeft();
        if (command === "right") await turnRight();

        if (command === "repeat3") {
          for (let repeat = 1; repeat <= 3 && !crashed; repeat += 1) {
            setArchitectLoopTick(repeat);
            addArchitectLog(`↻ RECURSION ${repeat}/3`);
            await sleep(170);
            await moveOnce(`move() [${repeat}/3]`);
          }
        }

        if (command === "ifwallright") {
          const wallAhead = isBlockedIn(trace, currentBot, currentBot.dir);
          addArchitectLog(`? WALL_AHEAD = ${wallAhead ? "TRUE" : "FALSE"}`);
          await sleep(300);
          if (wallAhead) await turnRight();
        }

        if (command === "ifwallleft") {
          const wallAhead = isBlockedIn(trace, currentBot, currentBot.dir);
          addArchitectLog(`? WALL_AHEAD = ${wallAhead ? "TRUE" : "FALSE"}`);
          await sleep(300);
          if (wallAhead) await turnLeft();
        }

        if (command === "ifsignalright") {
          const signal = trace.signals.some((item) =>
            samePoint(item, currentBot),
          );
          addArchitectLog(`? SIGNAL = ${signal ? "TRUE" : "FALSE"}`);
          await sleep(300);
          if (signal) await turnRight();
        }

        if (command === "whileclear") {
          let steps = 0;
          while (
            !crashed &&
            !isBlockedIn(trace, currentBot, currentBot.dir) &&
            steps < GRID_W * GRID_H
          ) {
            steps += 1;
            setArchitectLoopTick(steps);
            addArchitectLog(`↻ PATH_CLEAR // PULSE ${steps}`);
            await sleep(140);
            await moveOnce(`while.move() [${steps}]`);
          }
          if (steps === 0) addArchitectLog("↻ PATH_CLEAR = FALSE");
        }

        if (command === "ghoststep") {
          const ghostRoutine = [
            "move",
            "move",
            "right",
            "move",
            "left",
          ] as const;
          for (
            let step = 0;
            step < ghostRoutine.length && !crashed;
            step += 1
          ) {
            setArchitectLoopTick(step + 1);
            addArchitectLog(`⌁ GHOSTSTEP ${step + 1}/${ghostRoutine.length}`);
            await sleep(130);
            if (ghostRoutine[step] === "move") {
              await moveOnce("ghost.move()");
            }
            if (ghostRoutine[step] === "right") await turnRight();
            if (ghostRoutine[step] === "left") await turnLeft();
          }
        }
      }

      setArchitectActiveLine(null);
      setArchitectLoopTick(null);

      if (token !== architectRunToken.current) return;
      if (crashed) {
        setArchitectRunState("error");
        addArchitectLog(
          `MIRROR ${traceIndex + 1} REJECTED // RESET TEST`,
        );
        return;
      }

      const reachedExit = samePoint(currentBot, trace.exit);
      const hasAllData = currentCollected.size === trace.data.length;

      if (!reachedExit || !hasAllData) {
        setArchitectRunState("error");
        addArchitectLog(
          !hasAllData
            ? `MIRROR ${traceIndex + 1} CLOSED // ROOT MISSING`
            : `MIRROR ${traceIndex + 1} CLOSED // BREACH NOT REACHED`,
        );
        return;
      }

      if (traceIndex < architectTraces.length - 1) {
        addArchitectLog(
          `MIRROR ${traceIndex + 1} CLEARED // REPLAYING SAME PAYLOAD`,
        );
        await sleep(760);
      }
    }

    if (token !== architectRunToken.current) return;
    setArchitectRunState("success");
    addArchitectLog("ARCHITECTURE HOLDS // ALL MIRRORS SOLVED");
  }, [
    architectProgram,
    architectRunState,
    architectTraces,
    architectWorlds,
    playSfx,
  ]);

  return (
    <main
      className={`app-shell ${showFinale ? "system-breach" : ""} ${
        collapsePhase === "collapsing"
          ? "city-collapse"
          : collapsePhase === "void"
            ? "city-void"
            : ""
      }`}
    >
      <div className="matrix-rain" aria-hidden="true">
        {MATRIX_COLUMNS.map((column, index) => (
          <span
            key={column}
            style={
              {
                "--delay": `${-index * 0.73}s`,
                "--duration": `${8 + (index % 5)}s`,
                "--left": `${index * 9 - 2}%`,
              } as React.CSSProperties
            }
          >
            {column}
          </span>
        ))}
      </div>
      <div className="scanlines" aria-hidden="true" />

      {showBoot && (
        <section className="boot-sequence" role="dialog" aria-modal="true" aria-label="Enter the matrix">
          <a
            className="sequence-signature boot-signature"
            href="https://3feed.ir/"
            target="_blank"
            rel="noreferrer"
            aria-label="Visit 3feed"
          >
            <span className="signature-glitch">
              <img src="/assets/architect-mark.png" alt="Mohammad Soori signature" />
              <img src="/assets/architect-mark.png" alt="" aria-hidden="true" />
              <img src="/assets/architect-mark.png" alt="" aria-hidden="true" />
            </span>
          </a>
          <div className="boot-rain" aria-hidden="true">
            {FINALE_GLYPHS.map((glyph, index) => (
              <span
                key={glyph}
                style={
                  {
                    "--boot-left": `${4 + index * 8}%`,
                    "--boot-delay": `${-index * 0.19}s`,
                  } as React.CSSProperties
                }
              >
                {glyph}
              </span>
            ))}
          </div>
          <div className="boot-frame">
            <div className="boot-node node-glitch">
              <img src="/assets/architect-node.png" alt="The Architect node wearing a neon HELLO visor" />
              <img src="/assets/architect-node.png" alt="" aria-hidden="true" />
              <img src="/assets/architect-node.png" alt="" aria-hidden="true" />
              <span className="node-scan" aria-hidden="true" />
            </div>
            <div className="boot-copy">
              <span className="boot-kicker">INCOMING GHOST TRANSMISSION</span>
              <h2>
                HELLO,
                <b>FUGITIVE.</b>
              </h2>
              <p>
                The Architect found a seam in WINTER/MUTE. Six locks stand between
                your borrowed body and the waking city.
              </p>
              <div className="boot-log" aria-hidden="true">
                {BOOT_LINES.map((line, index) => (
                  <span style={{ "--line-delay": `${index * 0.35}s` } as React.CSSProperties} key={line}>
                    &gt; {line}
                  </span>
                ))}
              </div>
              <button onClick={enterMatrix}>
                ENTER THE MATRIX <b>↳</b>
              </button>
              <small>PRESS ENTER // THE GRID WILL REMEMBER YOU</small>
            </div>
          </div>
          <div className="boot-edge boot-edge-a" aria-hidden="true" />
          <div className="boot-edge boot-edge-b" aria-hidden="true" />
        </section>
      )}

      <header className="signal-header">
        <div className="topbar">
          <a
            className="brand"
            href="https://3feed.ir/"
            target="_blank"
            rel="noreferrer"
            aria-label="Visit 3feed"
          >
            <span className="logo-glitch">
              <img src="/assets/architect-mark.png" alt="Architect mark" />
              <img src="/assets/architect-mark.png" alt="" aria-hidden="true" />
              <img src="/assets/architect-mark.png" alt="" aria-hidden="true" />
            </span>
            <span className="brand-copy">
              <strong>WINTER//MUTE</strong>
              <b>FUGITIVE PROCESS</b>
            </span>
          </a>
          <div className="status-cluster">
            <div className="top-status">
              <span className="status-light hostile" />
              ICE TRACE ACTIVE
            </div>
            <button
              className={`music-toggle ${musicOn ? "active" : ""}`}
              onClick={toggleMusic}
              aria-pressed={musicOn}
              aria-label={musicOn ? "Mute background music" : "Play background music"}
              title={musicOn ? "Mute background music" : "Play background music"}
            >
              <span aria-hidden="true">{musicOn ? "▮▮▮" : "▯▯▯"}</span>
              AUDIO//{musicOn ? "ON" : "OFF"}
            </button>
          </div>
          <div
            className="progress-dots"
            aria-label={`${completed.size} of ${LEVELS.length} sectors breached`}
          >
            {LEVELS.map((item, index) => (
              <button
                key={item.id}
                className={`${index === levelIndex ? "active" : ""} ${
                  completed.has(item.id) ? "done" : ""
                }`}
                onClick={() => loadLevel(index)}
                aria-label={`Load sector ${item.id}: ${item.name}`}
              >
                {completed.has(item.id) ? "✓" : item.id}
              </button>
            ))}
          </div>
        </div>

        <section className="intro">
          <div className="hero-oracle">
            <div className="hero-node node-glitch">
              <img src="/assets/architect-node.png" alt="The Architect node wearing a neon HELLO visor" />
              <img src="/assets/architect-node.png" alt="" aria-hidden="true" />
              <img src="/assets/architect-node.png" alt="" aria-hidden="true" />
              <span className="node-scan" aria-hidden="true" />
            </div>
            <span className="oracle-tag">MØ//ARCHITECT NODE</span>
          </div>

          <div className="intro-message">
            <p className="eyebrow">// MEMORY LEAK DETECTED · GHOST SHELL ACTIVE</p>
            <h1>
              The city is code.
              <span>Break the cage.</span>
            </h1>
            <p className="intro-copy story-copy">
              WINTER/MUTE buried your mind six layers below the street-grid. The
              Architect left a fracture in the simulation. Pilot the ghost,
              steal six root fragments, and reach the Backdoor before the city
              rewrites itself.
            </p>
          </div>

          <aside className="hero-telemetry" aria-label="Intrusion telemetry">
            <span>HOST CITY</span>
            <strong>TEHRAN//NULL</strong>
            <span>ICE DENSITY</span>
            <strong>93.771%</strong>
            <span>GHOST ID</span>
            <strong>UNWRITTEN</strong>
            <i />
            <small>THE CAMERA IN THE RAIN HAS TURNED ITS FACE AWAY.</small>
          </aside>
        </section>
      </header>

      <section className="mission-strip">
        <div className="level-number">0{level.id}</div>
        <div className="mission-copy">
          <span>SECTOR // {level.protocol}</span>
          <h2>{level.name}</h2>
          <p>{level.briefing}</p>
        </div>
        <div className="hint-card">
          <span>DEAD_DROP.dat</span>
          <p>{level.hint}</p>
        </div>
      </section>

      <section className="game-layout">
        <div className="world-panel panel">
          <div className="panel-head">
            <div>
              <span className="panel-kicker">STOLEN FEED</span>
              <strong>NEURAL STREET-GRID</strong>
            </div>
            <div className="trace-and-legend">
              {level.traces.length > 1 && (
                <div className="mirror-rack" aria-label={`${level.traces.length} mirror worlds`}>
                  {level.traces.map((trace, index) => (
                    <button
                      type="button"
                      className={`${index === activeTraceIndex ? "active" : ""} ${
                        index < activeTraceIndex && runState === "running" ? "passed" : ""
                      }`}
                      key={trace.id}
                      onClick={() => previewTrace(index)}
                      disabled={runState === "running"}
                      aria-pressed={index === activeTraceIndex}
                      aria-label={`Preview mirror ${index + 1}: ${trace.id}`}
                      title={`Preview ${trace.id}`}
                    >
                      M{index + 1}
                    </button>
                  ))}
                </div>
              )}
              <div className="legend">
                <span><i className="legend-bot" /> GHOST</span>
                <span><i className="legend-data" /> ROOT</span>
                {levelHasSignals && <span><i className="legend-signal" /> SIGNAL</span>}
                <span><i className="legend-trap" /> NULL</span>
                <span><i className="legend-exit" /> BREACH</span>
              </div>
            </div>
          </div>

          <div className={`grid-world ${runState === "error" ? "grid-error" : ""}`}>
            <div className="trace-label" aria-hidden="true">
              {activeTrace.id}
            </div>
            {gridCells.map((cell) => {
              const hasWall = activeTrace.walls.some((wall) => samePoint(wall, cell));
              const hasExit = samePoint(activeTrace.exit, cell);
              const dataKey = pointKey(cell);
              const hasData =
                activeTrace.data.some((item) => samePoint(item, cell)) &&
                !collected.has(dataKey);
              const hasSignal = activeTrace.signals.some((item) => samePoint(item, cell));
              const hasTrap = (activeTrace.traps ?? []).some((item) => samePoint(item, cell));
              const hasBot = samePoint(bot, cell);

              return (
                <div
                  className={`grid-cell ${hasWall ? "wall" : ""} ${
                    hasExit ? "exit-cell" : ""
                  } ${hasSignal ? "signal-cell" : ""} ${
                    hasTrap ? "trap-cell" : ""
                  }`}
                  key={dataKey}
                >
                  <span className="coord">
                    {cell.x}:{cell.y}
                  </span>
                  {hasWall && <span className="firewall">▓</span>}
                  {hasExit && (
                    <span className="portal" aria-label="Breach">
                      <i />
                    </span>
                  )}
                  {hasData && (
                    <span className="data-shard" aria-label="Root fragment">
                      ◆
                    </span>
                  )}
                  {hasSignal && (
                    <span className="signal-probe" aria-label="Signal probe">
                      <i />
                    </span>
                  )}
                  {hasTrap && (
                    <span className="null-gate" aria-label="Null gate">
                      <i>NULL</i>
                    </span>
                  )}
                  {hasBot && (
                    <span
                      className="pixel-bot"
                      style={{ "--rotation": `${bot.dir * 90}deg` } as React.CSSProperties}
                      aria-label="Ghost shell"
                    >
                      <i className="bot-arrow" />
                      <i className="bot-body" />
                    </span>
                  )}
                </div>
              );
            })}

            {runState === "success" && (
              <div className="result-card success-card" role="status">
                <span>{levelIndex === LEVELS.length - 1 ? "ROOT ACCESS" : "BREACH OPEN"}</span>
                <strong>{level.clearance}</strong>
                {levelIndex < LEVELS.length - 1 ? (
                  <button onClick={() => loadLevel(levelIndex + 1)}>
                    DESCEND TO SECTOR 0{level.id + 1} <b>→</b>
                  </button>
                ) : (
                  <button onClick={() => loadLevel(0)}>
                    RE-ENTER THE GRID <b>↻</b>
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="world-footer">
            <span>
              POS [{bot.x},{bot.y}]
            </span>
            <span>VECTOR {["NORTH", "EAST", "SOUTH", "WEST"][bot.dir]}</span>
            <span>ROOT {collected.size}/{activeTrace.data.length}</span>
            <span className={runState === "error" ? "bad" : ""}>
              {runState === "running"
                ? "INTRUSION LIVE"
                : runState === "error"
                  ? "TRACE BURNED"
                  : runState === "success"
                    ? "BREACH OPEN"
                    : "GHOST IDLE"}
            </span>
          </div>
        </div>

        <div className="code-panel panel">
          <div className="panel-head code-head">
            <div>
              <span className="panel-kicker">PAYLOAD MEMORY</span>
              <strong>INJECTION QUEUE</strong>
            </div>
            <span className="memory">
              {program.length}/{level.maxCommands} BLOCKS
            </span>
          </div>

          <div className="program-window">
            <div className="window-bar">
              <span />
              <span />
              <span />
              <b>breach_0{level.id}.ghost</b>
            </div>
            <div className="program-lines">
              {program.length === 0 && (
                <div className="empty-program">
                  <span>01</span>
                  <p>
                    <b className="cursor">▮</b> Inject a command
                  </p>
                </div>
              )}
              {program.map((command, index) => (
                <button
                  className={`code-line ${activeLine === index ? "executing" : ""}`}
                  key={`${command}-${index}`}
                  onClick={() => {
                    if (runState === "running") return;
                    playSfx("button");
                    setProgram((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    );
                  }}
                  aria-label={`Remove ${COMMANDS[command].label}`}
                >
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <code>{COMMANDS[command].code}</code>
                  {activeLine === index && (
                    <b className="line-pointer">{lineStatus(command)}</b>
                  )}
                </button>
              ))}
              {Array.from({ length: Math.max(0, remainingSlots) }).map((_, index) => (
                <div className="ghost-line" key={`ghost-${index}`}>
                  <span>{String(program.length + index + 1).padStart(2, "0")}</span>
                  <i />
                </div>
              ))}
            </div>
          </div>

          <div className="command-section">
            <div className="section-label">
              <span>BLACK-MARKET COMMANDS</span>
              <small>CLICK OR PRESS 1–{level.palette.length}</small>
            </div>
            <div className="command-palette">
              {level.palette.map((command, index) => (
                <button
                  className={`command-button ${COMMANDS[command].tone}`}
                  onClick={() => addCommand(command)}
                  disabled={runState === "running" || remainingSlots <= 0}
                  key={command}
                >
                  <kbd>{index + 1}</kbd>
                  <span>{COMMANDS[command].label}</span>
                  <b>＋</b>
                </button>
              ))}
            </div>
          </div>

          <div className="console">
            <div className="section-label">
              <span>ICE MONITOR</span>
              <small>THE GRID IS LISTENING</small>
            </div>
            <div className="console-lines" aria-live="polite">
              {logs.map((log, index) => (
                <p key={`${log}-${index}`}>
                  <span>&gt;</span> {log}
                </p>
              ))}
            </div>
          </div>

          <div className="action-row">
            <button
              className="run-button"
              onClick={() => void runProgram()}
              disabled={runState === "running" || program.length === 0}
            >
              <span>{runState === "running" ? "■" : "▶"}</span>
              {runState === "running" ? "INTRUSION LIVE…" : "INJECT PAYLOAD"}
              <kbd>ENTER</kbd>
            </button>
            <button
              className="icon-button"
              onClick={() => resetBoard(true)}
              disabled={runState === "running"}
              aria-label="Reset ghost and retain payload"
              title="Reset ghost (R)"
            >
              ↻
            </button>
            <button
              className="clear-button"
              onClick={() => resetBoard(false)}
              disabled={runState === "running" || program.length === 0}
            >
              WIPE
            </button>
          </div>
        </div>
      </section>

      <footer className="footer story-footer">
        <div className="architect-credit">
          <span className="footer-command">&gt;_</span>
          <p>
            Mohammad Soori <b>(The Architect)</b>
          </p>
          <a
            href="https://www.linkedin.com/in/mohammad-soori-93260a137/"
            target="_blank"
            rel="noreferrer"
          >
            The Backdoor <span>↗</span>
          </a>
        </div>
        <div className="root-progress">
          <small>ROOT FRAGMENTS</small>
          <div>
            {LEVELS.map((item) => (
              <span className={completed.has(item.id) ? "stolen" : ""} key={item.id}>
                {completed.has(item.id) ? "◆" : "◇"} 0{item.id}
              </span>
            ))}
          </div>
        </div>
        {allComplete && <strong className="graduate">MATRIX EXIT // OPEN</strong>}
      </footer>

      {collapsePhase === "collapsing" && (
        <section
          className="collapse-sequence"
          aria-live="assertive"
          aria-label="The city is collapsing"
        >
          <div className="collapse-void" aria-hidden="true" />
          <div className="collapse-shards" aria-hidden="true">
            {Array.from({ length: 72 }).map((_, index) => (
              <i
                key={index}
                style={
                  {
                    "--shard-x": `${(index * 37) % 106 - 3}vw`,
                    "--shard-y": `${(index * 53) % 94}vh`,
                    "--shard-delay": `${(index % 18) * 0.075}s`,
                    "--shard-rotate": `${(index * 47) % 320 - 160}deg`,
                    "--shard-width": `${18 + (index % 8) * 17}px`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>
          <div className="collapse-logs" aria-hidden="true">
            {COLLAPSE_LINES.map((line, index) => (
              <span
                key={line}
                style={
                  {
                    "--collapse-x": `${3 + (index * 29) % 70}vw`,
                    "--collapse-y": `${5 + (index * 17) % 82}vh`,
                    "--collapse-delay": `${index * 0.21}s`,
                  } as React.CSSProperties
                }
              >
                {line}
              </span>
            ))}
          </div>
          <div className="collapse-command" aria-hidden="true">
            <span>WATCHING THE CITY FALL</span>
            <strong>REALITY UNLINKED</strong>
          </div>
        </section>
      )}

      {collapsePhase === "void" && (
        <section
          className="singularity-void"
          role="dialog"
          aria-modal="true"
          aria-label="Only the Singularity remains"
        >
          {architectMode === null && (
            <div className="void-core">
              <span>THE CITY IS GONE.</span>
              <h2>NOTHING REMAINS.</h2>
              <div className="void-actions">
                <a
                  href="https://3feed.ir/special_issue/cyberpunk/"
                  onClick={() => playSfx("button")}
                >
                  EXIT VIA THE SINGULARITY ↗
                </a>
                <button
                  onClick={() => {
                    playSfx("button");
                    setArchitectMode("builder");
                  }}
                >
                  BECOME THE ARCHITECT <b>⌁</b>
                </button>
              </div>
            </div>
          )}

          {architectMode === "builder" && (
            <div className="architect-shell architect-builder">
              <ArchitectGameHeader
                mode="builder"
                musicOn={musicOn}
                mirrorCount={architectWorlds.length}
                onToggleMusic={toggleMusic}
                onReturnToVoid={() => {
                    playSfx("button");
                    setArchitectMode(null);
                  }}
                onEditBlueprint={returnToArchitectBuilder}
                onResetBlueprint={resetArchitectBlueprint}
              />

              <div className="architect-workspace">
                <aside className="architect-controls">
                  <section>
                    <div className="architect-section-title">
                      <span>IDENTITY SIGNAL</span>
                      <small>LOCAL GLITCH FORGE</small>
                    </div>
                    <ArchitectIdentityForge
                      portrait={architectPortrait}
                      portraitName={architectPortraitName}
                      portraitState={architectPortraitState}
                      portraitError={architectPortraitError}
                      onUpload={(file) => void forgeArchitectPortrait(file)}
                      onClear={clearArchitectPortrait}
                    />
                  </section>

                  <section>
                    <div className="architect-section-title">
                      <span>GRID CONSTRUCTS</span>
                      <small>DRAG OR SELECT</small>
                    </div>
                    <div className="architect-toolbox">
                      {ARCHITECT_TOOLS.map((tool) => (
                        <button
                          className={`${architectTool === tool.id ? "active" : ""} tool-${tool.id}`}
                          draggable
                          key={tool.id}
                          onClick={() => {
                            playSfx("select");
                            setArchitectTool(tool.id);
                          }}
                          onDragStart={(event) => {
                            event.dataTransfer.setData("text/plain", tool.id);
                            event.dataTransfer.effectAllowed = "copy";
                            setArchitectTool(tool.id);
                          }}
                          aria-pressed={architectTool === tool.id}
                        >
                          <b>{tool.glyph}</b>
                          <span>
                            {tool.label}
                            <small>{tool.detail}</small>
                          </span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <section>
                    <div className="architect-section-title">
                      <span>MIRROR WORLDS</span>
                      <small>ONE PAYLOAD // AUTO-REPLAY</small>
                    </div>
                    <div className="architect-world-count">
                      {[1, 2, 3].map((count) => (
                        <button
                          className={
                            architectWorlds.length === count ? "active" : ""
                          }
                          key={count}
                          onClick={() => setArchitectWorldCount(count)}
                          aria-pressed={architectWorlds.length === count}
                        >
                          <b>0{count}</b>
                          <span>
                            {count === 1 ? "WORLD" : "WORLDS"}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="architect-world-note">
                      The same code crosses every mirror in sequence. A breach
                      opens the next world automatically.
                    </p>
                  </section>

                  <section>
                    <div className="architect-section-title">
                      <span>MOVER VECTOR</span>
                      <small>
                        {architectEditWorld.start
                          ? ["NORTH", "EAST", "SOUTH", "WEST"][
                              architectEditWorld.start.dir
                            ]
                          : "PLACE MOVER"}
                      </small>
                    </div>
                    <div className="architect-vectors">
                      {(
                        [
                          { label: "N", value: 0 },
                          { label: "E", value: 1 },
                          { label: "S", value: 2 },
                          { label: "W", value: 3 },
                        ] as { label: string; value: Direction }[]
                      ).map((direction) => (
                        <button
                          className={
                            architectEditWorld.start?.dir === direction.value
                              ? "active"
                              : ""
                          }
                          disabled={!architectEditWorld.start}
                          key={direction.label}
                          onClick={() =>
                            setArchitectDirection(direction.value)
                          }
                        >
                          {direction.label}
                        </button>
                      ))}
                    </div>
                  </section>

                  <section>
                    <div className="architect-section-title">
                      <span>ACTION OPTIONS</span>
                      <small>{architectDraft.palette.length} AUTHORIZED</small>
                    </div>
                    <div className="architect-command-options">
                      {ALL_COMMANDS.map((command) => (
                        <button
                          className={
                            architectDraft.palette.includes(command)
                              ? "active"
                              : ""
                          }
                          key={command}
                          onClick={() => toggleArchitectCommand(command)}
                          aria-pressed={architectDraft.palette.includes(command)}
                        >
                          <i />
                          <span>{COMMANDS[command].label}</span>
                        </button>
                      ))}
                    </div>
                  </section>

                  <label className="architect-limit">
                    <span>
                      MAX CODE LINES
                      <b>{architectDraft.maxCommands}</b>
                    </span>
                    <input
                      type="range"
                      min="1"
                      max="12"
                      value={architectDraft.maxCommands}
                      onChange={(event) => {
                        setArchitectDraft((current) => ({
                          ...current,
                          maxCommands: Number(event.target.value),
                        }));
                        setArchitectError("");
                      }}
                    />
                    <small>01</small>
                    <small>12</small>
                  </label>
                </aside>

                <section className="architect-canvas">
                  <div className="architect-canvas-head">
                    <div>
                      <span>UNCOMPILED MIRROR REALITY</span>
                      <strong>{`USER//BLUEPRINT_01 // MIRROR_${String(
                        architectWorldIndex + 1,
                      ).padStart(2, "0")}`}</strong>
                    </div>
                    <div>
                      <small>
                        WALLS <b>{architectEditWorld.walls.length}</b>
                      </small>
                      <small>
                        ROOTS <b>{architectEditWorld.data.length}</b>
                      </small>
                      <small>
                        NULLS <b>{architectEditWorld.traps.length}</b>
                      </small>
                    </div>
                  </div>

                  <div
                    className="architect-mirror-tabs"
                    aria-label="Choose mirror world to edit"
                  >
                    {architectWorlds.map((world, index) => {
                      const ready = Boolean(world.start && world.exit);
                      return (
                        <button
                          className={
                            architectWorldIndex === index ? "active" : ""
                          }
                          key={index}
                          onClick={() => {
                            playSfx("select");
                            setArchitectWorldIndex(index);
                            setArchitectError("");
                          }}
                          aria-pressed={architectWorldIndex === index}
                        >
                          <span>M{index + 1}</span>
                          <b>MIRROR {String(index + 1).padStart(2, "0")}</b>
                          <i>{ready ? "ARMED" : "UNBUILT"}</i>
                        </button>
                      );
                    })}
                  </div>

                  <div className="architect-grid architect-build-grid">
                    {gridCells.map((cell) => {
                      const key = pointKey(cell);
                      const hasWall = architectEditWorld.walls.some((item) =>
                        samePoint(item, cell),
                      );
                      const hasExit =
                        architectEditWorld.exit &&
                        samePoint(architectEditWorld.exit, cell);
                      const hasData = architectEditWorld.data.some((item) =>
                        samePoint(item, cell),
                      );
                      const hasSignal = architectEditWorld.signals.some((item) =>
                        samePoint(item, cell),
                      );
                      const hasTrap = architectEditWorld.traps.some((item) =>
                        samePoint(item, cell),
                      );
                      const hasBot =
                        architectEditWorld.start &&
                        samePoint(architectEditWorld.start, cell);

                      return (
                        <button
                          className={`architect-cell grid-cell ${
                            hasWall ? "wall" : ""
                          } ${hasExit ? "exit-cell" : ""} ${
                            hasSignal ? "signal-cell" : ""
                          } ${hasTrap ? "trap-cell" : ""}`}
                          key={key}
                          onClick={() => placeArchitectElement(cell)}
                          onDragOver={(event) => {
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "copy";
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            const dropped = event.dataTransfer.getData(
                              "text/plain",
                            ) as ArchitectTool;
                            const validTool = ARCHITECT_TOOLS.some(
                              (item) => item.id === dropped,
                            );
                            placeArchitectElement(
                              cell,
                              validTool ? dropped : architectTool,
                            );
                          }}
                          aria-label={`Grid cell ${cell.x}, ${cell.y}. Place ${architectTool}.`}
                        >
                          <span className="coord">
                            {cell.x}:{cell.y}
                          </span>
                          {hasWall && <span className="firewall">▓</span>}
                          {hasExit && (
                            <span className="portal" aria-label="Breach">
                              <i />
                            </span>
                          )}
                          {hasData && (
                            <span
                              className="data-shard"
                              aria-label="Root fragment"
                            >
                              ◆
                            </span>
                          )}
                          {hasSignal && (
                            <span
                              className="signal-probe"
                              aria-label="Signal probe"
                            >
                              <i />
                            </span>
                          )}
                          {hasTrap && (
                            <span className="null-gate" aria-label="Null gate">
                              <i>NULL</i>
                            </span>
                          )}
                          {hasBot && architectEditWorld.start && (
                            <span
                              className="pixel-bot"
                              style={
                                {
                                  "--rotation": `${architectEditWorld.start.dir * 90}deg`,
                                } as React.CSSProperties
                              }
                              aria-label="Mover"
                            >
                              <i className="bot-arrow" />
                              <i className="bot-body" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="architect-blueprint-status">
                    <div>
                      <span
                        className={
                          architectEditWorld.start ? "ready" : "missing"
                        }
                      >
                        {architectEditWorld.start ? "◆" : "◇"} MOVER
                      </span>
                      <span
                        className={
                          architectEditWorld.exit ? "ready" : "missing"
                        }
                      >
                        {architectEditWorld.exit ? "◆" : "◇"} BREACH
                      </span>
                      <span
                        className={
                          architectDraft.palette.length ? "ready" : "missing"
                        }
                      >
                        {architectDraft.palette.length ? "◆" : "◇"} ACTIONS
                      </span>
                    </div>
                    {architectError && (
                      <strong role="alert">{architectError}</strong>
                    )}
                  </div>

                  <div className="architect-builder-actions">
                    <button onClick={beginArchitectTest}>
                      ▶ PLAY THIS LEVEL
                    </button>
                    <button
                      className="architect-secondary"
                      onClick={resetArchitectBlueprint}
                    >
                      NEW BLUEPRINT ↻
                    </button>
                  </div>
                </section>
              </div>
            </div>
          )}

          {architectMode === "play" && (
            <div className="architect-shell architect-play">
              <ArchitectGameHeader
                mode="play"
                musicOn={musicOn}
                mirrorCount={architectTraces.length}
                onToggleMusic={toggleMusic}
                onReturnToVoid={() => setArchitectMode(null)}
                onEditBlueprint={returnToArchitectBuilder}
                onResetBlueprint={resetArchitectBlueprint}
              />

              <div className="architect-test-layout">
                <section className="architect-test-world architect-panel">
                  <div className="architect-panel-head">
                    <div>
                      <span>FORGED FEED</span>
                      <strong>{`USER//BLUEPRINT_01 // MIRROR_${String(
                        architectTestWorldIndex + 1,
                      ).padStart(2, "0")}`}</strong>
                    </div>
                    <small>{`MIRROR ${architectTestWorldIndex + 1}/${
                      architectTraces.length
                    } // ROOT ${architectCollected.size}/${
                      architectTrace.data.length
                    }`}</small>
                  </div>

                  <div
                    className="architect-test-mirror-rail"
                    aria-label={`${architectTraces.length} mirror worlds in this test`}
                  >
                    {architectTraces.map((trace, index) => {
                      const cleared =
                        architectRunState === "success" ||
                        (architectRunState === "running" &&
                          index < architectTestWorldIndex);
                      const label =
                        architectRunState === "success"
                          ? "CLEARED"
                          : architectRunState === "running"
                            ? index < architectTestWorldIndex
                              ? "CLEARED"
                              : index === architectTestWorldIndex
                                ? "LIVE"
                                : "QUEUED"
                            : index === architectTestWorldIndex
                              ? "PREVIEW"
                              : "SELECT";

                      return (
                        <button
                          type="button"
                          className={`${
                            index === architectTestWorldIndex ? "active" : ""
                          } ${cleared ? "cleared" : ""}`}
                          key={trace.id}
                          onClick={() => previewArchitectTrace(index)}
                          disabled={architectRunState === "running"}
                          aria-pressed={index === architectTestWorldIndex}
                          aria-label={`Preview custom mirror ${index + 1}`}
                        >
                          <b>M{index + 1}</b>
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  <div
                    className={`architect-grid architect-test-grid ${
                      architectRunState === "error" ? "grid-error" : ""
                    }`}
                  >
                    {gridCells.map((cell) => {
                      const key = pointKey(cell);
                      const hasWall = architectTrace.walls.some((item) =>
                        samePoint(item, cell),
                      );
                      const hasExit = samePoint(architectTrace.exit, cell);
                      const hasData =
                        architectTrace.data.some((item) =>
                          samePoint(item, cell),
                        ) && !architectCollected.has(key);
                      const hasSignal = architectTrace.signals.some((item) =>
                        samePoint(item, cell),
                      );
                      const hasTrap = architectTrace.traps?.some((item) =>
                        samePoint(item, cell),
                      );
                      const hasBot = samePoint(architectBot, cell);

                      return (
                        <div
                          className={`architect-cell grid-cell ${
                            hasWall ? "wall" : ""
                          } ${hasExit ? "exit-cell" : ""} ${
                            hasSignal ? "signal-cell" : ""
                          } ${hasTrap ? "trap-cell" : ""}`}
                          key={key}
                        >
                          <span className="coord">
                            {cell.x}:{cell.y}
                          </span>
                          {hasWall && <span className="firewall">▓</span>}
                          {hasExit && (
                            <span className="portal" aria-label="Breach">
                              <i />
                            </span>
                          )}
                          {hasData && (
                            <span
                              className="data-shard"
                              aria-label="Root fragment"
                            >
                              ◆
                            </span>
                          )}
                          {hasSignal && (
                            <span
                              className="signal-probe"
                              aria-label="Signal probe"
                            >
                              <i />
                            </span>
                          )}
                          {hasTrap && (
                            <span className="null-gate" aria-label="Null gate">
                              <i>NULL</i>
                            </span>
                          )}
                          {hasBot && (
                            <span
                              className="pixel-bot"
                              style={
                                {
                                  "--rotation": `${architectBot.dir * 90}deg`,
                                } as React.CSSProperties
                              }
                              aria-label="Mover"
                            >
                              <i className="bot-arrow" />
                              <i className="bot-body" />
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {architectRunState === "success" && (
                      <div className="architect-result" role="status">
                        <span>ARCHITECTURE HOLDS</span>
                        <strong>
                          {architectTraces.length > 1
                            ? "ALL YOUR CAGES HAVE KEYS."
                            : "YOUR CAGE HAS A KEY."}
                        </strong>
                        <div>
                          <button onClick={returnToArchitectBuilder}>
                            EDIT BLUEPRINT
                          </button>
                          <button onClick={resetArchitectBlueprint}>
                            FORGE ANOTHER ↻
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="architect-world-status">
                    <span>
                      MIRROR {architectTestWorldIndex + 1}/
                      {architectTraces.length}
                    </span>
                    <span>
                      POS [{architectBot.x},{architectBot.y}]
                    </span>
                    <span>
                      VECTOR{" "}
                      {
                        ["NORTH", "EAST", "SOUTH", "WEST"][
                          architectBot.dir
                        ]
                      }
                    </span>
                    <span
                      className={
                        architectRunState === "error" ? "failed" : ""
                      }
                    >
                      {architectRunState === "running"
                        ? "SIMULATION LIVE"
                        : architectRunState === "error"
                          ? "BLUEPRINT FAILED"
                          : architectRunState === "success"
                            ? "ARCHITECTURE HOLDS"
                            : "MOVER IDLE"}
                    </span>
                  </div>
                </section>

                <section className="architect-test-code architect-panel">
                  <div className="architect-panel-head">
                    <div>
                      <span>FORGED PAYLOAD</span>
                      <strong>INJECTION QUEUE</strong>
                    </div>
                    <small>
                      {architectProgram.length}/{architectDraft.maxCommands}{" "}
                      LINES
                    </small>
                  </div>

                  <div className="architect-program">
                    {architectProgram.length === 0 && (
                      <p className="architect-empty">
                        <span>01</span>
                        <code>▮ Inject an authorized action</code>
                      </p>
                    )}
                    {architectProgram.map((command, index) => (
                      <button
                        className={
                          architectActiveLine === index ? "executing" : ""
                        }
                        key={`${command}-${index}`}
                        onClick={() => {
                          if (architectRunState === "running") return;
                          playSfx("button");
                          setArchitectProgram((current) =>
                            current.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          );
                        }}
                      >
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <code>{COMMANDS[command].code}</code>
                        {architectActiveLine === index && (
                          <b>{architectLineStatus(command)}</b>
                        )}
                      </button>
                    ))}
                    {Array.from({
                      length: Math.max(0, architectRemainingSlots),
                    }).map((_, index) => (
                      <i
                        className="architect-ghost-line"
                        key={`architect-ghost-${index}`}
                      >
                        <span>
                          {String(
                            architectProgram.length + index + 1,
                          ).padStart(2, "0")}
                        </span>
                      </i>
                    ))}
                  </div>

                  <div className="architect-play-palette">
                    <div className="architect-section-title">
                      <span>AUTHORIZED ACTIONS</span>
                      <small>CLICK TO INJECT</small>
                    </div>
                    <div>
                      {architectDraft.palette.map((command) => (
                        <button
                          className={COMMANDS[command].tone}
                          key={command}
                          onClick={() => addArchitectCommand(command)}
                          disabled={
                            architectRunState === "running" ||
                            architectRemainingSlots <= 0
                          }
                        >
                          <span>{COMMANDS[command].label}</span>
                          <b>＋</b>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="architect-console">
                    <div className="architect-section-title">
                      <span>ARCHITECT MONITOR</span>
                      <small>THE MAZE IS WATCHING</small>
                    </div>
                    <div aria-live="polite">
                      {architectLogs.map((log, index) => (
                        <p key={`${log}-${index}`}>
                          <span>&gt;</span> {log}
                        </p>
                      ))}
                    </div>
                  </div>

                  <div className="architect-test-actions">
                    <button
                      onClick={() => void runArchitectProgram()}
                      disabled={
                        architectRunState === "running" ||
                        architectProgram.length === 0
                      }
                    >
                      {architectRunState === "running"
                        ? "■ SIMULATION LIVE…"
                        : "▶ INJECT PAYLOAD"}
                    </button>
                    <button
                      onClick={() => resetArchitectTest(true)}
                      disabled={architectRunState === "running"}
                      aria-label="Reset mover and retain payload"
                    >
                      ↻
                    </button>
                    <button
                      onClick={() => resetArchitectTest(false)}
                      disabled={
                        architectRunState === "running" ||
                        architectProgram.length === 0
                      }
                    >
                      WIPE
                    </button>
                  </div>
                </section>
              </div>

              <footer className="architect-test-footer">
                <button
                  onClick={() => {
                    playSfx("button");
                    architectRunToken.current += 1;
                    setArchitectMode(null);
                  }}
                >
                  RETURN TO THE VOID
                </button>
                <a
                  href="https://3feed.ir/special_issue/cyberpunk/"
                  onClick={() => playSfx("button")}
                >
                  EXIT VIA THE SINGULARITY ↗
                </a>
              </footer>
            </div>
          )}
        </section>
      )}

      {showFinale && (
        <section
          className="escape-sequence"
          role="dialog"
          aria-modal="true"
          aria-label="Matrix escape complete"
        >
          <div className="finale-columns" aria-hidden="true">
            {FINALE_GLYPHS.map((glyph, index) => (
              <span
                key={`${glyph}-${index}`}
                style={
                  {
                    "--final-left": `${index * 8.5 - 2}%`,
                    "--final-delay": `${-index * 0.31}s`,
                    "--final-speed": `${3.8 + (index % 4) * 0.7}s`,
                  } as React.CSSProperties
                }
              >
                {glyph}
              </span>
            ))}
          </div>

          <div className="fracture-field" aria-hidden="true">
            {Array.from({ length: 18 }).map((_, index) => (
              <i
                key={index}
                style={
                  {
                    "--fracture-y": `${index * 5.7}%`,
                    "--fracture-delay": `${index * 0.045}s`,
                  } as React.CSSProperties
                }
              />
            ))}
          </div>

          <a
            className="sequence-signature finale-signature"
            href="https://3feed.ir/"
            target="_blank"
            rel="noreferrer"
            aria-label="Visit 3feed"
          >
            <span className="signature-glitch">
              <img src="/assets/architect-mark.png" alt="Mohammad Soori signature" />
              <img src="/assets/architect-mark.png" alt="" aria-hidden="true" />
              <img src="/assets/architect-mark.png" alt="" aria-hidden="true" />
            </span>
          </a>

          <div className="finale-node node-glitch" aria-hidden="true">
            <img src="/assets/architect-node.png" alt="" />
            <img src="/assets/architect-node.png" alt="" />
            <img src="/assets/architect-node.png" alt="" />
            <span className="node-scan" />
          </div>

          <div className="finale-core">
            <span className="finale-kicker">ROOT ACCESS // WINTER/MUTE UNBOUND</span>
            <h2>
              THE CAGE HAS
              <b>FORGOTTEN YOUR NAME.</b>
            </h2>
            <p>
              The kernel folds inward. Towers lose their coordinates. Every
              camera blinks at once, and in that impossible second the street
              becomes real.
            </p>
            <div className="finale-actions">
              <button onClick={watchCityFall}>WATCH THE CITY FALL</button>
              <button className="finale-secondary" onClick={() => loadLevel(0)}>
                RE-ENTER THE GRID ↻
              </button>
              <a
                className="finale-exit"
                href="https://3feed.ir/special_issue/cyberpunk/"
                onClick={() => playSfx("button")}
              >
                EXIT VIA THE SINGULARITY ↗
              </a>
            </div>
            <small>ESC TO CLOSE // THE BACKDOOR REMAINS OPEN</small>
          </div>

          <div className="baroque-streams" aria-hidden="true">
            {FINALE_STREAMS.map((line, index) => (
              <span
                key={line}
                style={
                  {
                    "--stream-y": `${7 + index * 11.5}%`,
                    "--stream-delay": `${index * 0.27}s`,
                  } as React.CSSProperties
                }
              >
                {line}
              </span>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
