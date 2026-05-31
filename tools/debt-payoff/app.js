// Debt Payoff Planner — pure simulation core + DOM wiring.
// The core `simulate()` is dependency-free and unit-tested in scripts/test-debt-payoff.mjs.

(function (root) {
  "use strict";

  // Simulate paying down `debts` with `budget`/month under a strategy.
  // strategy: "avalanche" (highest APR first) | "snowball" (smallest balance first)
  // Returns { months, totalInterest, feasible }.
  function simulate(debts, budget, strategy) {
    const bal = debts.map(function (d) {
      return { balance: +d.balance, apr: +d.apr, min: +d.min };
    });
    let totalInterest = 0, month = 0;
    const MAX = 1200; // 100-year cap → flags an impossible plan
    const left = function () { return bal.filter(function (d) { return d.balance > 0.005; }); };

    while (left().length && month < MAX) {
      month++;
      // 1. accrue one month of interest
      for (const d of bal) {
        if (d.balance > 0) {
          const i = d.balance * (d.apr / 100 / 12);
          d.balance += i; totalInterest += i;
        }
      }
      // 2. order active debts by strategy
      const active = left().sort(strategy === "avalanche"
        ? function (a, b) { return b.apr - a.apr; }
        : function (a, b) { return a.balance - b.balance; });
      // 3. pay minimums (capped at balance and remaining budget)
      let pay = budget;
      for (const d of active) {
        const m = Math.min(d.min, d.balance, Math.max(0, pay));
        d.balance -= m; pay -= m;
      }
      // 4. throw whatever's left at the priority debt(s)
      for (const d of active) {
        if (pay <= 0) break;
        const extra = Math.min(pay, d.balance);
        d.balance -= extra; pay -= extra;
      }
    }
    return { months: month, totalInterest: totalInterest, feasible: month < MAX };
  }

  function minMonthly(debts) {
    return debts.reduce(function (s, d) { return s + (+d.min || 0); }, 0);
  }

  root.DebtPayoff = { simulate: simulate, minMonthly: minMonthly };

  // ---- DOM wiring (skipped when loaded in Node for tests) ----
  if (typeof document === "undefined") return;

  const debtsEl = document.getElementById("debts");
  const fmt = function (n) {
    return "$" + Math.round(n).toLocaleString("en-US");
  };
  const months2str = function (m) {
    const y = Math.floor(m / 12), mo = m % 12;
    return (y ? y + " yr " : "") + (mo || !y ? mo + " mo" : "").trim();
  };

  function rowHtml(d) {
    return '<div class="debt-row">' +
      '<div><input class="d-name" placeholder="Card / loan" value="' + (d.name || "") + '"></div>' +
      '<div><input class="d-bal" type="number" min="0" step="50" value="' + (d.balance || "") + '" inputmode="decimal"></div>' +
      '<div><input class="d-apr" type="number" min="0" step="0.1" value="' + (d.apr || "") + '" inputmode="decimal"></div>' +
      '<div><input class="d-min" type="number" min="0" step="5" value="' + (d.min || "") + '" inputmode="decimal"></div>' +
      '<div><button class="btn-ghost d-del" type="button" title="Remove">✕</button></div>' +
      '</div>';
  }

  function addRow(d) {
    const wrap = document.createElement("div");
    wrap.innerHTML = rowHtml(d || {});
    const node = wrap.firstChild;
    node.querySelector(".d-del").addEventListener("click", function () { node.remove(); });
    debtsEl.appendChild(node);
  }

  function readDebts() {
    return Array.from(debtsEl.querySelectorAll(".debt-row")).map(function (r) {
      return {
        name: r.querySelector(".d-name").value || "Debt",
        balance: +r.querySelector(".d-bal").value || 0,
        apr: +r.querySelector(".d-apr").value || 0,
        min: +r.querySelector(".d-min").value || 0
      };
    }).filter(function (d) { return d.balance > 0; });
  }

  // seed with two realistic example debts
  addRow({ name: "Credit card", balance: 6000, apr: 22.9, min: 150 });
  addRow({ name: "Car loan", balance: 9000, apr: 7.5, min: 220 });

  document.getElementById("addDebt").addEventListener("click", function () { addRow({}); });

  document.getElementById("calc").addEventListener("click", function () {
    const debts = readDebts();
    const budget = +document.getElementById("budget").value || 0;
    const results = document.getElementById("results");
    const summary = document.getElementById("summary");

    if (!debts.length) { results.hidden = false; summary.innerHTML = '<p class="muted">Add at least one debt with a balance.</p>'; return; }

    const minNeeded = root.DebtPayoff.minMonthly(debts);
    if (budget < minNeeded) {
      results.hidden = false;
      summary.innerHTML = '<p class="result-big" style="color:var(--warn)">Budget too low</p>' +
        '<p class="muted">Your minimum payments add up to <strong>' + fmt(minNeeded) +
        '/mo</strong>, more than your budget of ' + fmt(budget) + '. Increase the budget to at least the minimums.</p>';
      document.getElementById("compare").innerHTML = "";
      document.getElementById("recommend").textContent = "";
      return;
    }

    const av = simulate(debts, budget, "avalanche");
    const sn = simulate(debts, budget, "snowball");
    results.hidden = false;

    const best = av.totalInterest <= sn.totalInterest ? av : sn;
    const bestName = best === av ? "Avalanche" : "Snowball";
    const saved = Math.abs(av.totalInterest - sn.totalInterest);

    summary.innerHTML =
      '<p class="muted">With <strong>' + fmt(budget) + '/mo</strong>, you can be debt-free in</p>' +
      '<p class="result-big win">' + months2str(best.months) + '</p>' +
      '<p class="muted">using the <strong>' + bestName + '</strong> method, paying <strong>' +
      fmt(best.totalInterest) + '</strong> in total interest.</p>';

    document.getElementById("compare").innerHTML =
      '<tr><td>Avalanche (highest APR first)</td><td>' + months2str(av.months) + '</td><td>' + fmt(av.totalInterest) + '</td></tr>' +
      '<tr><td>Snowball (smallest balance first)</td><td>' + months2str(sn.months) + '</td><td>' + fmt(sn.totalInterest) + '</td></tr>';

    document.getElementById("recommend").textContent = saved < 1
      ? "Both methods cost about the same here — pick whichever keeps you motivated."
      : "Avalanche saves you " + fmt(saved) + " in interest vs. snowball. Snowball clears individual debts sooner for quicker wins.";
  });
})(typeof window !== "undefined" ? window : globalThis);
