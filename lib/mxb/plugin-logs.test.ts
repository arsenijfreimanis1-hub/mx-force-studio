import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { LOG_SUBDIR, readLatestSheet, safeSheetName, writeSheetCsv } from "./plugin-logs.ts";

test("safeSheetName keeps a csv basename and drops parent paths", () => {
  assert.equal(safeSheetName("../secret.csv"), "secret.csv");
  assert.equal(safeSheetName("MX Bikes/ride.csv"), "ride.csv");
  assert.ok(safeSheetName("session").endsWith(".csv"));
});

test("writeSheetCsv lands in MXB_PLUGINS_DIR/force_studio_logs", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "mxb-logs-"));
  const plugins = path.join(tmp, "plugins");
  fs.mkdirSync(plugins);
  const prev = process.env.MXB_PLUGINS_DIR;
  process.env.MXB_PLUGINS_DIR = plugins;
  try {
    const saved = writeSheetCsv("time_s,speed_kph\n0,1\n", "ride.csv");
    assert.equal(saved.kind, "game");
    assert.equal(path.basename(path.dirname(saved.file)), LOG_SUBDIR);
    assert.equal(path.basename(saved.file), "ride.csv");
    assert.equal(fs.readFileSync(saved.file, "utf8"), "time_s,speed_kph\n0,1\n");
    writeSheetCsv("time_s,speed_kph\n1,2\n", "newer.csv");
    const latest = readLatestSheet();
    assert.ok(latest);
    assert.equal(latest?.name, "newer.csv");
    assert.match(latest?.csv ?? "", /1,2/);
  } finally {
    if (prev == null) delete process.env.MXB_PLUGINS_DIR;
    else process.env.MXB_PLUGINS_DIR = prev;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
