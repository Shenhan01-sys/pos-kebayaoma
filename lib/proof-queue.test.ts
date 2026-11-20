import { describe, expect, it } from "vitest";
import { parseProofQueue, PROOF_TTL_MS } from "./proof-queue";

const now = 1_800_000_000_000;

describe("parseProofQueue", () => {
  it("kosong / rusak → []", () => {
    expect(parseProofQueue(null, now)).toEqual([]);
    expect(parseProofQueue("{", now)).toEqual([]);
    expect(parseProofQueue('{"a":1}', now)).toEqual([]);
  });
  it("entri valid dipertahankan, basi & cacat dibuang", () => {
    const list = [
      { txId: "a", photo: "data:x", at: now - 1000 },
      { txId: "b", photo: "data:y", at: now - PROOF_TTL_MS - 1 },
      { txId: 3, photo: "data:z", at: now },
    ];
    expect(parseProofQueue(JSON.stringify(list), now)).toEqual([list[0]]);
  });
});
