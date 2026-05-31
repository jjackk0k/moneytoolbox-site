/* MoneyToolbox shared UI engine — vanilla, no dependencies, no network.
   Custom animated SVG charts + number count-up + share helpers, shared by every tool.
   Palette is kept in sync with assets/style.css. */
(function (root) {
  "use strict";
  if (typeof document === "undefined") return;

  var C = { bg: "#1c2e26", panel: "#21352b", cream: "#ece4d2", soft: "#c9bfa8",
            muted: "#92977f", brass: "#c9a24a", sage: "#8fb79c", line: "#34473d" };

  var reduce = false;
  try { reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}

  var SVGNS = "http://www.w3.org/2000/svg";
  function el(name, attrs) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    return n;
  }

  // Animate a number from 0 (or current) to `to`, formatted by `fmt`.
  function countUp(node, to, fmt, dur) {
    fmt = fmt || function (v) { return Math.round(v).toLocaleString("en-US"); };
    if (reduce) { node.textContent = fmt(to); return; }
    dur = dur || 900;
    var from = 0, start = null;
    function ease(t) { return 1 - Math.pow(1 - t, 3); } // easeOutCubic
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      node.textContent = fmt(from + (to - from) * ease(p));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // Line/area chart. opts:
  //  series: [{ values:[n...], color, fill:bool, label }], labels:[xTickLabels], formatY, height
  function lineChart(svg, opts) {
    var W = 600, H = opts.height || 240, padL = 52, padR = 14, padT = 14, padB = 30;
    var plotW = W - padL - padR, plotH = H - padT - padB;
    var series = opts.series, fmtY = opts.formatY || function (v) { return Math.round(v); };
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("preserveAspectRatio", "none");

    var n = series[0].values.length;
    var max = 0;
    series.forEach(function (s) { s.values.forEach(function (v) { if (v > max) max = v; }); });
    if (max <= 0) max = 1;
    // round max up to a "nice" number for gridlines
    var pow = Math.pow(10, Math.floor(Math.log10(max)));
    max = Math.ceil(max / pow) * pow;

    function X(i) { return padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW); }
    function Y(v) { return padT + plotH * (1 - v / max); }

    // gridlines + y labels
    var rows = 4, g;
    for (var r = 0; r <= rows; r++) {
      var val = max * (1 - r / rows), gy = padT + (plotH * r / rows);
      svg.appendChild(el("line", { x1: padL, y1: gy, x2: W - padR, y2: gy, stroke: C.line, "stroke-width": 1 }));
      g = el("text", { x: padL - 8, y: gy + 4, "text-anchor": "end", fill: C.muted, "font-size": 11, "font-family": "system-ui, sans-serif" });
      g.textContent = fmtY(val);
      svg.appendChild(g);
    }
    // x tick labels
    if (opts.labels) {
      var ticks = Math.min(opts.labels.length, 6), li;
      for (var t = 0; t < ticks; t++) {
        li = Math.round((opts.labels.length - 1) * t / (ticks - 1));
        var tx = el("text", { x: X(li), y: H - 10, "text-anchor": "middle", fill: C.muted, "font-size": 11, "font-family": "system-ui, sans-serif" });
        tx.textContent = opts.labels[li];
        svg.appendChild(tx);
      }
    }

    // each series: area fill (optional) + animated line
    series.forEach(function (s) {
      var d = "", area = "";
      for (var i = 0; i < n; i++) {
        var px = X(i).toFixed(1), py = Y(s.values[i]).toFixed(1);
        d += (i === 0 ? "M" : "L") + px + " " + py + " ";
      }
      if (s.fill) {
        area = d + "L" + X(n - 1).toFixed(1) + " " + Y(0) + " L" + X(0).toFixed(1) + " " + Y(0) + " Z";
        var ap = el("path", { d: area, fill: s.color, opacity: 0.14 });
        svg.appendChild(ap);
        if (!reduce) { ap.style.opacity = 0; ap.style.transition = "opacity .9s ease .25s"; requestAnimationFrame(function () { ap.style.opacity = 0.14; }); }
      }
      var p = el("path", { d: d, fill: "none", stroke: s.color, "stroke-width": 2.5, "stroke-linejoin": "round", "stroke-linecap": "round" });
      svg.appendChild(p);
      if (!reduce) {
        var len = p.getTotalLength();
        p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
        p.style.transition = "stroke-dashoffset 1.1s ease";
        requestAnimationFrame(function () { p.style.strokeDashoffset = 0; });
      }
    });
  }

  // Horizontal comparison bars into a container. bars:[{label, value, color, display}]
  function bars(container, items, fmt) {
    fmt = fmt || function (v) { return Math.round(v).toLocaleString("en-US"); };
    var max = 0; items.forEach(function (b) { if (b.value > max) max = b.value; });
    if (max <= 0) max = 1;
    container.innerHTML = "";
    items.forEach(function (b) {
      var row = document.createElement("div"); row.className = "bar-row";
      row.innerHTML = '<div class="bar-head"><span>' + b.label + '</span><strong>' + (b.display || fmt(b.value)) + '</strong></div>' +
        '<div class="bar-track"><div class="bar-fill" style="background:' + (b.color || C.brass) + '"></div></div>';
      container.appendChild(row);
      var fill = row.querySelector(".bar-fill");
      var pct = (b.value / max) * 100;
      if (reduce) { fill.style.width = pct + "%"; }
      else { fill.style.width = "0%"; requestAnimationFrame(function () { fill.style.width = pct + "%"; }); }
    });
  }

  // Save inputs into the URL (shareable) and restore on load. fields: {id: type}
  function bindShare(fields, btn) {
    function restore() {
      var q = new URLSearchParams(location.search), any = false;
      Object.keys(fields).forEach(function (id) {
        if (q.has(id)) { var node = document.getElementById(id); if (node) { node.value = q.get(id); any = true; } }
      });
      return any;
    }
    if (btn) btn.addEventListener("click", function () {
      var q = new URLSearchParams();
      Object.keys(fields).forEach(function (id) { var node = document.getElementById(id); if (node) q.set(id, node.value); });
      var url = location.origin + location.pathname + "?" + q.toString();
      var done = function () { var old = btn.textContent; btn.textContent = "Link copied ✓"; setTimeout(function () { btn.textContent = old; }, 1800); };
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done); else done();
      try { history.replaceState(null, "", url); } catch (e) {}
    });
    return restore;
  }

  // Sync a range slider with a number input (two-way), calling cb on change.
  function syncSlider(rangeId, numId, cb) {
    var range = document.getElementById(rangeId), num = document.getElementById(numId);
    if (!range || !num) return;
    range.addEventListener("input", function () { num.value = range.value; if (cb) cb(); });
    num.addEventListener("input", function () { range.value = num.value; if (cb) cb(); });
  }

  // Replace the basic native number-input spinners with custom brass up/down steppers.
  var CHEV_UP = '<svg viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 9L7 4.5L11.5 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var CHEV_DOWN = '<svg viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2.5 5L7 9.5L11.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function steppers(scope) {
    scope = scope || document;
    var inputs = scope.querySelectorAll("input[type=number]:not([data-stepped])");
    Array.prototype.forEach.call(inputs, function (inp) {
      inp.setAttribute("data-stepped", "1");
      var wrap = document.createElement("div"); wrap.className = "num-wrap";
      inp.parentNode.insertBefore(wrap, inp); wrap.appendChild(inp);
      var st = document.createElement("div"); st.className = "stepper";
      st.innerHTML = '<button type="button" class="step up" tabindex="-1" aria-label="Increase">' + CHEV_UP + '</button>' +
                     '<button type="button" class="step down" tabindex="-1" aria-label="Decrease">' + CHEV_DOWN + '</button>';
      wrap.appendChild(st);
      function bump(dir) {
        var step = parseFloat(inp.step) || 1, v = parseFloat(inp.value);
        if (isNaN(v)) v = 0;
        v = +(v + dir * step).toFixed(6);
        if (inp.min !== "" && v < +inp.min) v = +inp.min;
        if (inp.max !== "" && v > +inp.max) v = +inp.max;
        inp.value = v;
        inp.dispatchEvent(new Event("input", { bubbles: true }));
        inp.dispatchEvent(new Event("change", { bubbles: true }));
      }
      st.querySelector(".up").addEventListener("click", function () { bump(1); });
      st.querySelector(".down").addEventListener("click", function () { bump(-1); });
    });
  }

  root.MTUI = { colors: C, reduce: reduce, countUp: countUp, lineChart: lineChart, bars: bars,
                bindShare: bindShare, syncSlider: syncSlider, steppers: steppers };

  // Wire any <button data-copy="#selector"> to copy that element's value/text to the clipboard.
  function wireCopies(scope) {
    var btns = (scope || document).querySelectorAll("[data-copy]:not([data-copywired])");
    Array.prototype.forEach.call(btns, function (btn) {
      btn.setAttribute("data-copywired", "1");
      btn.addEventListener("click", function () {
        var target = document.querySelector(btn.getAttribute("data-copy"));
        if (!target) return;
        var text = (target.value !== undefined && target.value !== null) ? target.value : target.textContent;
        var done = function () { var o = btn.textContent; btn.textContent = "Copied ✓"; setTimeout(function () { btn.textContent = o; }, 1800); };
        if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, done);
        else { try { target.select && target.select(); document.execCommand("copy"); } catch (e) {} done(); }
      });
    });
  }
  root.MTUI.wireCopies = wireCopies;

  function init() { try { steppers(document); wireCopies(document); } catch (e) {} }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})(typeof window !== "undefined" ? window : globalThis);
