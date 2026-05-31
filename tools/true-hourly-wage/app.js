// True Hourly Wage — pure core + DOM wiring.
// Core `trueWage()` is dependency-free and unit-tested in scripts/test-true-hourly-wage.mjs.

(function (root) {
  "use strict";

  // What you actually earn per hour once unpaid time and work-related costs are counted.
  // opts: { grossAnnual, contractedHoursPerWeek, extraUnpaidHoursPerWeek,
  //         commuteMinutesPerDay, commuteDaysPerWeek, weeksWorkedPerYear, annualWorkCosts }
  // Returns { naiveHourly, trueHourly, realHoursPerYear, naiveHoursPerYear, netForWage, gapPct }.
  function trueWage(opts) {
    const gross = +opts.grossAnnual || 0;
    const contracted = +opts.contractedHoursPerWeek || 0;
    const extra = +opts.extraUnpaidHoursPerWeek || 0;
    const commuteMin = +opts.commuteMinutesPerDay || 0;
    const commuteDays = +opts.commuteDaysPerWeek || 0;
    const weeks = +opts.weeksWorkedPerYear || 0;
    const costs = +opts.annualWorkCosts || 0;

    const commuteHrsPerWeek = (commuteMin * commuteDays) / 60;
    const realHoursPerWeek = contracted + extra + commuteHrsPerWeek;
    const realHoursPerYear = realHoursPerWeek * weeks;
    const naiveHoursPerYear = contracted * weeks;
    const netForWage = gross - costs;

    const naiveHourly = naiveHoursPerYear > 0 ? gross / naiveHoursPerYear : 0;
    const trueHourly = realHoursPerYear > 0 ? netForWage / realHoursPerYear : 0;
    const gapPct = naiveHourly > 0 ? (1 - trueHourly / naiveHourly) * 100 : 0;

    return {
      naiveHourly: naiveHourly,
      trueHourly: trueHourly,
      realHoursPerYear: realHoursPerYear,
      naiveHoursPerYear: naiveHoursPerYear,
      netForWage: netForWage,
      gapPct: gapPct
    };
  }

  root.TrueWage = { trueWage: trueWage };

  if (typeof document === "undefined") return; // running under Node tests

  const $ = function (id) { return document.getElementById(id); };
  const money = function (n) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };

  $("calc").addEventListener("click", function () {
    const opts = {
      grossAnnual: +$("gross").value || 0,
      contractedHoursPerWeek: +$("hours").value || 0,
      extraUnpaidHoursPerWeek: +$("extra").value || 0,
      commuteMinutesPerDay: +$("commuteMin").value || 0,
      commuteDaysPerWeek: +$("commuteDays").value || 0,
      weeksWorkedPerYear: +$("weeks").value || 0,
      annualWorkCosts: +$("costs").value || 0
    };
    const r = trueWage(opts);
    $("results").hidden = false;
    $("summary").innerHTML =
      '<p class="muted">Your real take-home rate is</p>' +
      '<p class="result-big win">' + money(r.trueHourly) + '<span class="muted" style="font-size:16px">/hour</span></p>' +
      '<p class="muted">On paper it looks like <strong>' + money(r.naiveHourly) + '/hour</strong> — but counting ' +
      Math.round(r.realHoursPerYear - r.naiveHoursPerYear) + ' extra unpaid hours a year and work costs, you actually keep <strong>' +
      Math.round(r.gapPct) + '% less</strong>.</p>';
    $("detail").innerHTML =
      '<tr><td>Paid (contracted) hours / year</td><td>' + Math.round(r.naiveHoursPerYear).toLocaleString() + '</td></tr>' +
      '<tr><td>Real hours / year (incl. unpaid + commute)</td><td>' + Math.round(r.realHoursPerYear).toLocaleString() + '</td></tr>' +
      '<tr><td>Pay after work-related costs</td><td>' + money(r.netForWage) + '</td></tr>';
  });
})(typeof window !== "undefined" ? window : globalThis);
