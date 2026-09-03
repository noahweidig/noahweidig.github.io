/**
 * The feed's old address. Quarto served it here, so subscribers still poll it;
 * a meta-refresh stub is useless to a feed reader, so the real feed is served
 * at both paths.
 */
export { GET } from '../rss.xml';
