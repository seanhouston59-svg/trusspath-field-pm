import { test } from "node:test";
import assert from "node:assert/strict";
import { toDateKey, computeDayTotals, groupEntriesByDay } from "./timesheet-week";

function weekDates(weekStart: string): Date[] {
  const [y, m, d] = weekStart.split("-").map(Number);
  return Array.from({ length: 7 }, (_, i) => new Date(y, m - 1, d + i));
}

test("toDateKey uses the local calendar date, not UTC", () => {
  assert.equal(toDateKey(new Date(2026, 6, 26)), "2026-07-26");
  assert.equal(toDateKey(new Date(2026, 6, 26, 23, 59)), "2026-07-26");
  assert.equal(toDateKey(new Date(2026, 6, 26, 0, 0)), "2026-07-26");
});

test("a 5h Sunday entry lands on the Sunday card only", () => {
  const totals = computeDayTotals(
    groupEntriesByDay([{ entryDate: "2026-07-26", hoursWorked: "5" }], weekDates("2026-07-26")),
  );
  assert.deepEqual(totals, ["5.00", "0.00", "0.00", "0.00", "0.00", "0.00", "0.00"]);
});

test("Saturday at the far end of the week is not shifted", () => {
  const totals = computeDayTotals(
    groupEntriesByDay(
      [
        { entryDate: "2026-08-01", hoursWorked: "3.5" },
        { entryDate: "2026-07-26", hoursWorked: "5" },
      ],
      weekDates("2026-07-26"),
    ),
  );
  assert.deepEqual(totals, ["5.00", "0.00", "0.00", "0.00", "0.00", "0.00", "3.50"]);
});

test("multiple entries on one day are summed", () => {
  const totals = computeDayTotals(
    groupEntriesByDay(
      [
        { entryDate: "2026-07-29", hoursWorked: "4" },
        { entryDate: "2026-07-29", hoursWorked: "2.25" },
        { entryDate: "2026-07-29", hoursWorked: "" },
      ],
      weekDates("2026-07-26"),
    ),
  );
  assert.equal(totals[3], "6.25");
});

test("an entry outside the week falls on its own weekday, not Monday", () => {
  const groups = groupEntriesByDay(
    [{ entryDate: "2026-07-18", hoursWorked: "8" }], // a Saturday
    weekDates("2026-07-26"),
  );
  assert.equal(groups[6].length, 1);
  assert.equal(groups[1].length, 0);
});
