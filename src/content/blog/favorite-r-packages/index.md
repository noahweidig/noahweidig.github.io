---
title: My Favorite R Packages
date: '2026-07-20'
description: A quick tour of the R packages I reach for every day — tidyverse, reproducibility utilities, easystats, and ggplot2 extensions.
categories:
  - R
  - Data Science
  - Tidyverse
draft: false
image: './cover.webp'
image-alt: "Cover card reading “My Favorite R Packages” over the site's topographic contour texture"
---

These are the R packages I install on a fresh machine before anything else.
None are exotic — that's the point. I use the native pipe `|>` throughout;
it ships with base R and needs no dependencies.

> [!NOTE]
> Every block on this page is a copy-paste-ready listing. Run the setup block
> first if you want to follow along locally; later blocks assume it. Install
> anything missing once with `install.packages()`.

```r
library(tidyverse)
library(palmerpenguins)
set.seed(42)
```

## The tidyverse

The tidyverse's contribution isn't any single function — it's
**consistency**: data frames in, data frames out; the first argument is
always the data; functions do one thing. Learn one package and the next
feels familiar.

```r
penguins |>
  filter(!is.na(body_mass_g)) |>
  group_by(species, sex) |>
  summarise(n = n(), mean_mass_g = mean(body_mass_g), .groups = "drop") |>
  arrange(desc(mean_mass_g))
```

`library(tidyverse)` attaches ggplot2, dplyr, tidyr, readr, purrr, tibble,
stringr, forcats, and lubridate.

### ggplot2 <img src="/media/blog/favorite-r-packages/logos/ggplot2.webp" alt="ggplot2 hex logo" class="pkg-logo" width="87" height="100" loading="lazy">

