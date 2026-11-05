/* H Heuristics — progressive enhancement only. Every page works without this. */
(function () {
  'use strict';

  /* ------------------------------------------------- report filter + pages */
  var list = document.querySelector('[data-filter-list]');
  if (list) {
    var input = document.querySelector('[data-filter-input]');
    var chips = Array.prototype.slice.call(document.querySelectorAll('[data-topic]'));
    var items = Array.prototype.slice.call(list.querySelectorAll('.entry'));
    var empty = document.querySelector('[data-filter-empty]');
    var count = document.querySelector('[data-filter-count]');
    var pagers = Array.prototype.slice.call(document.querySelectorAll('[data-pager]'));
    var size = parseInt(list.dataset.pageSize, 10) || 25;
    var topic = '';
    var query = '';
    var page = 1;

    // Page numbers to show: always first and last, plus a window around the current page.
    function pageList(current, total) {
      var out = [];
      for (var n = 1; n <= total; n++) {
        if (n === 1 || n === total || Math.abs(n - current) <= 2) out.push(n);
        else if (out[out.length - 1] !== '…') out.push('…');
      }
      return out;
    }

    function button(label, target, opts) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'pager__btn';
      b.textContent = label;
      if (opts.current) b.setAttribute('aria-current', 'page');
      if (opts.disabled) b.disabled = true;
      if (opts.aria) b.setAttribute('aria-label', opts.aria);
      b.addEventListener('click', function () {
        page = target;
        apply(true);
      });
      return b;
    }

    function renderPagers(total) {
      pagers.forEach(function (nav) {
        nav.textContent = '';
        nav.hidden = total <= 1;
        if (total <= 1) return;
        nav.appendChild(button('‹ Prev', page - 1, { disabled: page === 1, aria: 'Previous page' }));
        pageList(page, total).forEach(function (n) {
          if (n === '…') {
            var gap = document.createElement('span');
            gap.className = 'pager__gap';
            gap.textContent = '…';
            nav.appendChild(gap);
          } else {
            nav.appendChild(button(String(n), n, { current: n === page, aria: 'Page ' + n }));
          }
        });
        nav.appendChild(button('Next ›', page + 1, { disabled: page === total, aria: 'Next page' }));
      });
    }

    function apply(scroll) {
      var matches = items.filter(function (el) {
        var topics = (el.dataset.topics || '').split('|');
        return (!topic || topics.indexOf(topic) !== -1) &&
          (!query || (el.dataset.search || '').indexOf(query) !== -1);
      });
      var total = Math.max(1, Math.ceil(matches.length / size));
      if (page > total) page = total;
      if (page < 1) page = 1;
      var first = (page - 1) * size;
      var onPage = matches.slice(first, first + size);

      items.forEach(function (el) {
        el.hidden = onPage.indexOf(el) === -1;
        el.classList.remove('is-last');
      });
      if (onPage.length) onPage[onPage.length - 1].classList.add('is-last');
      if (empty) empty.hidden = matches.length !== 0;

      if (count) {
        var filtered = topic || query;
        count.hidden = !matches.length;
        var range = matches.length > size
          ? 'Showing ' + (first + 1) + '–' + (first + onPage.length) + ' of ' + matches.length
          : matches.length + (matches.length === 1 ? ' report' : ' reports');
        count.textContent = filtered
          ? range + (matches.length > size ? '' : ' of ' + items.length) + (topic ? ' in ' + topic : '')
          : range + (matches.length > size ? ' reports' : '');
      }
      renderPagers(total);

      var url = new URL(window.location.href);
      if (topic) url.searchParams.set('topic', topic); else url.searchParams.delete('topic');
      if (page > 1) url.searchParams.set('page', String(page)); else url.searchParams.delete('page');
      history.replaceState(null, '', url.pathname + url.search + url.hash);

      if (scroll) list.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    chips.forEach(function (chip) {
      chip.addEventListener('click', function () {
        topic = chip.dataset.topic;
        page = 1;
        chips.forEach(function (c) { c.classList.toggle('is-active', c === chip); });
        apply(false);
      });
    });

    if (input) {
      input.addEventListener('input', function () {
        query = input.value.trim().toLowerCase();
        page = 1;
        apply(false);
      });
    }

    // Honour ?topic= and ?page= so links can deep-link into the filtered, paged list.
    var params = new URL(window.location.href).searchParams;
    var initialTopic = params.get('topic');
    if (initialTopic) {
      var match = chips.filter(function (c) { return c.dataset.topic === initialTopic; })[0];
      if (match) {
        topic = initialTopic;
        chips.forEach(function (c) { c.classList.toggle('is-active', c === match); });
      }
    }
    page = parseInt(params.get('page'), 10) || 1;
    apply(false);
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
