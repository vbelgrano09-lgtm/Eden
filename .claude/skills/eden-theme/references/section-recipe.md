# Recipe: a new EDEN section

Copy this and adapt it. It follows every convention the rest of the theme uses: scheme and grain options, split-text headline, reveal on entry, magnetic CTA, a preset so it appears in *Add section*, and no hard-coded UI strings.

```liquid
{%- liquid
  assign s = section.settings
  assign lines = s.title | newline_to_br | split: '<br />'
-%}
<section class="section scheme-{{ s.scheme }}{% if s.grain %} section-grain{% endif %}" aria-labelledby="Title-{{ section.id }}">
  <div class="page-width">
    {%- if s.eyebrow != blank -%}
      <p class="label muted section-head__eyebrow">{{ s.eyebrow }}</p>
    {%- endif -%}
    <h2 class="h2" id="Title-{{ section.id }}" data-split="chars">
      {%- for line in lines -%}
        {{ line | strip }}
        {%- unless forloop.last %}<br>{% endunless -%}
      {%- endfor -%}
    </h2>
    {%- if s.text != blank -%}
      <div class="rte body-lg muted" data-reveal>{{ s.text }}</div>
    {%- endif -%}
    {%- if s.image != blank -%}
      {%- assign alt = s.image.alt | default: '' -%}
      <div class="media-lit" data-parallax-scope data-reveal>
        <div data-parallax="0.15">
          {{ s.image | image_url: width: 1800 | image_tag: loading: 'lazy', widths: '480, 720, 960, 1200, 1500, 1800', sizes: '(min-width: 990px) 50vw, 92vw', alt: alt }}
        </div>
      </div>
    {%- endif -%}
    {%- if s.button_label != blank -%}
      <span class="magnetic" data-magnetic>
        <a class="btn btn--bone" href="{{ s.button_link }}"><span class="btn__label">{{ s.button_label }} {% render 'icon', icon: 'arrow' %}</span></a>
      </span>
    {%- endif -%}
  </div>
</section>

{% schema %}
{
  "name": "My section",
  "tag": "div",
  "class": "section-my-section",
  "settings": [
    { "type": "text", "id": "eyebrow", "label": "Eyebrow" },
    { "type": "textarea", "id": "title", "label": "Title", "info": "One line per row.", "default": "When we fall,\nwe rise." },
    { "type": "richtext", "id": "text", "label": "Text" },
    { "type": "image_picker", "id": "image", "label": "Image" },
    { "type": "text", "id": "button_label", "label": "Button label" },
    { "type": "url", "id": "button_link", "label": "Button link" },
    {
      "type": "select", "id": "scheme", "label": "Color scheme",
      "options": [ { "value": "dark", "label": "Black" }, { "value": "bone", "label": "Bone" } ],
      "default": "dark"
    },
    { "type": "checkbox", "id": "grain", "label": "Grain texture", "default": false }
  ],
  "presets": [ { "name": "My section" } ]
}
{% endschema %}
```

Checklist:
- Styles go in `base.css` (marketing sections) or the template CSS (`product.css`, `collection.css`…). Use `--fg/--bg/--line` so both schemes work, and define a mobile-first layout with `@media (min-width: 990px)` for desktop.
- A scroll scene should be a tall section plus a `position: sticky` stage, scrubbed from motion.js (`initSection` → your `initX(section, mm)` with `mm.add({ desktop, mobile })`). Return a cleanup function, and give reduced motion a static layout.
- Every image goes through `image_url` + `image_tag` with `widths` and `sizes`. Only the first big image of a template is eager/high priority.
- UI strings (not merchant copy) go in `locales/en.default.json`.
- Add the section to a JSON template if it's part of a default page. Then `npm run check`, `npm run preview`, `npm run test:browser`, and look at the screenshots.
