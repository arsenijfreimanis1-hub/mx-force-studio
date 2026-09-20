import assert from "node:assert/strict";
import { test } from "node:test";
import { setupLabel } from "./inputs.ts";

test("setupLabel strips a Windows Documents path", () => {
  assert.equal(
    setupLabel("C:\\Users\\sam\\Documents\\PiBoSo\\MX Bikes\\setups\\CRF450R\\stock.ssx"),
    "stock.ssx",
  );
});

test("setupLabel keeps a bare file and ignores blanks", () => {
  assert.equal(setupLabel("race.ssx"), "race.ssx");
  assert.equal(setupLabel("  "), "");
  assert.equal(setupLabel(undefined), "");
});
