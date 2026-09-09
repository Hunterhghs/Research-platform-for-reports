/* H Heuristics — progressive enhancement only. Every page works without this. */
(function () {
  'use strict';

  /* ---------------------------------------------------------- report filter */
  var list = document.querySelector('[data-filter-list]');
  if (list) {
    var input = document.querySelector('[data-filter-input]');
    var chips = Array.prototype.slice.call(document.querySelectorAll('[data-topic]'));
    var items = Array.prototype.slice.call(list.querySelectorAll('.entry'));
    var empty = document.querySelector('[data-filter-empty]');
    var count = document.querySelector('[data-filter-count]');
    var topic = '';
    var query = '';

    function apply() {
      var shown = 0;
      items.forEach(function (el) {
        var topics = (el.dataset.topics || '').split('|');
        var ok =
          (!topic || topics.indexOf(topic) !== -1) &&
          (!query || (el.dataset.search || '').indexOf(query) !== -1);
        el.hidden = !ok;
        if (ok) shown++;
      });
      if (empty) empty.hidden = shown !== 0;
      if (count) {
        var filtered = topic || query;
        count.hidden = !filtered;
        count.textContent = shown + (shown === 1 ? ' report' : ' reports') +
          ' of ' + items.length + (topic ? ' in ' + topic : '');
      }
      // Keep the hairline rules tidy when rows are hidden.
      var visible = items.filter(function (el) { return !el.hidden; });
      items.forEach(function (el) { el.classList.remove('is-last'); });
      if (visible.length) visible[visible.length - 1].classList.add('is-last');

      var url = new URL(window.location.href);
      if (topic) url.searchParams.set('topic', topic); else url.searchParams.delete('topic');
      history.replaceState(null, '', url.pathname + url.search);
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        topic = chip.dataset.topic;
        chips.forEach(function (c) { c.classList.toggle('is-active', c === chip); });
        apply();
      });
    });

    if (input) {
      input.addEventListener('input', function () {
        query = input.value.trim().toLowerCase();
        apply();
      });
    }

    // Honour ?topic= so topic links can deep-link into the filtered list.
    var initial = new URL(window.location.href).searchParams.get('topic');
    if (initial) {
      var match = chips.filter(function (c) { return c.dataset.topic === initial; })[0];
      if (match) match.click();
    }
  }

  /* ------------------------------------------------------------- citations */
  var cite = document.querySelector('[data-cite]');
  if (cite) {
    var tabs = Array.prototype.slice.call(cite.querySelectorAll('[data-cite-tab]'));
    var panels = Array.prototype.slice.call(cite.querySelectorAll('[data-cite-panel]'));
    var copy = cite.querySelector('[data-cite-copy]');

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.classList.toggle('is-active', on);
          t.setAttribute('aria-selected', String(on));
        });
        panels.forEach(function (p) {
          p.hidden = p.dataset.citePanel !== tab.dataset.citeTab;
        });
      });
    });

    if (copy && navigator.clipboard) {
      copy.addEventListener('click', function () {
        var open = panels.filter(function (p) { return !p.hidden; })[0];
        if (!open) return;
        navigator.clipboard.writeText(open.textContent).then(function () {
          var was = copy.textContent;
          copy.textContent = 'Copied';
          setTimeout(function () { copy.textContent = was; }, 1600);
        });
      });
    } else if (copy) {
      copy.hidden = true;
    }
  }

  /* ----------------------------------------------------------- pdf preview */
  var toggle = document.querySelector('[data-preview-toggle]');
  var section = document.querySelector('[data-preview]');
  if (toggle && section) {
    var mount = section.querySelector('[data-preview-mount]');
    toggle.addEventListener('click', function () {
      var open = section.hidden;
      section.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Hide preview' : 'Preview inline';
      if (open && mount && !mount.firstChild) {
        var frame = document.createElement('iframe');
        frame.src = mount.dataset.src;
        frame.title = 'PDF preview';
        frame.loading = 'lazy';
        mount.appendChild(frame);
      }
      if (open) section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
})();
