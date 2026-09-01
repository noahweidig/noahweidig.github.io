// Contact form: submit to Formspree over fetch so the visitor stays on the
// page (a plain POST would hand them off to Formspree's own thank-you screen).
// The button and the live region carry the state together: an icon for the
// glance, words for a screen reader.
//
// This is the site's only inbound channel, so every failure path has to leave
// the visitor with something to do (#273): the email address is in the
// message, not implied by it, and if this script never runs the form falls
// back to the plain POST its `action` already supports.
(function () {
  var form = document.querySelector("form.nw-form");
  if (!form) return;

  var status = form.querySelector(".nw-form-status");
  var btn = form.querySelector('button[type="submit"]');
  var btnLabel = btn ? btn.querySelector(".nw-btn-label") : null;
  var idleLabel = btnLabel ? btnLabel.textContent : "";
  var EMAIL = "noah@noahweidig.com";

  // Spam trap, half two: the honeypot in the markup catches bots that fill
  // every field, this catches the ones that post the form the instant they
  // parse it. Stamped here rather than in the HTML so a cached page can't
  // ship a stale (and therefore always-old-enough) timestamp.
  var started = form.querySelector('input[name="nw-form-started"]');
  if (started) started.value = String(Date.now());
  var MIN_FILL_MS = 2000;

  // state: "busy" while the request is in flight, then "ok" or "err".
  // `html` carries a mailto link on the failure paths; plain messages go
  // through textContent so nothing else can inject markup here.
  var show = function (msg, state, html) {
    if (!status) return;
    if (html) status.innerHTML = msg;
    else status.textContent = msg;
    status.classList.toggle("busy", state === "busy");
    status.classList.toggle("ok", state === "ok");
    status.classList.toggle("err", state === "err");
    status.hidden = false;
  };

  // The two failure modes need different advice, so they are told apart: a
  // rejected request means try again or write; a request that never left
  // (offline, or a content blocker — Formspree is on several block lists)
  // means retrying will fail the same way, so email is the only way through.
  var showFailure = function (lead) {
    show(
      lead + ' — email me at <a href="mailto:' + EMAIL + '">' + EMAIL + "</a> instead.",
      "err",
      true,
    );
  };

  var setBusy = function (busy) {
    if (!btn) return;
    btn.disabled = busy;
    // Drives the spinner and the "sent" tick in CSS; aria-busy says the same
    // thing to assistive tech.
    btn.classList.toggle("is-sending", busy);
    btn.setAttribute("aria-busy", busy ? "true" : "false");
    // A greyed-out button on its own is indistinguishable from a dead one on
    // a slow connection, so the in-flight state is also said in the label.
    if (btnLabel) btnLabel.textContent = busy ? "Sending…" : idleLabel;
  };

  form.addEventListener("submit", function (e) {
    // Only take the submit over once this handler is definitely able to
    // finish it. If any of these is missing, doing nothing here lets the
    // browser POST the form to `action` — Formspree's own thank-you page is a
    // worse experience than the inline status, and infinitely better than a
    // button that does not respond.
    if (!window.fetch || !window.FormData || !form.action) return;

    var trap = form.querySelector('input[name="_gotcha"]');
    var tooFast = started && started.value && Date.now() - Number(started.value) < MIN_FILL_MS;
    if ((trap && trap.value) || tooFast) {
      // A bot gets the same screen a person does, and nothing is sent: telling
      // it what tripped only helps it try again. Formspree drops a filled
      // `_gotcha` server-side too, so the plain-POST path is covered as well.
      e.preventDefault();
      form.reset();
      show("Thanks! Your message has been sent.", "ok");
      return;
    }

    e.preventDefault();
    setBusy(true);
    show("Sending your message…", "busy");

    // Distinguishes "the server said no" from "the request never left": the
    // fetch promise rejects only for the latter, so the flag is set the moment
    // a response — any response — arrives.
    var reached = false;

    fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
    })
      .then(function (res) {
        reached = true;
        if (res.ok) {
          form.reset();
          if (started) started.value = String(Date.now());
          show("Thanks! Your message has been sent.", "ok");
          return;
        }
        return res
          .json()
          .then(function (data) {
            return (data.errors || [])
              .map(function (err) {
                return err.message;
              })
              .join(", ");
          })
          .catch(function () {
            return "";
          })
          .then(function (msg) {
            showFailure(msg || "Something went wrong at the other end");
          });
      })
      .catch(function () {
        if (reached) return;
        showFailure("That didn't send — the request was blocked or you're offline");
      })
      .finally(function () {
        // Restored on every path, including the failure ones above.
        setBusy(false);
        // Sighted keyboard users would otherwise be left on the button with
        // the outcome rendered above it; the message is focusable
        // (tabindex="-1") purely so it can receive this.
        if (status) status.focus();
      });
  });
})();
