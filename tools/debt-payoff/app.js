// Debt Payoff Planner — pure simulation core + chart/animation DOM wiring.
// Core `simulate()` is dependency-free and unit-tested in scripts/test-debt-payoff.mjs.

(function (root) {
  "use strict";

  // Simulate paying down `debts` with `budget`/month under a strategy.
  // Returns { months, totalInterest, feasible, balances:[total at each month, index 0 = start] }.
  function simulate(debts, budget, strategy) {
    var bal = debts.map(function (d) { return { balance: +d.balance, apr: +d.apr, min: +d.min }; });
    var totalInterest = 0, month = 0;
    var MAX = 1200;
    var total = function () { return bal.reduce(function (s, d) { return s + Math.max(0, d.balance); }, 0); };
    var balances = [total()];
    var left = function () { return bal.filter(function (d) { return d.balance > 0.005; }); };

    while (left().length && month < MAX) {
      month++;
      for (var a = 0; a < bal.length; a++) if (bal[a].balance > 0) { var it = bal[a].balance * (bal[a].apr / 100 / 12); bal[a].balance += it; totalInterest += it; }
      var active = left().sort(strategy === "avalanche"
        ? function (x, y) { return y.apr - x.apr; }
        : function (x, y) { return x.balance - y.balance; });
      var pay = budget;
      for (var i = 0; i < active.length; i++) { var m = Math.min(active[i].min, active[i].balance, Math.max(0, pay)); active[i].balance -= m; pay -= m; }
      for (var j = 0; j < active.length; j++) { if (pay <= 0) break; var ex = Math.min(pay, active[j].balance); active[j].balance -= ex; pay -= ex; }
      balances.push(total());
    }
    return { months: month, totalInterest: totalInterest, feasible: month < MAX, balances: balances };
  }

  function minMonthly(debts) { return debts.reduce(function (s, d) { return s + (+d.min || 0); }, 0); }

  root.DebtPayoff = { simulate: simulate, minMonthly: minMonthly };

  if (typeof document === "undefined") return; // Node tests

  var $ = function (id) { return document.getElementById(id); };
  var debtsEl = $("debts");
  var money = function (n) { return "$" + Math.round(n).toLocaleString("en-US"); };
  var moneyShort = function (v) { if (v >= 1e6) return "$" + (v / 1e6).toFixed(1) + "M"; if (v >= 1e3) return "$" + Math.round(v / 1000) + "k"; return "$" + Math.round(v); };
  var months2str = function (m) { var y = Math.floor(m / 12), mo = m % 12; return (y ? y + " yr " : "") + (mo || !y ? mo + " mo" : "").trim(); };
  var first = true;

  function rowHtml(d) {
    return '<div class="debt-row">' +
      '<div><input class="d-name" placeholder="Card / loan" value="' + (d.name || "") + '"></div>' +
      '<div><input class="d-bal" type="number" min="0" step="50" value="' + (d.balance || "") + '" inputmode="decimal"></div>' +
      '<div><input class="d-apr" type="number" min="0" step="0.1" value="' + (d.apr || "") + '" inputmode="decimal"></div>' +
      '<div><input class="d-min" type="number" min="0" step="5" value="' + (d.min || "") + '" inputmode="decimal"></div>' +
      '<div><button class="btn-ghost d-del" type="button" title="Remove">✕</button></div></div>';
  }
  function addRow(d) {
    var wrap = document.createElement("div"); wrap.innerHTML = rowHtml(d || {});
    var node = wrap.firstChild;
    node.querySelector(".d-del").addEventListener("click", function () { node.remove(); });
    debtsEl.appendChild(node);
    if (root.MTUI && root.MTUI.steppers) root.MTUI.steppers(node);
  }
  function readDebts() {
    return Array.prototype.slice.call(debtsEl.querySelectorAll(".debt-row")).map(function (r) {
      return { name: r.querySelector(".d-name").value || "Debt", balance: +r.querySelector(".d-bal").value || 0,
               apr: +r.querySelector(".d-apr").value || 0, min: +r.querySelector(".d-min").value || 0 };
    }).filter(function (d) { return d.balance > 0; });
  }
  function setNum(node, v, fmt) { fmt = fmt || money; if (first && root.MTUI) root.MTUI.countUp(node, v, fmt); else node.textContent = fmt(v); }

  addRow({ name: "Credit card", balance: 6000, apr: 22.9, min: 150 });
  addRow({ name: "Car loan", balance: 9000, apr: 7.5, min: 220 });

  $("addDebt").addEventListener("click", function () { addRow({}); });

  function calc() {
    var debts = readDebts(), budget = +$("budget").value || 0;
    var results = $("results"), summary = $("summary");
    results.hidden = false;

    if (!debts.length) { summary.innerHTML = '<p class="muted">Add at least one debt with a balance.</p>'; $("viz").hidden = true; return; }
    var minNeeded = root.DebtPayoff.minMonthly(debts);
    if (budget < minNeeded) {
      summary.innerHTML = '<p class="result-big" style="color:var(--brass)">Budget too low</p>' +
        '<p class="muted">Your minimum payments total <strong>' + money(minNeeded) + '/mo</strong>, more than your budget of ' +
        money(budget) + '. Raise the budget to at least the minimums.</p>';
      $("viz").hidden = true; return;
    }
    $("viz").hidden = false;

    var av = simulate(debts, budget, "avalanche"), sn = simulate(debts, budget, "snowball");
    var best = av.totalInterest <= sn.totalInterest ? av : sn;
    var bestName = best === av ? "Avalanche" : "Snowball";
    var saved = Math.abs(av.totalInterest - sn.totalInterest);

    summary.innerHTML = '<p class="muted">With <strong>' + money(budget) + '/mo</strong>, the fastest, cheapest plan is <strong>' +
      bestName + '</strong> — debt-free in <strong>' + months2str(best.months) + '</strong>.</p>';

    $("sFree").textContent = months2str(best.months);
    setNum($("sAv"), av.totalInterest);
    setNum($("sSn"), sn.totalInterest);
    setNum($("sSave"), saved);

    // dual-line chart of total balance falling over months (pad shorter to same length)
    var len = Math.max(av.balances.length, sn.balances.length);
    var pad = function (arr) { var a = arr.slice(); while (a.length < len) a.push(0); return a; };
    var labels = []; for (var k = 0; k < len; k++) labels.push(String(k));
    if (root.MTUI) root.MTUI.lineChart($("chart"), {
      height: 240,
      series: [ { values: pad(av.balances), color: "#c9a24a", fill: true },
                { values: pad(sn.balances), color: "#8fb79c", fill: false } ],
      labels: labels, formatY: moneyShort
    });

    if (root.MTUI) root.MTUI.bars($("bars"), [
      { label: "Avalanche — total interest", value: av.totalInterest, color: "#c9a24a" },
      { label: "Snowball — total interest", value: sn.totalInterest, color: "#8fb79c" }
    ], money);

    $("recommend").textContent = saved < 1
      ? "Both methods cost about the same here — pick whichever keeps you motivated."
      : "Avalanche saves " + money(saved) + " in interest vs. snowball. Snowball clears individual debts sooner for quicker wins.";

    if (first) { requestAnimationFrame(function () { results.classList.add("in"); }); first = false; }
  }

  $("calc").addEventListener("click", calc);
  var pr = $("print"); if (pr) pr.addEventListener("click", function () { window.print(); });
  if (root.MTUI) root.MTUI.bindShare({ budget: 1 }, $("share"));
  calc();
})(typeof window !== "undefined" ? window : globalThis);
