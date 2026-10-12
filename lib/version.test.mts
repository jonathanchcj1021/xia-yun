import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shortVersion } from "./version.ts";

describe("shortVersion", () => {
  it("keeps the first 7 hex chars of a deploy sha", () => {
    assert.equal(shortVersion("0dabb15b634fda06ec8132f4181569d70ae492e7"), "0dabb15");
    assert.equal(shortVersion("ABCDEF1"), "abcdef1");
  });

  it("uses dev when CI did not pass a sha", () => {
    assert.equal(shortVersion(undefined), "dev");
    assert.equal(shortVersion(""), "dev");
    assert.equal(shortVersion("dev"), "dev");
    assert.equal(shortVersion("0dabb1"), "dev");
    assert.equal(shortVersion("0dabb15b634fda06ec8132f4181569d70ae492e7aa"), "dev");
  });
});
