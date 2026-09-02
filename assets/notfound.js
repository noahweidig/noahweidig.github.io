/**
 * notfound.js — wire the 404 page's primary action to the navbar search.
 *
 * Quarto's overlay search (website.search.type: overlay in _quarto.yml) is
 * driven by a button.aa-DetachedSearchButton that Algolia's autocomplete
 * builds inside #quarto-search after the page loads. The 404 page ships its
 * own "Search the site" button hidden; once that trigger exists we unhide it
 * and forward clicks to it, so the button is only ever shown when it works.
 */
(function () {
  "use strict";

  var button = document.querySelector("[data-nw-404-search]");
  if (!button) return;

  function trigger() {
    return document.querySelector("#quarto-search .aa-DetachedSearchButton");
  }

  function enable(target) {
    button.hidden = false;
    button.addEventListener("click", function () {
      target.click();
    });
  }

  var found = trigger();
  if (found) {
    enable(found);
    return;
  }

  // Autocomplete mounts asynchronously, so watch for the trigger appearing.
  // The observer disconnects on the first hit, and gives up after 10s so a
  // build without site search doesn't leave it running.
  var observer = new MutationObserver(function () {
    var target = trigger();
    if (!target) return;
    observer.disconnect();
    enable(target);
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(function () {
    observer.disconnect();
  }, 10000);
})();
