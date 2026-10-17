export type Parcel = {
  lengthIn: number;
  widthIn: number;
  heightIn: number;
  weightOz: number;
  productGrams: number;
  packagingGrams: number;
  distanceUnit: "in";
  massUnit: "oz";
};

export type ParcelRules = {
  mailer: { lengthIn: number; widthIn: number; heightIn: number; packagingGrams: number };
  box: { lengthIn: number; widthIn: number; heightIn: number; packagingGrams: number };
  boxIfUnitsAtLeast: number;
  boxIfProductGramsAtLeast: number;
};

export const DEFAULT_PARCEL_RULES: ParcelRules = {
  mailer: { lengthIn: 8, widthIn: 6, heightIn: 2, packagingGrams: 35 },
  box: { lengthIn: 10, widthIn: 8, heightIn: 4, packagingGrams: 80 },
  boxIfUnitsAtLeast: 9,
  boxIfProductGramsAtLeast: 400,
};

function positiveNumber(value: string | undefined, fallback: number) {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 && parsed <= 48 ? parsed : fallback;
}

export function parcelRulesFromEnv(env: Record<string, string | undefined>): ParcelRules {
  return {
    mailer: {
      lengthIn: positiveNumber(env.KAPO_PARCEL_LENGTH_IN, DEFAULT_PARCEL_RULES.mailer.lengthIn),
      widthIn: positiveNumber(env.KAPO_PARCEL_WIDTH_IN, DEFAULT_PARCEL_RULES.mailer.widthIn),
      heightIn: positiveNumber(env.KAPO_PARCEL_HEIGHT_IN, DEFAULT_PARCEL_RULES.mailer.heightIn),
      packagingGrams: positiveNumber(env.KAPO_PACKAGING_WEIGHT_GRAMS, DEFAULT_PARCEL_RULES.mailer.packagingGrams),
    },
    box: DEFAULT_PARCEL_RULES.box,
    boxIfUnitsAtLeast: DEFAULT_PARCEL_RULES.boxIfUnitsAtLeast,
    boxIfProductGramsAtLeast: DEFAULT_PARCEL_RULES.boxIfProductGramsAtLeast,
  };
}

export function buildParcel(lines: { weightGrams: number; quantity: number }[], rules = DEFAULT_PARCEL_RULES): Parcel {
  const units = lines.reduce((total, line) => total + line.quantity, 0);
  const productGrams = lines.reduce((total, line) => total + line.weightGrams * line.quantity, 0);
  const useBox = units >= rules.boxIfUnitsAtLeast || productGrams >= rules.boxIfProductGramsAtLeast;
  const pack = useBox ? rules.box : rules.mailer;
  const packagingGrams = pack.packagingGrams;
  const weightOz = Math.max(1, Math.ceil(((productGrams + packagingGrams) / 28.3495) * 10) / 10);
  return {
    lengthIn: pack.lengthIn,
    widthIn: pack.widthIn,
    heightIn: pack.heightIn,
    weightOz,
    productGrams,
    packagingGrams,
    distanceUnit: "in",
    massUnit: "oz",
  };
}

export function validateParcelOverride(input: { lengthIn?: number; widthIn?: number; heightIn?: number; weightOz?: number }) {
  const lengthIn = Number(input.lengthIn);
  const widthIn = Number(input.widthIn);
  const heightIn = Number(input.heightIn);
  const weightOz = Number(input.weightOz);
  const dimensionOk = [lengthIn, widthIn, heightIn].every((value) => Number.isFinite(value) && value >= 0.5 && value <= 36);
  const weightOk = Number.isFinite(weightOz) && weightOz >= 0.1 && weightOz <= 1120;
  if (!dimensionOk || !weightOk) {
    return { ok: false as const, message: "Package dimensions must be 0.5–36 inches and weight must be 0.1–1120 ounces." };
  }
  return {
    ok: true as const,
    parcel: {
      lengthIn,
      widthIn,
      heightIn,
      weightOz: Math.round(weightOz * 10) / 10,
      productGrams: 0,
      packagingGrams: 0,
      distanceUnit: "in" as const,
      massUnit: "oz" as const,
    },
  };
}
