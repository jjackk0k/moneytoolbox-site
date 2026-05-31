// True Hourly Wage — pure core + live DOM/bars wiring.
// Core `trueWage()` is dependency-free and unit-tested in scripts/test-true-hourly-wage.mjs.

(function (root) {
  "use strict";

  function trueWage(opts) {
    var gross = +opts.grossAnnual || 0;
    var contracted = +opts.contractedHoursPerWeek || 0;
    var extra = +opts.extraUnpaidHoursPerWeek || 0;
    var commuteMin = +opts.commuteMinutesPerDay || 0;
    var commuteDays = +opts.commuteDaysPerWeek || 0;
    var weeks = +opts.weeksWorkedPerYear || 0;
    var costs = +opts.annualWorkCosts || 0;

    var commuteHrsPerWeek = (commuteMin * commuteDays) / 60;
    var realHoursPerWeek = contracted + extra + commuteHrsPerWeek;
    var realHoursPerYear = realHoursPerWeek * weeks;
    var naiveHoursPerYear = contracted * weeks;
    var netForWage = gross - costs;
    var naiveHourly = naiveHoursPerYear > 0 ? gross / naiveHoursPerYear : 0;
    var trueHourly = realHoursPerYear > 0 ? netForWage / realHoursPerYear : 0;
    var gapPct = naiveHourly > 0 ? (1 - trueHourly / naiveHourly) * 100 : 0;

    return { naiveHourly: naiveHourly, trueHourly: trueHourly, realHoursPerYear: realHoursPerYear,
             naiveHoursPerYear: naiveHoursPerYear, netForWage: netForWage, gapPct: gapPct };
  }

  root.TrueWage = { trueWage: trueWage };

  if (typeof document === "undefined") return; // Node tests

  var $ = function (id) { return document.getElementById(id); };
  var money2 = function (v) { return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  var intc = function (v) { return Math.round(v).toLocaleString("en-US"); };
  var first = true;

  function read() {
    return { grossAnnual: +$("gross").value || 0, contractedHoursPerWeek: +$("hours").value || 0,
             extraUnpaidHoursPerWeek: +$("extra").value || 0, commuteMinutesPerDay: +$("commuteMin").value || 0,
             commuteDaysPerWeek: +$("commuteDays").value || 0, weeksWorkedPerYear: +$("weeks").value || 0,
             annualWorkCosts: +$("costs").value || 0 };
  }
  function setNum(node, v, fmt) { if (first && root.MTUI) root.MTUI.countUp(node, v, fmt); else node.textContent = fmt(v); }

  function render() {
    var r = trueWage(read());
    $("results").hidden = false;
    setNum($("sTrue"), r.trueHourly, money2);
    setNum($("sPaper"), r.naiveHourly, money2);
    setNum($("sHours"), r.realHoursPerYear, function (v) { return intc(v) + " hrs"; });
    setNum($("sGap"), r.gapPct, function (v) { return Math.round(v) + "% less"; });

    $("summary").innerHTML = '<p class="muted">Your real take-home rate is</p>' +
      '<p class="result-big">' + money2(r.trueHourly) + '<span class="muted" style="font-size:16px"> /hour</span></p>' +
      '<p class="muted">It looks like ' + money2(r.naiveHourly) + '/hour on paper — but counting ' +
      intc(r.realHoursPerYear - r.naiveHoursPerYear) + ' extra unpaid hours a year plus work costs, you keep <strong>' +
      Math.round(r.gapPct) + '% less</strong>.</p>';

    if (root.MTUI) root.MTUI.bars($("bars"), [
      { label: "On paper (salary ÷ contracted hours)", value: r.naiveHourly, color: "#c9bfa8", display: money2(r.naiveHourly) + "/hr" },
      { label: "Real (after hidden hours + costs)", value: r.trueHourly, color: "#c9a24a", display: money2(r.trueHourly) + "/hr" }
    ]);

    if (first) { requestAnimationFrame(function () { $("results").classList.add("in"); }); first = false; }
  }

  ["gross", "hours", "extra", "commuteMin", "commuteDays", "weeks", "costs"].forEach(function (id) { $(id).addEventListener("input", render); });
  var pr = $("print"); if (pr) pr.addEventListener("click", function () { window.print(); });
  if (root.MTUI) {
    var restore = root.MTUI.bindShare({ gross: 1, hours: 1, extra: 1, commuteMin: 1, commuteDays: 1, weeks: 1, costs: 1 }, $("share"));
    restore();
  }
  render();
})(typeof window !== "undefined" ? window : globalThis);
