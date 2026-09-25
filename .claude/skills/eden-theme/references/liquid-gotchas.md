# Liquid & theme gotchas (all hit while building EDEN)

Theme Check passed on every one of these. They only showed up in the rendered page or the browser.

1. **Filters after a named argument apply to the whole output.**
   `{{ 'key' | t: date: order.created_at | time_tag: format: 'date' }}` runs `time_tag` on the *translated string*. Same for `| money`, `| default:` and `| escape` inside `image_tag: alt: x | default: y`. Assign first:
   ```liquid
   {%- assign order_date = order.created_at | time_tag: format: 'date' -%}
   {{ 'customer.order.date_html' | t: date: order_date }}
   ```
   Keys whose values contain HTML (money, `<time>`) end in `_html`.
2. **`default: 'key' | t` translates custom text too.** `{{ custom | default: 'a.b' | t }}` sends the merchant's text through `t`. Resolve the default in a `{% liquid %}` block, then output the variable.
3. **Don't rely on `forloop.parentloop`.** Capture `assign option_index = forloop.index0` at the top of the outer loop (the preview's liquidjs lacks it, and it duplicated radio ids).
4. **Snippets are isolated.** `{% render %}` sees only its params plus Shopify globals (`settings`, `shop`, `request`, `routes`, `cart`, `product` on product pages…). Layout variables such as `motion` are not visible — pass them or read `settings`.
5. **No conditionally opened tags.** `{% if %}<h1>{% else %}<div>{% endif %}` breaks the LiquidHTML parser. Use `<{{ tag }}>…</{{ tag }}>` with an assigned tag name.
6. **`form` only exists inside `{% form %}…{% endform %}`.** Error-dependent scripts must live inside the form block.
7. **Pluralised keys.** Anything called with `count:` needs `{ "one": …, "other": … }`. JS strings that substitute a number use a separate `[count]` key (e.g. `cart.count_js`).
8. **Comparing option values.** Use `value.selected` rather than `option.selected_value == value`.
9. **Duplicate ids.** Line items render in both the drawer and the cart page, so pass `id_prefix`. Size/colour inputs build ids from `section.id` + option index + value index.
10. **Section wrapper classes.** `"class"` in a section schema lands on the `.shopify-section` wrapper. That's how the header wrapper becomes sticky (`.section-header`). The hero overlays the header through `main > .shopify-section:first-child:has([data-header-overlay])`.
11. **Reset specificity.** Global resets must use `:where()` (`:where(ul[role=list])`), or they override component padding. That bug removed the gallery's gutter.
12. **`overflow: hidden` kills `position: sticky`** for descendants. Use `overflow: clip` on scene sections.
13. **SplitText ARIA.** Default `aria: 'auto'` puts `aria-label` on the split element, which axe flags on `<p>`. motion.js already chooses `none` / `auto` / `hidden` + screen-reader copy; keep it that way.
14. **Negative tracking + `background-clip: text`.** Glyph overhang escapes the letter's box and shows a seam. `.fof__char` gets `padding-inline: .1em; margin-inline: -.1em`.
15. **Grain strength.** Noise layers must stay very light (`opacity: .1` on the section noise, global grain around 7%). Stronger turns black sections grey. Check it in a screenshot.
