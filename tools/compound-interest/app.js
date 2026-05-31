// Compound Interest Projector — pure projection core + live DOM/chart wiring.
// Core `project()` is dependency-free and unit-tested in scripts/test-compound-interest.mjs.

(function (root) {
  "use strict";

  function project(opts) {
    var principal = +opts.principal || 0;
    var monthly = +opts.monthly || 0;
    var i = (+opts.annualRatePct || 0) / 100 / 12;
    var years = Math.max(0, Math.round(+opts.years || 0));
    var n = years * 12;
    var balance = principal, contributed = principal, byYear = [];
    for (var m = 1; m <= n; m++) {
      balance = balance * (1 + i) + monthly;
      contributed += monthly;
      if (m % 12 === 0) byYear.push({ year: m / 12, balance: balance, contributed: contributed, interest: balance - contributed });
    }
    return { futureValue: balance, totalContributed: contributed, interestEarned: balance - contributed, byYear: byYear };
  }

  root.Compound = { project: project };

  if (typeof document === "undefined") return; // Node tests

  var $ = function (id) { return document.getElementById(id); };
  var moneyFull = function (v) { return "$" + Math.round(v).toLocaleString("en-US"); };
  var moneyShort = function (v) {
    if (v >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M";
    if (v >= 1e3) return "$" + Math.round(v / 1000) + "k";
    return "$" + Math.round(v);
  };
  var first = true;

  function read() {
    return { principal: +$("principal").value || 0, monthly: +$("monthly").value || 0,
             annualRatePct: +$("rate").value || 0, years: +$("years").value || 0 };
  }

  function setNum(node, val) {
    if (first && root.MTUI) root.MTUI.countUp(node, val, moneyFull);
    else node.textContent = moneyFull(val);
  }

  function render() {
    var o = read(), r = project(o);
    setNum($("sFV"), r.futureValue);
    setNum($("sIn"), r.totalContributed);
    setNum($("sGrow"), r.interestEarned);

    // chart: prepend year 0 so the curve starts at the principal
    var years = Math.max(1, Math.round(o.years));
    var balVals = [o.principal], conVals = [o.principal], labels = ["0"];
    r.byYear.forEach(function (y) { balVals.push(y.balance); conVals.push(y.contributed); labels.push(String(y.year)); });
    if (root.MTUI) root.MTUI.lineChart($("chart"), {
      height: 240,
      series: [
        { values: balVals, color: "#c9a24a", fill: true },
        { values: conVals, color: "#c9bfa8", fill: false }
      ],
      labels: labels, formatY: moneyShort
    });

    var rows = r.byYear.filter(function (y) { return y.year <= 10 || y.year % 5 === 0 || y.year === years; });
    $("breakdown").innerHTML = rows.map(function (y) {
      return "<tr><td>" + y.year + "</td><td>" + moneyFull(y.balance) + "</td><td>" + moneyFull(y.contributed) +
        "</td><td class='win'>" + moneyFull(y.interest) + "</td></tr>";
    }).join("");

    if (first) { requestAnimationFrame(function () { $("results").classList.add("in"); }); first = false; }
  }

  // sliders <-> number inputs, live recompute
  if (root.MTUI) {
    root.MTUI.syncSlider("rateR", "rate", render);
    root.MTUI.syncSlider("yearsR", "years", render);
  }
  ["principal", "monthly", "rate", "years"].forEach(function (id) { $(id).addEventListener("input", render); });

  // share + print + restore-from-URL
  if (root.MTUI) {
    var restore = root.MTUI.bindShare({ principal: 1, monthly: 1, rate: 1, years: 1 }, $("share"));
    if (restore()) { $("rateR").value = $("rate").value; $("yearsR").value = $("years").value; }
  }
  $("print").addEventListener("click", function () { window.print(); });

  render();
})(typeof window !== "undefined" ? window : globalThis);
