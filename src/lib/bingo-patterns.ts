export type StageType =
  | "LINEA"
  | "PUNTA"
  | "ESQUINAS"
  | "BINGO_LOCO"
  | "LETRA"
  | "LLENA"
  // Combinaciones tradicionales de Bingos en Ecuador (2 juegos simultáneos en la misma tabla)
  | "LINEA_Y_PUNTA"
  | "LINEA_Y_ESQUINAS"
  | "PUNTA_Y_ESQUINAS";

export interface StageInfo {
  id: StageType;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
}

export const STAGES: Record<StageType, StageInfo> = {
  LINEA: {
    id: "LINEA",
    label: "1 Línea (Horizontal, Vertical o Diagonal)",
    shortLabel: "1 LÍNEA",
    description: "Completa una fila, columna o diagonal de esta tabla",
    icon: "📏",
  },
  PUNTA: {
    id: "PUNTA",
    label: "Punta (Primera Esquina)",
    shortLabel: "PUNTA",
    description: "Acierta cualquiera de las esquinas/puntas de la tabla",
    icon: "📐",
  },
  ESQUINAS: {
    id: "ESQUINAS",
    label: "4 Esquinas (Las 4 Puntas)",
    shortLabel: "4 ESQUINAS",
    description: "Completa las 4 esquinas superiores e inferiores de la tabla",
    icon: "四角",
  },
  LINEA_Y_PUNTA: {
    id: "LINEA_Y_PUNTA",
    label: "Línea + Punta (Ambos en la misma tabla)",
    shortLabel: "LÍNEA + PUNTA",
    description: "Acierta una Línea completa Y además una Punta/Esquina",
    icon: "🎯",
  },
  LINEA_Y_ESQUINAS: {
    id: "LINEA_Y_ESQUINAS",
    label: "Línea + 4 Esquinas (Ambos en la misma tabla)",
    shortLabel: "LÍNEA + 4 ESQUINAS",
    description: "Acierta una Línea completa Y las 4 Esquinas completas",
    icon: "⭐",
  },
  PUNTA_Y_ESQUINAS: {
    id: "PUNTA_Y_ESQUINAS",
    label: "Punta + 4 Esquinas",
    shortLabel: "PUNTA + 4 ESQUINAS",
    description: "Acierta la primera Punta y luego las 4 Esquinas",
    icon: "✨",
  },
  BINGO_LOCO: {
    id: "BINGO_LOCO",
    label: "Bingo Loco (5 Números Cualesquiera)",
    shortLabel: "BINGO LOCO",
    description: "Completa 5 números cualesquiera en cualquier parte de la tabla",
    icon: "🤪",
  },
  LETRA: {
    id: "LETRA",
    label: "Letra Completa (B-I-N-G-O)",
    shortLabel: "LETRA COMPLETA",
    description: "Completa todos los números que forman la letra de esta tabla",
    icon: "🔤",
  },
  LLENA: {
    id: "LLENA",
    label: "Tabla Llena (Todos los números)",
    shortLabel: "TABLA LLENA",
    description: "Completa absolutamente todos los números impresos en esta tabla",
    icon: "🏆",
  },
};

export const STAGE_ORDER: StageType[] = [
  "LINEA",
  "PUNTA",
  "ESQUINAS",
  "LINEA_Y_PUNTA",
  "LINEA_Y_ESQUINAS",
  "PUNTA_Y_ESQUINAS",
  "BINGO_LOCO",
  "LETRA",
  "LLENA",
];

export const TABLE_LETTERS: Record<number, { letter: string; title: string }> = {
  1: { letter: "B", title: "Letra B" },
  2: { letter: "I", title: "Letra I" },
  3: { letter: "N", title: "Letra N" },
  4: { letter: "G", title: "Letra G" },
  5: { letter: "O", title: "Letra O" },
  6: { letter: "LLENA", title: "Tabla Llena" },
};

