/* "See you soon" page: says goodbye by name (the first name only, kept in this tab and removed straight away). */
(() => {
  let who = "";
  try { who = sessionStorage.getItem("pm:who") || ""; sessionStorage.removeItem("pm:who"); } catch { /* ignore */ }
  const el = document.getElementById("byeTitle");
  if (el && who) el.textContent = `Bye-bye for now, ${who.slice(0, 40)}!`;
  const h = new Date().getHours(), sub = document.getElementById("byeWish");
  if (sub) sub.textContent = h >= 19 || h < 5 ? "Sweet dreams! 🌙 The memory box will be here tomorrow."
    : h < 12 ? "Have a lovely day! ☀️ Come back soon, there are more giggles waiting."
    : "Enjoy the rest of your day! 🌈 Come back soon, there are more giggles waiting.";
})();
