<script>
// YAML specification for the `holidays` setting.

import { TEMPLATES, TEMPLATE_CATEGORIES } from '../templates.js';

export default {
  name: 'ReferenceView',
  setup() {
    const groups = TEMPLATE_CATEGORIES.map((c) => ({ ...c, templates: TEMPLATES.filter((t) => t.category === c.id) }))
      .filter((g) => g.templates.length);
    return { groups, scrollToSection: (id) => document.getElementById(id)?.scrollIntoView() };
  },
};
</script>
<template>

    <section class="docs">
      <h1 id="reference">Guide &amp; reference</h1>
      <p>The plugin’s <strong>Holidays</strong> setting is a YAML list. Each holiday is an object with the following fields.
        The <strong>Upcoming holiday to display</strong> setting selects which upcoming date is displayed: 1 is the next date. Holidays on the same date count together.</p>
      <nav class="reference-nav" aria-label="Reference sections"><a href="#reference" @click.prevent="scrollToSection('ref-fields')">Fields</a><a href="#reference" @click.prevent="scrollToSection('ref-date')">Date rules</a><a href="#reference" @click.prevent="scrollToSection('templates')">Templates</a><a href="#reference" @click.prevent="scrollToSection('signin')">Saving to TRMNL</a></nav>

      <h3 id="ref-fields"><code>name</code> <small>(string, required)</small></h3>
      <p>The display name of the holiday, shown on the TRMNL screen. Can be any text.</p>
      <pre class="yaml-example"><code class="language-yaml"><span class="yaml-key">name</span>: <span class="yaml-string">Christmas Day</span></code></pre>

      <h3 id="ref-date"><code>date</code> <small>(string, required)</small></h3>
      <p>A date expression specifying when the holiday occurs. Four formats are supported:</p>
      <div class="table-scroll">
        <table>
          <thead><tr><th>Format</th><th>Pattern</th><th>Example</th><th>Meaning</th></tr></thead>
          <tbody>
            <tr><td>Absolute date</td><td><code>YYYY-MM-DD</code></td><td><code>2038-01-19</code></td><td>A single, one-time date. 19th January, 2038.</td></tr>
            <tr><td>Annual date</td><td><code>MM-DD</code></td><td><code>12-25</code></td><td>Recurring yearly on the same month and day. 25th December every year.</td></tr>
            <tr><td><var>n</var>-th weekday of month</td><td><code>MMWn-D</code></td><td><code>08W2-5</code></td>
              <td>The <var>n</var>-th occurrence of a weekday in a month. 2nd Friday of August.<br>
                <code>MM</code> = month (01–12), <code>n</code> = occurrence (1–5), <code>D</code> = weekday (1=Mon … 7=Sun).</td></tr>
            <tr><td>Last <var>n</var>-th weekday of month</td><td><code>MMWnN-D</code></td><td><code>05Wn1-1</code></td>
              <td>The <var>n</var>-th-to-last weekday in a month. Last Monday of May.<br>
                <code>MM</code> = month, <code>N</code> = position from end (1–5), <code>D</code> = weekday.</td></tr>
          </tbody>
        </table>
      </div>

      <h4>Calendar suffix <small>(optional)</small></h4>
      <p>Append <code>[u-ca=<var>calendar</var>]</code> to any date format to use a non-Gregorian calendar system. The date numbers then refer to months/days in that calendar.</p>
      <pre class="yaml-example"><code class="language-yaml"><span class="yaml-key">date</span>: <span class="yaml-string">"01-01[u-ca=chinese]"</span>   <span class="yaml-comment"># Chinese New Year (1st of 1st month in Chinese calendar)</span></code></pre>
      <p>Supported calendars include: <code>chinese</code>, <code>dangi</code>, <code>islamic-umalqura</code>, <code>hebrew</code>, <code>japanese</code>, <code>persian</code>, <code>indian</code>, <code>buddhist</code>, and others.
        See <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/supportedValuesOf#supported_calendar_types">MDN: supported calendar types</a> for the full list.</p>
      <p>Month numbers follow the calendar’s own month order. In lunisolar calendars with leap months (Chinese, Korean, Hebrew) the numbers refer to the regular months;
        for example in the Hebrew calendar <code>01</code> is Tishrei and <code>07</code> is Nisan.</p>

      <h3><code>icon</code> <small>(string, required)</small></h3>
      <p>An <a href="https://iconify.design/">Iconify</a> icon identifier displayed alongside the holiday. Format: <code>prefix:icon-name</code>.</p>
      <pre class="yaml-example"><code class="language-yaml"><span class="yaml-key">icon</span>: <span class="yaml-string">fluent-emoji-flat:fireworks</span></code></pre>
      <p>Browse available icons at <a href="https://icon-sets.iconify.design/">Iconify Icon Sets</a>.</p>

      <h3><code>round</code> <small>(array of integers, optional)</small></h3>
      <p>If the resolved date falls on a day <em>not</em> in this list, it is shifted to the nearest day that is. Each integer represents an ISO weekday: <code>1</code> = Monday, <code>2</code> = Tuesday, … <code>7</code> = Sunday.</p>
      <pre class="yaml-example"><code class="language-yaml"><span class="yaml-key">round</span>: [<span class="yaml-number">1</span>, <span class="yaml-number">2</span>, <span class="yaml-number">3</span>, <span class="yaml-number">4</span>, <span class="yaml-number">5</span>]   <span class="yaml-comment"># Round to nearest weekday (Mon–Fri)</span></code></pre>
      <p>Omit this field (or use an empty array) to disable rounding.</p>

      <h3>Complete Example</h3>
      <pre class="yaml-example"><code class="language-yaml">- <span class="yaml-key">name</span>: <span class="yaml-string">Christmas Day</span>
  <span class="yaml-key">date</span>: <span class="yaml-string">"12-25"</span>
  <span class="yaml-key">icon</span>: <span class="yaml-string">fluent-emoji-flat:fireworks</span>
  <span class="yaml-key">round</span>: [<span class="yaml-number">1</span>, <span class="yaml-number">2</span>, <span class="yaml-number">3</span>, <span class="yaml-number">4</span>, <span class="yaml-number">5</span>]
