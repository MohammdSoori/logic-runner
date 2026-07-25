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
        exit: { x: 4, y: 4 },
        walls: [
          { x: 5, y: 2 },
          { x: 3, y: 3 },
          { x: 5, y: 3 },
        ],
        data: [{ x: 4, y: 3 }],
        signals: [],
        traps: [{ x: 3, y: 4 }],
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
    palette: ["move", "right", "repeat3", "whileclear", "ifwallright"],
    maxCommands: 3,
  },
  {
    id: 5,
    name: "Ghost Step",
    protocol: "ROUTINE INJECTION",
    briefing:
      "An old intruder left one movement signature in two distant vaults. Raw routes overflow the buffer; the stolen routine survives both mappings.",
    hint: "Two calls. One ghost routine. The vault can move, but the signature remains.",
    clearance: "The old hacker’s route wakes under your feet.",
    traces: [
      {
        id: "ROUTINE VAULT",
        start: { x: 0, y: 4, dir: 0 },
        exit: { x: 2, y: 0 },
        walls: [
          { x: 1, y: 4 },
          { x: 1, y: 3 },
          { x: 0, y: 1 },
          { x: 2, y: 2 },
          { x: 2, y: 1 },
          { x: 3, y: 0 },
        ],
        data: [
          { x: 1, y: 2 },
          { x: 2, y: 0 },
        ],
        signals: [],
        traps: [
          { x: 3, y: 1 },
          { x: 4, y: 0 },
        ],
      },
      {
        id: "ROUTINE VAULT // ECHO",
        start: { x: 3, y: 4, dir: 0 },
        exit: { x: 5, y: 0 },
        walls: [
          { x: 2, y: 4 },
          { x: 4, y: 4 },
          { x: 2, y: 3 },
          { x: 2, y: 2 },
          { x: 3, y: 1 },
          { x: 3, y: 0 },
          { x: 5, y: 1 },
        ],
        data: [
          { x: 4, y: 2 },
          { x: 5, y: 0 },
        ],
        signals: [],
        traps: [
          { x: 5, y: 2 },
          { x: 5, y: 3 },
        ],
      },
    ],
    palette: ["move", "left", "right", "ghoststep"],
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
    palette: ["move", "left", "right", "whileclear", "ifsignalright", "ifwallleft"],
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
  const runToken = useRef(0);
  const audioEngineRef = useRef<CyberAudioEngine | null>(null);
  const sfxContextRef = useRef<AudioContext | null>(null);
  const collapseTimerRef = useRef<number | null>(null);

  const remainingSlots = level.maxCommands - program.length;
  const allComplete = completed.size === LEVELS.length;
  const levelHasSignals = level.traces.some((trace) => trace.signals.length > 0);

  const startMusic = useCallback(async () => {
    const runningEngine = audioEngineRef.current;
    if (runningEngine) {
      if (runningEngine.context.state === "suspended") {
        await runningEngine.context.resume();
      }
      runningEngine.master.gain.setTargetAtTime(
        0.16,
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
    lowpass.frequency.value = 1850;
    lowpass.Q.value = 1.8;

    master.connect(lowpass);
    lowpass.connect(compressor);
    compressor.connect(context.destination);

    [
      { frequency: 41.2, type: "sawtooth" as OscillatorType, volume: 0.065 },
      { frequency: 82.4, type: "sine" as OscillatorType, volume: 0.035 },
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

    const bassPattern = [55, 55, 82.41, 55, 65.41, 55, 98, 73.42];
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

      if (active.step % 2 === 1) {
        const tick = context.createOscillator();
        const tickGain = context.createGain();
        tick.type = "triangle";
        tick.frequency.setValueAtTime(
          active.step % 4 === 1 ? 1680 : 1120,
          now,
        );
        tick.frequency.exponentialRampToValueAtTime(260, now + 0.045);
        tickGain.gain.setValueAtTime(0.095, now);
        tickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.052);
        tick.connect(tickGain);
        tickGain.connect(master);
        tick.start(now);
        tick.stop(now + 0.06);
      }

      active.step += 1;
    };

    pulse();
    engine.timer = window.setInterval(pulse, 190);
    await context.resume();
    master.gain.exponentialRampToValueAtTime(0.16, context.currentTime + 0.45);
    setMusicOn(true);
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
                    <span
                      className={`${index === activeTraceIndex ? "active" : ""} ${
                        index < activeTraceIndex && runState !== "idle" ? "passed" : ""
                      }`}
                      key={trace.id}
                    >
                      M{index + 1}
                    </span>
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
          <div>
            <span>THE CITY IS GONE.</span>
            <h2>NOTHING REMAINS.</h2>
            <a
              href="https://3feed.ir/special_issue/cyberpunk/"
              onClick={() => playSfx("button")}
            >
              EXIT VIA THE SINGULARITY ↗
            </a>
          </div>
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
