// The theme toggle is an <a href="">; stop it from navigating (which jumps to the top).
document.addEventListener(
  "click",
  function (e) {
    if (e.target.closest && e.target.closest(".quarto-color-scheme-toggle")) {
      e.preventDefault();
    }
  },
  true
);