- <span class="yaml-key">name</span>: <span class="yaml-string">Year 2038 problem</span>
  <span class="yaml-key">date</span>: <span class="yaml-string">"2038-01-19"</span>
  <span class="yaml-key">icon</span>: <span class="yaml-string">mdi:cpu-32-bit</span>
- <span class="yaml-key">name</span>: <span class="yaml-string">US Memorial Day</span>
  <span class="yaml-key">date</span>: <span class="yaml-string">"05Wn1-1"</span>
  <span class="yaml-key">icon</span>: <span class="yaml-string">fluent-emoji-flat:reindeer-ribbon</span>
- <span class="yaml-key">name</span>: <span class="yaml-string">Chinese New Year</span>
  <span class="yaml-key">date</span>: <span class="yaml-string">"01-01[u-ca=chinese]"</span>
  <span class="yaml-key">icon</span>: <span class="yaml-string">fluent-emoji-flat:red-envelope</span></code></pre>

      <h3 id="templates">Templates</h3>
      <p>Both editors can start a list from a template or add template entries to an existing list. When adding, entries already in your list (same name and date) are skipped by default.
        Some templates ask for details such as a birthday or payday. Holidays based on Easter, astronomical events, or official announcements can't be expressed exactly with these date formats; such limitations are noted in the template.</p>
      <dl class="template-reference">
        <template v-for="g in groups" :key="g.id">
          <dt>{{ g.title }}</dt>
          <dd>{{ g.templates.map(t => t.title).join(' · ') }}</dd>
        </template>
      </dl>

      <h3 id="signin">Saving directly to TRMNL</h3>
      <p><a href="#trmnl">Edit my TRMNL plugins</a> signs in with your TRMNL account (or an account API key) and lists your Custom Next Holiday plugins.
        Changes are saved to TRMNL only when you press <strong>Save to TRMNL</strong>; you'll be warned before leaving with unsaved changes.
        <strong>Copy to other plugins</strong> replaces the holidays list (not the other settings) of the plugins you pick.
        Sign-in tokens are kept only in this browser and are used only to talk to TRMNL.</p>
    </section>
</template>
