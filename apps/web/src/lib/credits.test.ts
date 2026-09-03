import assert from "node:assert/strict";
import test from "node:test";
import { isCreditCodeShapeValid, normalizeCreditCode, parseCreditHistoryRequest } from "./credits";

test("credit history request accepts supported filters and positive pages", () => {
  assert.deepEqual(parseCreditHistoryRequest({ kind: "usage", page: 3 }), { kind: "usage", page: 3 });
  assert.deepEqual(parseCreditHistoryRequest({ kind: "topup", page: "2" }), { kind: "topup", page: 2 });
});

test("credit history request safely falls back for invalid input", () => {
  assert.deepEqual(parseCreditHistoryRequest({ kind: "unknown", page: -8 }), { kind: "all", page: 1 });
  assert.deepEqual(parseCreditHistoryRequest(null), { kind: "all", page: 1 });
});

test("CD-Key input is normalized for readable entry", () => {
  assert.equal(normalizeCreditCode("bam abcd efgh ijkl mnop"), "BAM-ABCD-EFGH-IJKL-MNOP");
  assert.equal(isCreditCodeShapeValid("BAM-ABCD-EFGH-IJKL-MNOP"), true);
  assert.equal(isCreditCodeShapeValid("BAM-TOO-SHORT"), false);
});