/**
 * Máscara exacta de qué casillas [fila, columna] llevan número en cada una de las 6 tablas:
 * - Tabla #1: Forma la letra B
 * - Tabla #2: Forma la letra I
 * - Tabla #3: Forma la letra N
 * - Tabla #4: Forma la letra G
 * - Tabla #5: Forma la letra O
 * - Tabla #6: Tabla Llena (las 24 casillas llevan número + BINGO central)
 */
export const TABLE_ACTIVE_MASKS: Record<number, [number, number][]> = {
  1: [
    [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
    [1, 0],                         [1, 4],
    [2, 0], [2, 1], [2, 2], [2, 3],
    [3, 0],                         [3, 4],
    [4, 0], [4, 1], [4, 2], [4, 3], [4, 4],
  ],
  2: [
    [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
                    [1, 2],
                    [2, 2],
                    [3, 2],
    [4, 0], [4, 1], [4, 2], [4, 3], [4, 4],
  ],
  3: [
    [0, 0],                         [0, 4],
    [1, 0], [1, 1],                 [1, 4],
    [2, 0],         [2, 2],         [2, 4],
    [3, 0],                 [3, 3], [3, 4],
    [4, 0],                         [4, 4],
  ],
  4: [
    [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
    [1, 0],
    [2, 0],         [2, 2], [2, 3], [2, 4],
    [3, 0],                         [3, 4],
    [4, 0], [4, 1], [4, 2], [4, 3], [4, 4],
  ],
  5: [
    [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
    [1, 0],                         [1, 4],
    [2, 0],         [2, 2],         [2, 4],
    [3, 0],                         [3, 4],
    [4, 0], [4, 1], [4, 2], [4, 3], [4, 4],
  ],
  6: [
    [0, 0], [0, 1], [0, 2], [0, 3], [0, 4],
    [1, 0], [1, 1], [1, 2], [1, 3], [1, 4],
    [2, 0], [2, 1], [2, 2], [2, 3], [2, 4],
    [3, 0], [3, 1], [3, 2], [3, 3], [3, 4],
    [4, 0], [4, 1], [4, 2], [4, 3], [4, 4],
  ],
};

export function isCellActiveInTable(
  tableIndex: number,
  row: number,
  col: number
): boolean {
  if (row === 2 && col === 2) return true;
  const coords = TABLE_ACTIVE_MASKS[tableIndex] || TABLE_ACTIVE_MASKS[6];
  return coords.some(([r, c]) => r === row && c === col);
}

export function applyTableMask(
  masterGrid: number[][],
  tableIndex: number
): number[][] {
  return masterGrid.map((row, rIdx) =>
    row.map((val, cIdx) => {
      if (rIdx === 2 && cIdx === 2) return 0;
      return isCellActiveInTable(tableIndex, rIdx, cIdx) ? val : -1;
    })
  );
}

export interface ValidationResult {
  isValidOfficial: boolean;
  isMarkedByPlayer: boolean;
  patternName: string;
  winningCells: [number, number][];
  missingOfficialNumbers: number[];
}

/**
 * Valida automáticamente si una tabla cumple cualquiera de las modalidades ecuatorianas:
 * LINEA, PUNTA, ESQUINAS, BINGO_LOCO, LETRA o LLENA.
 */
export function validateTablePattern(
  grid: number[][],
  tableIndex: number,
  stage: StageType,
  drawnBalls: number[],
  markedNumbers: number[]
): ValidationResult {
  const drawnSet = new Set(drawnBalls);
  const markedSet = new Set(markedNumbers);

  const isCellNumber = (r: number, c: number) => grid[r][c] > 0;
  const isCellDrawn = (r: number, c: number) =>
    (r === 2 && c === 2) || (grid[r][c] > 0 && drawnSet.has(grid[r][c]));
  const isCellMarked = (r: number, c: number) =>
    (r === 2 && c === 2) || (grid[r][c] > 0 && markedSet.has(grid[r][c]));

  // Construir las líneas posibles de la tabla (filas, columnas y diagonales)
  const candidateLines: { name: string; cells: [number, number][] }[] = [];

  for (let r = 0; r < 5; r++) {
    const cells: [number, number][] = [
      [r, 0],
      [r, 1],
      [r, 2],
      [r, 3],
      [r, 4],
    ];
    if (
      cells.every(([ri, ci]) => (ri === 2 && ci === 2) || isCellNumber(ri, ci))
    ) {
      candidateLines.push({
        name: `Línea Horizontal (Fila ${r + 1})`,
        cells,
      });
    }
  }

  const colLetters = ["B", "I", "N", "G", "O"];
  for (let c = 0; c < 5; c++) {
    const cells: [number, number][] = [
      [0, c],
      [1, c],
      [2, c],
      [3, c],
      [4, c],
    ];
    if (
      cells.every(([ri, ci]) => (ri === 2 && ci === 2) || isCellNumber(ri, ci))
    ) {
      candidateLines.push({
        name: `Línea Vertical (Columna ${colLetters[c]})`,
        cells,
      });
    }
  }

  const diag1: [number, number][] = [
    [0, 0],
    [1, 1],
    [2, 2],
    [3, 3],
    [4, 4],
  ];
  if (
    diag1.every(([ri, ci]) => (ri === 2 && ci === 2) || isCellNumber(ri, ci))
  ) {
    candidateLines.push({ name: "Diagonal Principal (↘)", cells: diag1 });
  }

  const diag2: [number, number][] = [
    [4, 0],
    [3, 1],
    [2, 2],
    [1, 3],
    [0, 4],
  ];
  if (
    diag2.every(([ri, ci]) => (ri === 2 && ci === 2) || isCellNumber(ri, ci))
  ) {
    candidateLines.push({ name: "Diagonal Invertida (↗)", cells: diag2 });
  }

  // 1. MODO LÍNEA
  if (stage === "LINEA") {

    for (const line of candidateLines) {
      const allDrawn = line.cells.every(([r, c]) => isCellDrawn(r, c));
      if (allDrawn) {
        const allMarked = line.cells.every(([r, c]) => isCellMarked(r, c));
        return {
          isValidOfficial: true,
          isMarkedByPlayer: allMarked,
          patternName: line.name,
          winningCells: line.cells,
          missingOfficialNumbers: [],
        };
      }
    }

    let bestLine = candidateLines[0] || { name: "Línea", cells: [] };
    let minMissing: number[] = [999, 999, 999, 999, 999];
    for (const line of candidateLines) {
      const missing = line.cells
        .filter(([r, c]) => !(r === 2 && c === 2) && !isCellDrawn(r, c))
        .map(([r, c]) => grid[r][c]);
      if (missing.length < minMissing.length) {
        minMissing = missing;
        bestLine = line;
      }
    }

    return {
      isValidOfficial: false,
      isMarkedByPlayer: false,
      patternName: bestLine.name,
      winningCells: [],
      missingOfficialNumbers: minMissing,
    };
  }

  // 2. MODO PUNTA (Cualquier esquina cantada y marcada)
  if (stage === "PUNTA") {
    const corners: { name: string; coord: [number, number] }[] = [
      { name: "Punta Superior B", coord: [0, 0] },
      { name: "Punta Superior O", coord: [0, 4] },
      { name: "Punta Inferior B", coord: [4, 0] },
      { name: "Punta Inferior O", coord: [4, 4] },
    ];
    const hitCorners = corners.filter(({ coord: [r, c] }) => isCellDrawn(r, c));
    if (hitCorners.length > 0) {
      const markedHit = hitCorners.some(({ coord: [r, c] }) =>
        isCellMarked(r, c)
      );
      return {
        isValidOfficial: true,
        isMarkedByPlayer: markedHit,
        patternName: hitCorners.map((h) => h.name).join(" + "),
        winningCells: hitCorners.map((h) => h.coord),
        missingOfficialNumbers: [],
      };
    }
    return {
      isValidOfficial: false,
      isMarkedByPlayer: false,
      patternName: "Punta (Esquina)",
      winningCells: [],
      missingOfficialNumbers: corners.map(({ coord: [r, c] }) => grid[r][c]),
    };
  }

  // 3. MODO 4 ESQUINAS (Las 4 puntas completas)
  if (stage === "ESQUINAS") {
    const corners: [number, number][] = [
      [0, 0],
      [0, 4],
      [4, 0],
      [4, 4],
    ];
    const missingOfficial = corners
      .filter(([r, c]) => !isCellDrawn(r, c))
      .map(([r, c]) => grid[r][c]);
    const isValidOfficial = missingOfficial.length === 0;
    const isMarkedByPlayer = corners.every(([r, c]) => isCellMarked(r, c));

    return {
      isValidOfficial,
      isMarkedByPlayer,
      patternName: "4 Esquinas Completas",
      winningCells: isValidOfficial ? corners : [],
      missingOfficialNumbers: missingOfficial,
    };
  }

  // 3-B. MODO DOBLE JUEGO: LÍNEA + PUNTA
  if (stage === "LINEA_Y_PUNTA") {
    // Validar línea
    let winningLineCells: [number, number][] | null = null;
    let winningLineName = "";
    for (const line of candidateLines) {
      if (line.cells.every(([r, c]) => isCellDrawn(r, c))) {
        winningLineCells = line.cells;
        winningLineName = line.name;
        break;
      }
    }

    // Validar punta
    const corners: { name: string; coord: [number, number] }[] = [
      { name: "Punta Sup B", coord: [0, 0] },
      { name: "Punta Sup O", coord: [0, 4] },
      { name: "Punta Inf B", coord: [4, 0] },
      { name: "Punta Inf O", coord: [4, 4] },
    ];
    const hitCorners = corners.filter(({ coord: [r, c] }) => isCellDrawn(r, c));

    if (winningLineCells && hitCorners.length > 0) {
      const combinedWinningCells: [number, number][] = [
        ...winningLineCells,
        ...hitCorners.map((h) => h.coord),
      ];
      // Remover duplicados en caso de que la línea comparta la punta
      const uniqueWinningCells = combinedWinningCells.filter(
        (cell, idx, arr) =>
          arr.findIndex(([r, c]) => r === cell[0] && c === cell[1]) === idx
      );
      const isMarked = uniqueWinningCells.every(([r, c]) => isCellMarked(r, c));
      return {
        isValidOfficial: true,
        isMarkedByPlayer: isMarked,
        patternName: `${winningLineName} + ${hitCorners[0].name}`,
        winningCells: uniqueWinningCells,
        missingOfficialNumbers: [],
      };
    }

    return {
      isValidOfficial: false,
      isMarkedByPlayer: false,
      patternName: "Línea + Punta",
      winningCells: [],
      missingOfficialNumbers: [
        ...(winningLineCells ? [] : [grid[0][0]]),
        ...(hitCorners.length > 0 ? [] : [grid[4][4]]),
      ],
    };
  }

  // 3-C. MODO DOBLE JUEGO: LÍNEA + 4 ESQUINAS
  if (stage === "LINEA_Y_ESQUINAS") {
    let winningLineCells: [number, number][] | null = null;
    let winningLineName = "";
    for (const line of candidateLines) {
      if (line.cells.every(([r, c]) => isCellDrawn(r, c))) {
        winningLineCells = line.cells;
        winningLineName = line.name;
        break;
      }
    }

    const corners: [number, number][] = [
      [0, 0],
      [0, 4],
      [4, 0],
      [4, 4],
    ];
    const missingCorners = corners
      .filter(([r, c]) => !isCellDrawn(r, c))
      .map(([r, c]) => grid[r][c]);

    if (winningLineCells && missingCorners.length === 0) {
      const combined = [...winningLineCells, ...corners];
      const uniqueWinningCells = combined.filter(
        (cell, idx, arr) =>
          arr.findIndex(([r, c]) => r === cell[0] && c === cell[1]) === idx
      );
      const isMarked = uniqueWinningCells.every(([r, c]) => isCellMarked(r, c));
      return {
        isValidOfficial: true,
        isMarkedByPlayer: isMarked,
        patternName: `${winningLineName} + 4 Esquinas`,
        winningCells: uniqueWinningCells,
        missingOfficialNumbers: [],
      };
    }

    return {
      isValidOfficial: false,
      isMarkedByPlayer: false,
      patternName: "Línea + 4 Esquinas",
      winningCells: [],
      missingOfficialNumbers: missingCorners.length > 0 ? missingCorners : [grid[2][0]],
    };
  }

  // 3-D. MODO DOBLE JUEGO: PUNTA + 4 ESQUINAS
  if (stage === "PUNTA_Y_ESQUINAS") {
    const corners: [number, number][] = [
      [0, 0],
      [0, 4],
      [4, 0],
      [4, 4],
    ];
    const missingOfficial = corners
      .filter(([r, c]) => !isCellDrawn(r, c))
      .map(([r, c]) => grid[r][c]);
    const isValidOfficial = missingOfficial.length === 0;
    const isMarkedByPlayer = corners.every(([r, c]) => isCellMarked(r, c));

    return {
      isValidOfficial,
      isMarkedByPlayer,
      patternName: "Punta + 4 Esquinas Completas",
      winningCells: isValidOfficial ? corners : [],
      missingOfficialNumbers: missingOfficial,
    };
  }

  // 4. MODO BINGO LOCO (5 números cualesquiera de la tabla que ya hayan salido)
  if (stage === "BINGO_LOCO") {
    const drawnCellsInTable: [number, number][] = [];
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        if (grid[r][c] > 0 && isCellDrawn(r, c)) {
          drawnCellsInTable.push([r, c]);
        }
      }
    }
    const isValidOfficial = drawnCellsInTable.length >= 5;
    const markedDrawnCells = drawnCellsInTable.filter(([r, c]) =>
      isCellMarked(r, c)
    );
    return {
      isValidOfficial,
      isMarkedByPlayer: markedDrawnCells.length >= 5,
      patternName: `Bingo Loco (${drawnCellsInTable.length}/5 aciertos)`,
      winningCells: isValidOfficial ? drawnCellsInTable.slice(0, 5) : [],
      missingOfficialNumbers: [],
    };
  }

  // 5. MODO LETRA o TABLA LLENA: Todos los números impresos en esa tabla
  const requiredCells: [number, number][] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (grid[r][c] > 0) {
        requiredCells.push([r, c]);
      }
    }
  }

  const letterTitle = TABLE_LETTERS[tableIndex]?.title || `Tabla #${tableIndex}`;
  const patternLabel =
    tableIndex === 6 || stage === "LLENA"
      ? `Tabla #${tableIndex} Completa`
      : `${letterTitle} Completa (Tabla #${tableIndex})`;

  const missingOfficial = requiredCells
    .filter(([r, c]) => !isCellDrawn(r, c))
    .map(([r, c]) => grid[r][c]);

  const isValidOfficial = missingOfficial.length === 0;
  const isMarkedByPlayer = requiredCells.every(([r, c]) => isCellMarked(r, c));

  return {
    isValidOfficial,
    isMarkedByPlayer,
    patternName: patternLabel,
    winningCells: isValidOfficial ? requiredCells : [],
    missingOfficialNumbers: missingOfficial,
  };
}

