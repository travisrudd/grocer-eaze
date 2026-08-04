export type RecipeInstructionSection = {
  name: string;
  steps: string[];
};

export type RecipeReaderContent = {
  title: string;
  sourceName: string;
  sourceUrl: string;
  readyInMinutes: number;
  servings: number;
  ingredients: string[];
  instructions: RecipeInstructionSection[];
  extractionStatus: "complete" | "pending" | "unavailable";
};

const namedEntities: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

function decodeEntities(value: string) {
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (entity, code: string) => {
    const normalized = code.toLowerCase();
    if (normalized.startsWith("#x")) {
      const point = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    }
    if (normalized.startsWith("#")) {
      const point = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    }
    return namedEntities[normalized] || entity;
  });
}

export function cleanRecipeText(value: unknown, maxLength = 2_000) {
  return decodeEntities(String(value || "")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*\/\s*(?:li|p|div|h\d)\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " "))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
}

function instructionSteps(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(instructionSteps).slice(0, 100);
  if (typeof value === "string") {
    const cleaned = cleanRecipeText(value, 30_000);
    if (!cleaned) return [];
    const lines = cleaned.split(/\n+/).map((line) => line.replace(/^\s*(?:step\s*)?\d+[.):\-]\s*/i, "").trim()).filter(Boolean);
    return (lines.length > 1 ? lines : [cleaned]).slice(0, 100).map((step) => step.slice(0, 2_000));
  }
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.steps)) return record.steps.flatMap(instructionSteps).slice(0, 100);
  if (Array.isArray(record.itemListElement)) return record.itemListElement.flatMap(instructionSteps).slice(0, 100);
  const text = cleanRecipeText(record.text || record.step || record.description || record.name);
  return text ? [text] : [];
}

export function normalizeRecipeInstructions(value: unknown): RecipeInstructionSection[] {
  if (!value) return [];
  if (typeof value === "string") {
    const steps = instructionSteps(value);
    return steps.length ? [{ name: "", steps }] : [];
  }
  const values = Array.isArray(value) ? value : [value];
  const sections: RecipeInstructionSection[] = [];
  for (const item of values) {
    if (typeof item === "string") {
      const steps = instructionSteps(item);
      if (steps.length) sections.push({ name: "", steps });
      continue;
    }
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    const nestedSections = Array.isArray(record.itemListElement)
      ? record.itemListElement.filter((entry) => entry && typeof entry === "object" && /HowToSection/i.test(String((entry as Record<string, unknown>)["@type"] || "")))
      : [];
    if (nestedSections.length) {
      sections.push(...normalizeRecipeInstructions(nestedSections));
      continue;
    }
    const steps = instructionSteps(record.steps || record.itemListElement || record.text || record.description || item);
    if (!steps.length) continue;
    const name = /HowToStep/i.test(String(record["@type"] || "")) ? "" : cleanRecipeText(record.name, 120);
    sections.push({ name, steps });
  }
  return sections.reduce<RecipeInstructionSection[]>((merged, section) => {
    const previous = merged.at(-1);
    if (!section.name && previous && !previous.name) previous.steps.push(...section.steps.slice(0, Math.max(0, 100 - previous.steps.length)));
    else merged.push({ ...section, steps: [...section.steps] });
    return merged;
  }, []).slice(0, 30);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character] || character);
}

function readerPlainText(content: RecipeReaderContent, readerUrl: string) {
  const details = [
    content.readyInMinutes ? `${content.readyInMinutes} minutes` : "",
    content.servings ? `${content.servings} servings` : "",
  ].filter(Boolean).join(" · ");
  const ingredients = content.ingredients.length ? `Ingredients\n${content.ingredients.map((item) => `- ${item}`).join("\n")}` : "";
  const instructions = content.instructions.length
    ? `Directions\n${content.instructions.flatMap((section) => [section.name, ...section.steps.map((step, index) => `${index + 1}. ${step}`)]).filter(Boolean).join("\n")}`
    : "Directions are not available in a clean format yet.";
  return [content.title, `Source: ${content.sourceName}`, details, ingredients, instructions, `Clean recipe: ${readerUrl}`, `Original recipe: ${content.sourceUrl}`].filter(Boolean).join("\n\n");
}