Implements the _grammar of graphics_: data mapped to visual properties
(aesthetics), drawn with geometric objects (geoms) in layers. [More below](#ggplot2-in-depth).

```r
ggplot(penguins, aes(flipper_length_mm, body_mass_g, colour = species)) +
  geom_point(alpha = 0.8) +
  labs(title = "Flipper length predicts body mass", colour = "Species")
```

### dplyr <img src="/media/blog/favorite-r-packages/logos/dplyr.webp" alt="dplyr hex logo" class="pkg-logo" width="87" height="100" loading="lazy">

The grammar of data manipulation: `filter()` rows, `select()` columns,
`mutate()` new columns, `arrange()` order, `summarise()` groups, `.by` for
per-call grouping.

```r
penguins |>
  filter(!is.na(bill_length_mm)) |>
  mutate(bill_ratio = bill_length_mm / bill_depth_mm) |>
  summarise(n = n(), mean_ratio = mean(bill_ratio), .by = species) |>
  arrange(desc(mean_ratio))
```

Favorites: `count()`, `slice_max()`/`slice_min()`, `case_when()`, joins
(`left_join()` etc.), and `across()` for applying one transform to many
columns at once.

### tidyr <img src="/media/blog/favorite-r-packages/logos/tidyr.webp" alt="tidyr hex logo" class="pkg-logo" width="87" height="100" loading="lazy">

Reshapes data between wide and long with `pivot_longer()` /
`pivot_wider()` — the most common data-cleaning task there is. Also handy:
`separate_wider_delim()`, `unnest()`, `complete()`.

```r
penguins |>
  select(species, bill_length_mm, bill_depth_mm, flipper_length_mm) |>
  pivot_longer(cols = ends_with("_mm"), names_to = "measurement", values_to = "value")
```

### readr <img src="/media/blog/favorite-r-packages/logos/readr.webp" alt="readr hex logo" class="pkg-logo" width="87" height="100" loading="lazy">

Imports CSVs/TSVs faster and more predictably than base R, returning a
tibble and never silently converting strings to factors. [More below](#readr-in-depth).

### purrr <img src="/media/blog/favorite-r-packages/logos/purrr.webp" alt="purrr hex logo" class="pkg-logo" width="87" height="100" loading="lazy">

Functional iteration: `map_dbl(x, f)` applies `f` to each element and
_guarantees_ a double vector back, erroring loudly otherwise. [More below](#purrr-in-depth).

### tibble <img src="/media/blog/favorite-r-packages/logos/tibble.webp" alt="tibble hex logo" class="pkg-logo" width="87" height="100" loading="lazy">

A stricter, friendlier `data.frame`: no silent type coercion, no partial
name matching, clean columnar printing, and support for list-columns for
"nest, map a model, unnest" workflows.

### stringr <img src="/media/blog/favorite-r-packages/logos/stringr.webp" alt="stringr hex logo" class="pkg-logo" width="87" height="100" loading="lazy">

Every function starts with `str_`, string first, pattern second. Most
used: `str_detect()`, `str_replace_all()`, `str_extract()`, `str_c()`.

### forcats <img src="/media/blog/favorite-r-packages/logos/forcats.webp" alt="forcats hex logo" class="pkg-logo" width="87" height="100" loading="lazy">

Makes factor level order manageable — which controls bar/legend/facet
order everywhere. `fct_reorder()` sorts a bar chart by value instead of
alphabetically; also `fct_infreq()`, `fct_lump_n()`, `fct_recode()`.

### lubridate <img src="/media/blog/favorite-r-packages/logos/lubridate.webp" alt="lubridate hex logo" class="pkg-logo" width="87" height="100" loading="lazy">

Makes dates tractable — parsing, arithmetic, time zones. [More below](#lubridate-in-depth).

```r
ymd("2026-07-20") + months(3)
```

## ggplot2 in depth {#ggplot2-in-depth}

<img src="/media/blog/favorite-r-packages/logos/ggplot2.webp" alt="ggplot2 hex logo" class="pkg-logo" width="87" height="100" loading="lazy">

Every ggplot is built from: data, aesthetic mappings (`aes()`), geoms,
scales, facets, and a coordinate system/theme. You assemble these with
`+`, one layer at a time.

```r
ggplot(penguins, aes(flipper_length_mm, body_mass_g)) +
  geom_point(aes(colour = species), alpha = 0.7) +
  geom_smooth(method = "lm", se = TRUE, colour = "black")
```

Where you put an aesthetic mapping determines what it affects — the
`colour` mapping lives only on `geom_point()`, so one regression line
fits all points.

**Scales** control axis breaks and palettes (`scale_colour_viridis_c()`,
`scales::label_number()`). **Facets** split a plot into small multiples
with one line (`facet_wrap(~ var)`). **Annotations** (`geom_hline()`,
`annotate()`) point the reader at what matters. **Themes**
(`theme_minimal()`, `theme()`) control every non-data element — define a
house theme once and reuse it, or set it as default with `theme_set()`.

```r
ggplot(penguins, aes(flipper_length_mm, body_mass_g, colour = species)) +
  geom_point(alpha = 0.7, na.rm = TRUE) +
  facet_wrap(~ island) +
  theme_minimal(base_size = 13) +
  theme(legend.position = "bottom")
```

Finish with `ggsave()` — vector formats for print, `.png` at 300 dpi for
web/slides, dimensions set in the save call.

## readr in depth {#readr-in-depth}

<img src="/media/blog/favorite-r-packages/logos/readr.webp" alt="readr hex logo" class="pkg-logo" width="87" height="100" loading="lazy">

```r
read_csv("id,species,mass_g\n1,Adelie,3750\n2,Gentoo,5400")
```

readr prints a column specification of what it guessed. Best practice:
state expected types with `col_types` instead of letting it guess, so
surprises become explicit errors:

```r
read_csv(
  "id,species,mass_g\n1,Adelie,3750",
  col_types = cols(id = col_integer(), species = col_character(), mass_g = col_double())
)
```

`parse_number()`, `parse_date()`, and friends do the same parsing outside
of import, and the `na = c(...)` argument to `read_csv()` declares which
sentinel values mean missing.

## purrr in depth {#purrr-in-depth}

<img src="/media/blog/favorite-r-packages/logos/purrr.webp" alt="purrr hex logo" class="pkg-logo" width="87" height="100" loading="lazy">

```r
nums <- list(a = 1:5, b = 6:10, c = 11:15)
map_dbl(nums, mean)
```

Typed variants (`map_dbl`, `map_int`, `map_chr`, `map_lgl`) guarantee
their output type, unlike `sapply()`. Build a tibble from many results
with `map() |> list_rbind()`. When some iterations may fail, `possibly()`
substitutes a fallback value and `safely()` captures the error instead of
stopping the loop. `map2()` and `pmap()` extend the same idea to two or
more inputs.

## lubridate in depth {#lubridate-in-depth}

<img src="/media/blog/favorite-r-packages/logos/lubridate.webp" alt="lubridate hex logo" class="pkg-logo" width="87" height="100" loading="lazy">

Parsing functions are named after the order of date parts — `ymd`,
`mdy`, `dmy` — so you never write a format string. `floor_date()` /
`ceiling_date()` bucket timestamps into days, weeks, or months.

lubridate distinguishes three time-span types: **durations** (`ddays()`)
are exact clock time; **periods** (`months()`) track calendar units;
**intervals** (`a %--% b`) are a specific span you can measure or test
membership against. `with_tz()` shows the same instant in another zone;
`force_tz()` relabels a clock reading — mixing the two is the classic
time-zone bug.

```r
start <- ymd("2026-01-31")
start + months(1)   # calendar-aware: Feb 28
start + ddays(30)   # exactly 30 * 86400 seconds later
```

## Utility packages

The tidyverse gets the headlines, but reproducibility rests on a quieter
set of tools.

### fs <img src="/media/blog/favorite-r-packages/logos/fs.webp" alt="fs hex logo" class="pkg-logo" width="87" height="100" loading="lazy">

A consistent, cross-platform file-system API. Functions start with
`file_`, `dir_`, or `path_`, return tidy character vectors, and behave
identically across OSes.

```r
library(fs)
path("data", "raw", "penguins.csv") |> path_ext()
```

### here

Solves paths that break when a script runs from a different working
directory. `here::here()` builds paths relative to the project root (the
folder with `.Rproj`/`.git`), unlike a hard-coded `setwd()` that only
works on one machine.

### glue <img src="/media/blog/favorite-r-packages/logos/glue.webp" alt="glue hex logo" class="pkg-logo" width="87" height="100" loading="lazy"> {#glue}

String interpolation done right — write the string once, drop
`{expressions}` inline, vectorized.

```r
library(glue)
species <- "Gentoo"; n <- 124
glue("We measured {n} {species} penguins.")
```

For real database work, `glue::glue_sql()` quotes identifiers and escapes
values to guard against injection.

### conflicted

When two loaded packages export the same function name, R silently uses
whichever loaded last. **conflicted** turns that into a loud error and
lets you declare a winner once with `conflict_prefer()`.

### arrow

**arrow** provides a fast, memory-efficient interface to Apache Arrow —
read/write Parquet and CSV, and query datasets far larger than memory
without loading them whole. `read_csv_arrow()` and `read_parquet()` are
drop-in-fast alternatives to readr for big files; `open_dataset()` lets
dplyr verbs run lazily over a folder of files, pushing the computation
down to Arrow.

### renv <img src="/media/blog/favorite-r-packages/logos/renv.svg" alt="renv hex logo" class="pkg-logo" width="100" height="100" loading="lazy">

Gives each project an isolated package library and a lockfile
(`renv.lock`) recording exact versions — like a Python virtual environment
paired with an npm lockfile, for R. Core
workflow: `renv::init()`, work normally, `renv::snapshot()` to record
state, `renv::restore()` on another machine to reproduce it exactly.

## The easystats ecosystem

**easystats** does for statistical modeling what the tidyverse did for
data wrangling: one consistent API across model types (`lm`, `glm`,
`lmer`, brms, and more).

```r
model <- lm(body_mass_g ~ flipper_length_mm + species + sex, data = penguins)
```

- **insight** reaches inside any model object for its formula, data, and
  parameters — the foundation the rest of easystats builds on.
- **parameters** turns coefficients, SEs, CIs, and _p_-values into one
  clean table, working the same for `lm` or a mixed model.
- **performance** assesses model quality — R², RMSE, AIC/BIC,
  collinearity — and `check_model()` produces a full diagnostic dashboard.
- **effectsize** computes and interprets standardized effect sizes
  (Cohen's _d_, eta-squared) in plain language.
- **correlation** runs Pearson/Spearman/partial/Bayesian correlations as
  one tidy call, ready for plotting.
- **datawizard** is the data-prep layer for statistics: standardizing,
  centering, rescaling, recoding.
- **modelbased** computes model-based predictions and estimated marginal
  means directly, instead of hand-deriving them from coefficients.
- **bayestestR** gives the vocabulary of Bayesian inference — credible
  intervals, probability of direction, ROPE, Bayes factors.
- **see** is easystats' ggplot2-based visualization layer, powering
  `plot()` methods across the other packages.
- **report** writes a publication-ready paragraph describing a model, a
  data frame, or a `t.test()` — a genuine first draft of a results
  section.

```r
parameters::model_parameters(model)
report::report(model)
```

## Visualization extensions

Three packages that extend ggplot2 for problems it deliberately leaves
open.

**ggdist** visualizes distributions and uncertainty with "slabinterval"
geoms — `stat_halfeye()` draws a density shape plus a point-and-interval
summary, instead of a bare mean ± SE.

```r
penguins |>
  filter(!is.na(body_mass_g)) |>
  ggplot(aes(body_mass_g, species, fill = species)) +
  ggdist::stat_halfeye(show.legend = FALSE)
```

**patchwork** composes separate ggplots with arithmetic: `+` grids them,
`|` places side by side, `/` stacks vertically, and a trailing `&`
applies a theme change to every subplot at once.

**cowplot** predates some of patchwork's features and remains the
go-to when you need pixel-precise axis alignment across panels
(`plot_grid()`) or its drawing tools for annotating figures with logos or
insets. I default to patchwork for everyday composition and reach for
cowplot when alignment needs to be exact.

## Conclusion

None of these packages is magic alone — what makes them favorites is how
they compose: readr hands a tibble to dplyr, which hands it to ggplot2,
while here and renv keep paths and versions honest. Start with the
tidyverse core, add here and renv on day one, and pull in easystats,
ggdist, and patchwork as your projects demand them.

```r
sessionInfo()
```
