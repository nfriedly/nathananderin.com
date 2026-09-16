(function () {
    'use strict';

    var hasTags = !!document.querySelector('.review-filter[data-tag]');
    var cards = Array.prototype.slice.call(document.querySelectorAll('.review-card'));
    var links = hasTags
        ? Array.prototype.slice.call(document.querySelectorAll('.review-filter'))
        : Array.prototype.slice.call(document.querySelectorAll('.review-filter[data-author]'));

    // each filter is a querystring key that may appear multiple times
    // (e.g. ?tag=tech&tag=wifi); read them
    // all out of the URL
    function getFilters() {
        var params = new URLSearchParams(window.location.search);
        return {
            author: params.getAll('author'),
            tag: hasTags ? params.getAll('tag') : []
        };
    }

    function cardHasTag(card, tag) {
        return (card.getAttribute('data-tags') || '').split(' ').indexOf(tag) !== -1;
    }

    function cardVisible(filters, card) {
        var noAuthor = filters.author.length === 0;
        var authorOk = noAuthor || filters.author.indexOf(card.getAttribute('data-author')) !== -1;
        if (!authorOk) return false;
        if (!hasTags) return true;
        var noTag = filters.tag.length === 0;
        return noTag || filters.tag.some(function (tag) { return cardHasTag(card, tag); });
    }

    function applyFilter() {
        var filters = getFilters();
        var none = filters.author.length === 0 && filters.tag.length === 0;
        cards.forEach(function (card) {
            card.style.display = cardVisible(filters, card) ? '' : 'none';
        });
        links.forEach(function (link) {
            var isAuthor = link.hasAttribute('data-author');
            var value = link.getAttribute(isAuthor ? 'data-author' : 'data-tag');
            var selected = isAuthor ? filters.author : filters.tag;
            var active = value === '' ? (isAuthor ? filters.author.length === 0 : filters.tag.length === 0) : selected.indexOf(value) !== -1;
            link.classList.toggle('active', active);
        });
        // "clear all" only shows when anything is filtered
        var clear = document.querySelector('.review-filter-clear');
        if (clear) clear.style.display = none ? 'none' : 'inline';
        // filtering should always apply to the full set of reviews, not just
        // the first page, so go ahead and load the rest if we haven't yet
        if (!none) loadMore();
    }

    function updateUrl(updater) {
        var url = new URL(window.location.href);
        updater(url.searchParams);
        var next = url.pathname + url.search + url.hash;
        history.pushState(null, '', next);
        applyFilter();
    }

    links.forEach(function (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            var isAuthor = link.hasAttribute('data-author');
            var value = link.getAttribute(isAuthor ? 'data-author' : 'data-tag');
            var filters = getFilters();
            var selected = (isAuthor ? filters.author : filters.tag).slice();
            if (value === '') {
                updateUrl(function (p) { p.delete(isAuthor ? 'author' : 'tag'); });
            } else if (selected.indexOf(value) !== -1) {
                // clicking an active filter removes it
                updateUrl(function (p) {
                    p.delete(isAuthor ? 'author' : 'tag');
                    selected.filter(function (v) { return v !== value; }).forEach(function (v) { p.append(isAuthor ? 'author' : 'tag', v); });
                });
            } else {
                updateUrl(function (p) { p.append(isAuthor ? 'author' : 'tag', value); });
            }
        });
    });

    window.addEventListener('popstate', applyFilter);

    var tagsToggle = document.querySelector('.review-tags-toggle');
    var moreTags = Array.prototype.slice.call(document.querySelectorAll('.review-tags-more'));

    function revealMoreTags() {
        moreTags.forEach(function (el) { el.hidden = false; });
        if (tagsToggle) tagsToggle.hidden = true;
    }

    if (tagsToggle) {
        tagsToggle.addEventListener('click', revealMoreTags);
    }

    // if an active tag filter is in the hidden set, reveal it on load
    var activeTags = getFilters().tag;
    if (activeTags.length) {
        var hiddenVals = moreTags.reduce(function (arr, el) {
            return arr.concat(Array.prototype.slice.call(el.querySelectorAll('.review-filter')).map(function (a) { return a.getAttribute('data-tag'); }));
        }, []);
        if (activeTags.some(function (t) { return hiddenVals.indexOf(t) !== -1; })) revealMoreTags();
    }

    var more = document.getElementById('load-more');
    var link = more && more.querySelector('#load-more-link');
    var page2Url = link ? link.getAttribute('href') : null;
    var loaded = !link;

    function loadMore() {
        if (loaded || !page2Url) return;
        loaded = true;
        if (link) link.hidden = true;
        var loading = document.getElementById('load-more-loading');
        if (loading) loading.hidden = false;
        fetch(page2Url)
            .then(function (res) { return res.text(); })
            .then(function (html) {
                var doc = new DOMParser().parseFromString(html, 'text/html');
                var newCards = Array.prototype.slice.call(doc.querySelectorAll('.reviews .review-card'));
                var parent = more && more.parentNode;
                if (!parent || !newCards.length) throw new Error('no reviews found on ' + page2Url);
                newCards.forEach(function (card) { parent.insertBefore(card, more); });
                cards = cards.concat(newCards);
                if (more) parent.removeChild(more);
                if (loading) loading.hidden = true;
                applyFilter();
            })
            .catch(function () {
                loaded = false;
                if (link) link.hidden = false;
                if (loading) loading.hidden = true;
            });
    }

    if (link) {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            loadMore();
        });
    }

    // automatically load the rest on fast loads, or whenever the URL is filtered
    var navStart = (performance && performance.timing && performance.timing.navigationStart) || Date.now();
    window.addEventListener('load', function () {
        if (Date.now() - navStart < 30000 || getFilters().author.length || getFilters().tag.length) loadMore();
    });

    applyFilter();
})();