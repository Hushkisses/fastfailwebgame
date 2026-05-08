/** 서버 resolver.trapRevealKey 과 동일: `층|left|right` */
export function trapRevealKeyClient(floor: number, side: "left" | "right"): string {
  return `${floor}|${side}`;
}

function addKey(acc: Set<string>, k: unknown): void {
  if (typeof k === "string" && k.includes("|")) acc.add(k);
}

/** Colyseus ArraySchema 또는 배열형 동기 상태에서 함정 키 집합 */
export function readTrapKeys(schemaOrArray: unknown): Set<string> {
  const acc = new Set<string>();
  if (!schemaOrArray) return acc;

  const boxed = schemaOrArray as Record<string, unknown> & unknown[];
  const innerItems = boxed?.items;

  if (Array.isArray(innerItems)) {
    for (const k of innerItems) addKey(acc, k);
    return acc;
  }
  if (Array.isArray(schemaOrArray)) {
    for (const k of schemaOrArray) addKey(acc, k);
    return acc;
  }

  try {
    if (typeof boxed?.forEach === "function") {
      boxed.forEach((k: unknown) => addKey(acc, k));
    }
  } catch {
    /* ignore */
  }
  return acc;
}
