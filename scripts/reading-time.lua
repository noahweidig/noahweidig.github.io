-- reading-time.lua — "X minute read" on blog post pages.
--
-- Quarto computes a `reading-time` field for *listing items* (used by
-- _ejs/post-row.ejs for the blog cards) but exposes nothing equivalent to a
-- document rendering itself, so the post pages need their own count. This
-- mirrors what Quarto does for the cards as closely as it can from here:
-- count the words in the source file (minus its YAML front matter) and divide
-- by 200 words per minute. The two counters tokenise slightly differently, so
-- a long post can land a minute apart from its card.
--
-- assets/theme.scss floats the badge into the top right corner of the page.

local WORDS_PER_MINUTE = 200

-- Only blog posts get the badge — not the blog listing, and no other section.
local function is_blog_post(file)
  return file:match("[/\\]blog[/\\]") ~= nil
    and file:match("[/\\]blog[/\\]index%.%w+$") == nil
end

--- Words in `file`, ignoring a leading YAML front matter block.
local function count_words(file)
  local handle = io.open(file, "r")
  if handle == nil then return nil end
  local text = handle:read("a")
  handle:close()

  text = text:gsub("^%-%-%-\r?\n.-\r?\n%-%-%-%s*\r?\n", "")

  local words = 0
  for _ in text:gmatch("%S+") do
    words = words + 1
  end
  return words
end

function Pandoc(doc)
  local file = quarto.doc.input_file or ""
  if not quarto.doc.is_format("html:js") or not is_blog_post(file) then
    return doc
  end

  local words = count_words(file)
  if words == nil then return doc end

  local minutes = math.max(1, math.ceil(words / WORDS_PER_MINUTE))
  local label = minutes .. " minute read"
  table.insert(doc.blocks, 1, pandoc.RawBlock(
    "html",
    '<div class="nw-readtime">' .. label .. "</div>"
  ))
  return doc
end