export function getBallLetter(num: number): "B" | "I" | "N" | "G" | "O" {
  if (num <= 15) return "B";
  if (num <= 30) return "I";
  if (num <= 45) return "N";
  if (num <= 60) return "G";
  return "O";
}

export function formatBall(num: number): string {
  return `${getBallLetter(num)}-${num}`;
}

export type SaasPlanId =
  | "DEMO_GRATIS"
  | "PAQUETE_100"
  | "PAQUETE_300"
  | "PAQUETE_1000"
  | "SUSCRIPCION_MENSUAL";

export interface SaasPlanDefinition {
  id: SaasPlanId;
  name: string;
  priceUsd: number;
  billingPeriod: string;
  maxCardsPerEvent: number;
  maxEvents: number;
  allowSellers: boolean;
  badgeColor: string;
  description: string;
  features: string[];
}

export const SAAS_PLANS: Record<SaasPlanId, SaasPlanDefinition> = {
  DEMO_GRATIS: {
    id: "DEMO_GRATIS",
    name: "Demo Gratis (15 Hojas)",
    priceUsd: 0,
    billingPeriod: "Prueba 1 Solo Bingo",
    maxCardsPerEvent: 15,
    maxEvents: 1,
    allowSellers: false,
    badgeColor: "bg-slate-700 text-slate-200",
    description: "Ideal para probar el bolillero con voz, el lector QR y ver cómo juegan en el celular.",
    features: [
      "1 solo Bingo de prueba",
      "Hasta 15 hojas numeradas (90 juegos en total)",
      "Bolillero con voz en español y verificación automática",
      "Impresión PDF en 1 hoja A4 con QR y vista móvil",
    ],
  },
  PAQUETE_100: {
    id: "PAQUETE_100",
    name: "Paquete 100 Hojas",
    priceUsd: 15,
    billingPeriod: "1 Solo Bingo (1 Evento)",
    maxCardsPerEvent: 100,
    maxEvents: 1,
    allowSellers: true,
    badgeColor: "bg-sky-500 text-slate-950",
    description: "Perfecto para bingos familiares, escolares, de grado o pro-fondos barriales.",
    features: [
      "1 solo Evento (1 Bingo completo)",
      "100 hojas numeradas (#00001 a #00100)",
      "Vendedores con enlaces directos de WhatsApp",
      "Link de elección rápida para que el cliente escoja sus números",
    ],
  },
  PAQUETE_300: {
    id: "PAQUETE_300",
    name: "Paquete 200 a 300 Hojas",
    priceUsd: 25,
    billingPeriod: "1 Solo Bingo (1 Evento)",
    maxCardsPerEvent: 300,
    maxEvents: 1,
    allowSellers: true,
    badgeColor: "bg-amber-400 text-slate-950",
    description: "Para bingos medianos de clubes, fundaciones y colegios con varios vendedores.",
    features: [
      "1 solo Evento (1 Bingo completo)",
      "Hasta 300 hojas numeradas (#00001 a #00300)",
      "Reparto de lotes por rangos a vendedores (trazabilidad)",
      "Cuadre de caja automático y liquidación de comisiones",
    ],
  },
  PAQUETE_1000: {
    id: "PAQUETE_1000",
    name: "Paquete 500 a 1,000 Hojas",
    priceUsd: 40,
    billingPeriod: "1 Solo Bingo (1 Evento)",
    maxCardsPerEvent: 1000,
    maxEvents: 1,
    allowSellers: true,
    badgeColor: "bg-purple-400 text-slate-950",
    description: "Para bingos masivos parroquiales, solidarios cantonales o de alta concurrencia.",
    features: [
      "1 solo Evento (1 Bingo masivo)",
      "Hasta 1,000 hojas numeradas (#00001 a #01000)",
      "Vendedores y cajeros ilimitados con link propio",
      "Candado de IP por comprador y desempate al número mayor",
    ],
  },
  SUSCRIPCION_MENSUAL: {
    id: "SUSCRIPCION_MENSUAL",
    name: "Binguero Frecuente (Mensual)",
    priceUsd: 49,
    billingPeriod: "Por Mes (Bingos Ilimitados)",
    maxCardsPerEvent: 1000,
    maxEvents: 999,
    allowSellers: true,
    badgeColor: "bg-emerald-400 text-slate-950",
    description: "Para bingueros profesionales que transmiten todas las semanas en TikTok y Facebook Live.",
    features: [
      "Bingos ilimitados durante todo el mes",
      "Hasta 1,000 hojas por cada bingo transmitido",
      "Red de vendedores con links propios y trazabilidad",
      "Soporte prioritario y panel multi-bingo continuo",
    ],
  },
};

export function parsePriceUsd(priceText: string): number {
  const cleaned = (priceText || "").replace(/[^0-9.,]/g, "").replace(",", ".");
  const val = parseFloat(cleaned);
  return isNaN(val) || val < 0 ? 2.0 : val;
}

