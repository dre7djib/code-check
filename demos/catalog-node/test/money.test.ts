import assert from "node:assert/strict";
import { test } from "node:test";
import { Money } from "../src/domain/Money";

test("additionne la même devise", () => {
  const total = new Money(100, "EUR").plus(new Money(50, "EUR"));
  assert.equal(total.cents, 150);
});
