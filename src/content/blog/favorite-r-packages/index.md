---
title: My Favorite R Packages
date: '2026-07-20'
description: The R packages I reach for every day: tidyverse, reproducibility utilities, easystats, and ggplot2 extensions.
categories:
  - R
  - Data Science
  - Tidyverse
draft: false
image: './cover.webp'
image-light: './cover-light.webp'
image-alt: 'Cover card reading “My Favorite R Packages” beside three stacked to-do cards in green, violet and teal'
---

These are the R packages I install on a fresh machine before anything else.
None are exotic — that's the point. I use the native pipe `|>` throughout;
it ships with base R and needs no dependencies.

```r
library(tidyverse)
library(palmerpenguins)
set.seed(42)
```

## The tidyverse

The tidyverse's contribution is **consistency**: data frames in, data frames
out, data as the first argument, one job per function.

### ggplot2<img src="../../media/blog/favorite-r-packages/logos/ggplot2.webp" srcset="../../media/blog/favorite-r-packages/logos/ggplot2.webp 1x, ../../media/blog/favorite-r-packages/logos/ggplot2@2x.webp 2x" alt="ggplot2 hex logo" class="pkg-logo" width="90" height="104" loading="lazy">

Implements the _grammar of graphics_: data mapped to visual properties
(aesthetics), drawn with geometric objects (geoms) in layers.

```r
ggplot(penguins, aes(flipper_length_mm, body_mass_g, colour = species)) +
  geom_point(alpha = 0.8) +
  labs(title = "Flipper length predicts body mass", colour = "Species")
```

### dplyr<img src="../../media/blog/favorite-r-packages/logos/dplyr.webp" srcset="../../media/blog/favorite-r-packages/logos/dplyr.webp 1x, ../../media/blog/favorite-r-packages/logos/dplyr@2x.webp 2x" alt="dplyr hex logo" class="pkg-logo" width="90" height="104" loading="lazy">

The grammar of data manipulation: `filter()`, `select()`, `mutate()`,
`arrange()`, `summarise()`.

### tidyr<img src="../../media/blog/favorite-r-packages/logos/tidyr.webp" srcset="../../media/blog/favorite-r-packages/logos/tidyr.webp 1x, ../../media/blog/favorite-r-packages/logos/tidyr@2x.webp 2x" alt="tidyr hex logo" class="pkg-logo" width="90" height="104" loading="lazy">

Reshapes data between wide and long with `pivot_longer()` / `pivot_wider()`.

### readr<img src="../../media/blog/favorite-r-packages/logos/readr.webp" srcset="../../media/blog/favorite-r-packages/logos/readr.webp 1x, ../../media/blog/favorite-r-packages/logos/readr@2x.webp 2x" alt="readr hex logo" class="pkg-logo" width="90" height="104" loading="lazy">

Imports CSVs/TSVs faster and more predictably than base R, returning a
tibble and never silently converting strings to factors.

### purrr<img src="../../media/blog/favorite-r-packages/logos/purrr.webp" srcset="../../media/blog/favorite-r-packages/logos/purrr.webp 1x, ../../media/blog/favorite-r-packages/logos/purrr@2x.webp 2x" alt="purrr hex logo" class="pkg-logo" width="90" height="104" loading="lazy">

Functional iteration: `map_dbl(x, f)` applies `f` to each element and
_guarantees_ a double vector back, erroring loudly otherwise.

### tibble<img src="../../media/blog/favorite-r-packages/logos/tibble.webp" srcset="../../media/blog/favorite-r-packages/logos/tibble.webp 1x, ../../media/blog/favorite-r-packages/logos/tibble@2x.webp 2x" alt="tibble hex logo" class="pkg-logo" width="90" height="104" loading="lazy">

A stricter, friendlier `data.frame` with no silent type coercion.

### stringr<img src="../../media/blog/favorite-r-packages/logos/stringr.webp" srcset="../../media/blog/favorite-r-packages/logos/stringr.webp 1x, ../../media/blog/favorite-r-packages/logos/stringr@2x.webp 2x" alt="stringr hex logo" class="pkg-logo" width="90" height="104" loading="lazy">

Consistent string functions: `str_detect()`, `str_replace_all()`, `str_extract()`.

### forcats<img src="../../media/blog/favorite-r-packages/logos/forcats.webp" srcset="../../media/blog/favorite-r-packages/logos/forcats.webp 1x, ../../media/blog/favorite-r-packages/logos/forcats@2x.webp 2x" alt="forcats hex logo" class="pkg-logo" width="90" height="104" loading="lazy">

Makes factor level order manageable, e.g. `fct_reorder()` to sort a bar chart by value.

### lubridate<img src="../../media/blog/favorite-r-packages/logos/lubridate.webp" srcset="../../media/blog/favorite-r-packages/logos/lubridate.webp 1x, ../../media/blog/favorite-r-packages/logos/lubridate@2x.webp 2x" alt="lubridate hex logo" class="pkg-logo" width="90" height="104" loading="lazy">

Makes dates tractable: `ymd("2026-07-20") + months(3)`.

## Utility packages

Tools for reproducible projects.

### fs<img src="../../media/blog/favorite-r-packages/logos/fs.webp" srcset="../../media/blog/favorite-r-packages/logos/fs.webp 1x, ../../media/blog/favorite-r-packages/logos/fs@2x.webp 2x" alt="fs hex logo" class="pkg-logo" width="90" height="104" loading="lazy">

A consistent, cross-platform file-system API (`path()`, `dir_ls()`, `path_ext()`).

### here

`here::here()` builds paths from the project root, so scripts run from any working directory.

### glue<img src="../../media/blog/favorite-r-packages/logos/glue.webp" srcset="../../media/blog/favorite-r-packages/logos/glue.webp 1x, ../../media/blog/favorite-r-packages/logos/glue@2x.webp 2x" alt="glue hex logo" class="pkg-logo" width="90" height="104" loading="lazy">

String interpolation: `glue("We measured {n} {species} penguins.")`.

### conflicted

Turns silent function-name clashes into errors; pick a winner with `conflict_prefer()`.

### arrow<img src="../../media/blog/favorite-r-packages/logos/arrow.webp" srcset="../../media/blog/favorite-r-packages/logos/arrow.webp 1x, ../../media/blog/favorite-r-packages/logos/arrow@2x.webp 2x" alt="arrow hex logo" class="pkg-logo" width="90" height="104" loading="lazy">

Fast Parquet/CSV I/O and lazy queries over datasets larger than memory.

### renv<img src="../../media/blog/favorite-r-packages/logos/renv.svg" alt="renv hex logo" class="pkg-logo" width="100" height="100" loading="lazy">

Per-project package library plus a lockfile (`renv.lock`) of exact versions.

## The easystats ecosystem

**easystats** gives statistical modeling one consistent API across model types.

- **parameters**: coefficients, CIs and _p_-values in one table.
- **performance**: R², RMSE, AIC/BIC, and `check_model()` diagnostics.
- **effectsize**: standardized effect sizes in plain language.
- **report**: a publication-ready paragraph describing a model.

```r
model <- lm(body_mass_g ~ flipper_length_mm + species + sex, data = penguins)
parameters::model_parameters(model)
```

## Visualization extensions

- **ggdist** draws distributions and uncertainty (`stat_halfeye()`).
- **patchwork** composes ggplots with `+`, `|` and `/`.
- **cowplot** gives pixel-precise panel alignment.

## Conclusion

They compose: readr hands a tibble to dplyr, which hands it to ggplot2, while
here and renv keep paths and versions honest.