export function renderRecipeReader(content: RecipeReaderContent, readerUrl: string) {
  const title = escapeHtml(content.title);
  const sourceName = escapeHtml(content.sourceName);
  const sourceUrl = escapeHtml(content.sourceUrl);
  const encodedTitle = escapeHtml(content.title);
  const plainText = escapeHtml(readerPlainText(content, readerUrl));
  const details = [
    content.readyInMinutes ? `${content.readyInMinutes} min` : "",
    content.servings ? `${content.servings} servings` : "",
  ].filter(Boolean);
  const directions = content.instructions.length
    ? content.instructions.map((section) => `<section class="recipe-section">${section.name ? `<h3>${escapeHtml(section.name)}</h3>` : ""}<ol>${section.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}</ol></section>`).join("")
    : `<div class="reader-notice"><h3>Clean directions aren’t available yet.</h3><p>This publisher did not provide instructions in a format Grocer-Eaze could safely extract. The original recipe is still available below.</p></div>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>${title} | Grocer-Eaze Recipe Reader</title>
  <style>
    :root{color-scheme:light;--ink:#183329;--muted:#5f6f67;--green:#126b4d;--soft:#eef8f1;--line:#d8e4dc;--paper:#fffdf8;--radius:16px}*{box-sizing:border-box}html{background:#f5f4ed}body{margin:0;color:var(--ink);font:16px/1.55 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.skip{position:absolute;left:12px;top:-80px;background:#fff;color:var(--ink);padding:10px 14px;border-radius:8px;z-index:2}.skip:focus{top:12px}.shell{width:min(760px,calc(100% - 32px));margin:0 auto;padding:24px 0 64px}.brand{display:inline-flex;align-items:center;gap:10px;color:var(--ink);font-weight:800;text-decoration:none}.mark{display:grid;place-items:center;width:36px;height:36px;border-radius:50%;background:var(--green);color:#fff;font-size:19px}.recipe{margin-top:24px;background:var(--paper);border:1px solid var(--line);border-radius:24px;padding:clamp(24px,6vw,52px);box-shadow:0 12px 36px rgba(24,51,41,.08)}.eyebrow{margin:0 0 8px;color:var(--green);font-size:.76rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}h1{margin:0;font:800 clamp(2rem,8vw,3.6rem)/1.02 Georgia,serif;letter-spacing:-.035em}h2{margin:36px 0 12px;font-size:1.35rem}h3{margin:24px 0 8px;font-size:1.05rem}.meta{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 4px;color:var(--muted)}.meta span+span:before{content:"·";margin-right:8px}.source{color:var(--green);font-weight:700}.ingredients{padding-left:1.25rem}.ingredients li,.recipe-section li{margin:.55rem 0}.recipe-section ol{padding-left:1.4rem}.reader-notice{margin-top:20px;padding:18px;border:1px solid #ead8a8;border-radius:var(--radius);background:#fff9e8}.reader-notice h3{margin-top:0}.original{display:inline-flex;min-height:44px;align-items:center;margin-top:12px;color:var(--green);font-weight:800}.share{margin-top:32px;padding-top:28px;border-top:1px solid var(--line)}.share>p{color:var(--muted)}.actions{display:grid;gap:12px}.action{border:1px solid var(--line);border-radius:var(--radius);padding:16px;background:#fff}.action label{display:block;margin-bottom:8px;font-weight:750}.action-row{display:flex;gap:8px}.action input{min-width:0;flex:1;height:44px;border:1px solid #aebdb4;border-radius:10px;padding:0 12px;font:inherit}.action input:focus-visible,.action button:focus-visible,.original:focus-visible,.brand:focus-visible{outline:3px solid #e8a85c;outline-offset:3px}button{min-height:44px;border:0;border-radius:10px;padding:0 15px;background:var(--green);color:#fff;font:700 .95rem/1 ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;cursor:pointer}.secondary{background:var(--soft);color:var(--green)}.status{min-height:1.5em;margin:12px 0 0;color:var(--green);font-weight:700}.fine-print{margin:24px 0 0;color:var(--muted);font-size:.9rem}@media(max-width:560px){.shell{width:min(100% - 20px,760px);padding-top:12px}.recipe{padding:22px 18px;border-radius:18px}.action-row{align-items:stretch;flex-direction:column}.action-row button{width:100%}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
  </style>
</head>
<body data-title="${encodedTitle}">
  <a class="skip" href="#recipe">Skip to recipe</a>
  <main class="shell" id="recipe">
    <a class="brand" href="/"><span class="mark" aria-hidden="true">g</span><span>Grocer-Eaze</span></a>
    <article class="recipe">
      <p class="eyebrow">Clean recipe reader</p>
      <h1>${title}</h1>
      <p class="meta"><span>From ${sourceName}</span>${details.map((detail) => `<span>${escapeHtml(detail)}</span>`).join("")}</p>
      ${content.ingredients.length ? `<h2>Ingredients</h2><ul class="ingredients">${content.ingredients.map((ingredient) => `<li>${escapeHtml(ingredient)}</li>`).join("")}</ul>` : ""}
      <h2>Directions</h2>
      ${directions}
      <a class="original" href="${sourceUrl}" target="_blank" rel="noopener noreferrer">View the original recipe and publisher notes ↗</a>
      <section class="share" aria-labelledby="share-title">
        <h2 id="share-title">Keep or share this recipe</h2>
        <p>Copy the full clean recipe, or open an addressed email or text draft containing this reader link. You’ll review the message before sending.</p>
        <div class="actions">
          <div class="action"><button class="secondary" id="copy-recipe" type="button">Copy clean recipe</button></div>
          <form class="action" id="email-form" novalidate><label for="email-recipients">Email recipients</label><div class="action-row"><input id="email-recipients" type="text" inputmode="email" autocomplete="email" placeholder="you@example.com, family@example.com" aria-describedby="reader-status"><button type="submit">Open email draft</button></div></form>
          <form class="action" id="text-form" novalidate><label for="text-recipient">Text recipient</label><div class="action-row"><input id="text-recipient" type="tel" inputmode="tel" autocomplete="tel" placeholder="(312) 555-0123" aria-describedby="reader-status"><button type="submit">Open text draft</button></div></form>
        </div>
        <p class="status" id="reader-status" role="status" aria-live="polite"></p>
        <p class="fine-print">Recipe text is derived from structured information supplied by the publisher and may not capture every note or variation. Check the original recipe when precision matters.</p>
      </section>
      <textarea id="recipe-text" hidden>${plainText}</textarea>
    </article>
  </main>
  <script>
    (() => {
      const status = document.getElementById("reader-status");
      const fullText = document.getElementById("recipe-text").value;
      const title = document.body.dataset.title || "Recipe";
      const shareText = title + "\\n" + window.location.href;
      const setStatus = (message, error = false) => { status.textContent = message; status.style.color = error ? "#9b2c2c" : "#126b4d"; };
      document.getElementById("copy-recipe").addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(fullText); setStatus("Clean recipe copied to your clipboard."); }
        catch { setStatus("Your browser blocked clipboard access. Select the recipe text and copy it manually.", true); }
      });
      document.getElementById("email-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const input = document.getElementById("email-recipients");
        const recipients = [...new Set(input.value.split(/[;,\\n]/).map((value) => value.trim().toLowerCase()).filter(Boolean))];
        const valid = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
        if (!recipients.length || recipients.length > 10 || recipients.some((recipient) => !valid.test(recipient))) { setStatus("Enter up to 10 valid email addresses.", true); input.focus(); return; }
        setStatus("Email draft opened. Review it before sending.");
        window.location.href = "mailto:" + recipients.map(encodeURIComponent).join(",") + "?subject=" + encodeURIComponent(title) + "&body=" + encodeURIComponent(shareText);
      });
      document.getElementById("text-form").addEventListener("submit", (event) => {
        event.preventDefault();
        const input = document.getElementById("text-recipient");
        const raw = input.value.trim();
        const digits = raw.replace(/\\D/g, "");
        if (digits.length < 7 || digits.length > 15) { setStatus("Enter a valid phone number with 7 to 15 digits.", true); input.focus(); return; }
        const recipient = raw.startsWith("+") ? "+" + digits : digits;
        setStatus("Text draft opened. Review it before sending.");
        window.location.href = "sms:" + encodeURIComponent(recipient) + "?&body=" + encodeURIComponent(shareText);
      });
    })();
  </script>
</body>
</html>`;
}
