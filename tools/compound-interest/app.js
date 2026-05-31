// Compound Interest Projector — pure projection core + DOM wiring.
// Core `project()` is dependency-free and unit-tested in scripts/test-compound-interest.mjs.

(function (root) {
  "use strict";

  // Project growth of an initial principal plus fixed monthly contributions.
  // opts: { principal, monthly, annualRatePct, years } — contributions made at END of each month.
  // Returns { futureValue, totalContributed, interestEarned, byYear: [{year, balance, contributed, interest}] }.
  function project(opts) {
    const principal = +opts.principal || 0;
    const monthly = +opts.monthly || 0;
    const i = (+opts.annualRatePct || 0) / 100 / 12; // monthly rate
    const years = Math.max(0, Math.round(+opts.years || 0));
    const n = years * 12;

    let balance = principal;
    let contributed = principal;
    const byYear = [];

    for (let m = 1; m <= n; m++) {
      balance = balance * (1 + i) + monthly; // accrue then contribute
      contributed += monthly;
      if (m % 12 === 0) {
        byYear.push({
          year: m / 12,
          balance: balance,
          contributed: contributed,
          interest: balance - contributed
        });
      }
    }

    return {
      futureValue: balance,
      totalContributed: contributed,
      interestEarned: balance - contributed,
      byYear: byYear
    };
  }

  root.Compound = { project: project };

  if (typeof document === "undefined") return; // running under Node tests

  const $ = function (id) { return document.getElementById(id); };
  const money = function (n) { return "$" + Math.round(n).toLocaleString("en-US"); };

  $("calc").addEventListener("click", function () {
    const opts = {
      principal: +$("principal").value || 0,
      monthly: +$("monthly").value || 0,
      annualRatePct: +$("rate").value || 0,
      years: +$("years").value || 0
    };
    const r = project(opts);
    $("results").hidden = false;
    $("summary").innerHTML =
      '<p class="muted">After <strong>' + (Math.round(opts.years) || 0) + ' years</strong>, you\'d have</p>' +
      '<p class="result-big win">' + money(r.futureValue) + '</p>' +
      '<p class="muted">You put in <strong>' + money(r.totalContributed) +
      '</strong>; growth added <strong class="win">' + money(r.interestEarned) + '</strong>.</p>';

    const rows = r.byYear.filter(function (y) {
      // show every year up to 10, then every 5th, to keep the table readable
      return y.year <= 10 || y.year % 5 === 0;
    });
    $("breakdown").innerHTML = rows.map(function (y) {
      return '<tr><td>' + y.year + '</td><td>' + money(y.balance) +
        '</td><td>' + money(y.contributed) + '</td><td class="win">' + money(y.interest) + '</td></tr>';
    }).join("");
  });
})(typeof window !== "undefined" ? window : globalThis);
