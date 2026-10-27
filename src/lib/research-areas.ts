/** The six research areas on the homepage, listed in `src/data/research-areas.json`. */
import data from '../data/research-areas.json';

export interface ResearchArea {
  id: string;
  tab: string;
  eyebrow: string;
  heading: string;
  body: string;
  chips: string[];
}

export const researchAreas: ResearchArea[] = data;
