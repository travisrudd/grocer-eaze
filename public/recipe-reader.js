(() => {
  const status = document.getElementById("reader-status");
  const recipeText = document.getElementById("recipe-text");
  if (!status || !(recipeText instanceof HTMLTextAreaElement)) return;
  const fullText = recipeText.value;
  const title = document.body.dataset.title || "Recipe";
  const shareText = `${title}\n${window.location.href}`;
  const setStatus = (message, error = false) => {
    status.textContent = message;
    status.classList.toggle("error", error);
  };
  document.getElementById("copy-recipe")?.addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(fullText); setStatus("Clean recipe copied to your clipboard."); }
    catch { setStatus("Your browser blocked clipboard access. Select the recipe text and copy it manually.", true); }
  });
  document.getElementById("email-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("email-recipients");
    if (!(input instanceof HTMLInputElement)) return;
    const recipients = [...new Set(input.value.split(/[;,\n]/).map((value) => value.trim().toLowerCase()).filter(Boolean))];
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!recipients.length || recipients.length > 10 || recipients.some((recipient) => !valid.test(recipient))) { setStatus("Enter up to 10 valid email addresses.", true); input.focus(); return; }
    setStatus("Email draft opened. Review it before sending.");
    window.location.href = `mailto:${recipients.map(encodeURIComponent).join(",")}?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(shareText)}`;
  });
  document.getElementById("text-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = document.getElementById("text-recipient");
    if (!(input instanceof HTMLInputElement)) return;
    const raw = input.value.trim();
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) { setStatus("Enter a valid phone number with 7 to 15 digits.", true); input.focus(); return; }
    const recipient = raw.startsWith("+") ? `+${digits}` : digits;
    setStatus("Text draft opened. Review it before sending.");
    window.location.href = `sms:${encodeURIComponent(recipient)}?&body=${encodeURIComponent(shareText)}`;
  });
})();
