// Contact form: submit to Formspree over fetch so the visitor stays on the
// page (a plain POST would hand them off to Formspree's own thank-you screen).
// The button and the live region carry the state together: an icon for the
// glance, words for a screen reader.
(function () {
  var form = document.querySelector("form.nw-form");
  if (!form) return;

  var status = form.querySelector(".nw-form-status");
  var btn = form.querySelector('button[type="submit"]');
  var btnLabel = btn ? btn.querySelector(".nw-btn-label") : null;
  var idleLabel = btnLabel ? btnLabel.textContent : "";

  // state: "busy" while the request is in flight, then "ok" or "err".
  var show = function (msg, state) {
    if (!status) return;
    status.textContent = msg;
    status.classList.toggle("busy", state === "busy");
    status.classList.toggle("ok", state === "ok");
    status.classList.toggle("err", state === "err");
    status.hidden = false;
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
    e.preventDefault();
    setBusy(true);
    show("Sending your message…", "busy");
    fetch(form.action, {
      method: "POST",
      body: new FormData(form),
      headers: { Accept: "application/json" },
    })
      .then(function (res) {
        if (res.ok) {
          form.reset();
          show("Thanks! Your message has been sent.", "ok");
          return;
        }
        return res.json().then(function (data) {
          var msg = (data.errors || []).map(function (err) { return err.message; }).join(", ");
          show(msg || "Oops! Something went wrong — please try again.", "err");
        });
      })
      .catch(function () {
        show("Network error — please try again, or email me directly.", "err");
      })
      .finally(function () {
        // Restored on every path, including the network-error one above.
        setBusy(false);
        // Sighted keyboard users would otherwise be left on the button with
        // the outcome rendered above it; the message is focusable
        // (tabindex="-1") purely so it can receive this.
        if (status) status.focus();
      });
  });
})();
