/* SVGO settings for the tech tool icons (public/media/icons/tech). They are
   drawn as CSS masks, so titles are dead weight; nothing else is changed.
   npm run optimize:icons */
module.exports = {
  multipass: true,
  floatPrecision: 3,
  plugins: ['preset-default', 'removeTitle'],
};
