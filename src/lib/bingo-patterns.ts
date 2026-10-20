export type StageType =
  | "LINEA"
  | "PUNTA"
  | "ESQUINAS"
  | "BINGO_LOCO"
  | "LETRA"
  | "LLENA";

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

  // 1. MODO LÍNEA
  if (stage === "LINEA") {
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
  | "PLAN_BASICO"
  | "PLAN_PRO"
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
    name: "Demo Gratis",
    priceUsd: 0,
    billingPeriod: "Prueba gratuita",
    maxCardsPerEvent: 10,
    maxEvents: 1,
    allowSellers: false,
    badgeColor: "bg-slate-700 text-slate-200",
    description: "Ideal para probar el sistema en vivo antes de tu evento.",
    features: [
      "Hasta 10 tablas generadas (60 juegos)",
      "1 evento activo",
      "Bolillero con voz en español y verificador automático",
      "Impresión PDF en 1 hoja A4 con QR",
    ],
  },
  PLAN_BASICO: {
    id: "PLAN_BASICO",
    name: "Plan Básico",
    priceUsd: 15,
    billingPeriod: "Pago por Evento",
    maxCardsPerEvent: 200,
    maxEvents: 3,
    allowSellers: true,
    badgeColor: "bg-sky-500 text-slate-950",
    description: "Perfecto para bingos familiares, escolares y barriales.",
    features: [
      "Hasta 200 tablas por evento (1,200 juegos)",
      "Hasta 3 eventos simultáneos",
      "Links de Vendedores / Comisionistas + Cuadre de Caja",
      "Candado de IP y Desempate Al Número Mayor",
    ],
  },
  PLAN_PRO: {
    id: "PLAN_PRO",
    name: "Plan Pro",
    priceUsd: 35,
    billingPeriod: "Pago por Evento",
    maxCardsPerEvent: 1000,
    maxEvents: 10,
    allowSellers: true,
    badgeColor: "bg-amber-400 text-slate-950",
    description: "Para bingos grandes parroquiales, solidarios y pro-fondos.",
    features: [
      "Hasta 1,000 tablas por evento (6,000 juegos)",
      "Vendedores / Cajeros ilimitados con comisión",
      "Personalización total del cartón y premios por etapa",
      "Modo Tablero Doblado para clientes con múltiples tablas",
    ],
  },
  SUSCRIPCION_MENSUAL: {
    id: "SUSCRIPCION_MENSUAL",
    name: "Plan Mensual Ilimitado",
    priceUsd: 49,
    billingPeriod: "Por Mes (TikTok / FB Live)",
    maxCardsPerEvent: 10000,
    maxEvents: 100,
    allowSellers: true,
    badgeColor: "bg-emerald-400 text-slate-950",
    description: "Para bingueros profesionales que transmiten todas las semanas.",
    features: [
      "Eventos ilimitados durante todo el mes",
      "Hasta 10,000 tablas por evento con motor anti-duplicados",
      "Red de vendedores con links propios de WhatsApp",
      "Soporte prioritario y panel multi-evento",
    ],
  },
};

export function parsePriceUsd(priceText: string): number {
  const cleaned = (priceText || "").replace(/[^0-9.,]/g, "").replace(",", ".");
  const val = parseFloat(cleaned);
  return isNaN(val) || val < 0 ? 2.0 : val;
}

