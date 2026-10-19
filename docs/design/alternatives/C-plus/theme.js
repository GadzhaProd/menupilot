// Original mock-only theme controller. Never touches the app document/storage key.
(()=>{const key="menupilot.design.cplus.theme.v1";const mq=matchMedia("(prefers-color-scheme: dark)");let preference="system";
try{const saved=localStorage.getItem(key);if(["light","dark","system"].includes(saved))preference=saved;}catch{}
const apply=()=>{document.documentElement.dataset.theme=preference==="system"?(mq.matches?"dark":"light"):preference;document.documentElement.dataset.themePreference=preference;};apply();mq.addEventListener("change",()=>{if(preference==="system")apply();});
addEventListener("storage",e=>{if(e.key===key){preference=["light","dark","system"].includes(e.newValue)?e.newValue:"system";apply();const s=document.querySelector("#theme");if(s)s.value=preference;}});
addEventListener("DOMContentLoaded",()=>{const select=document.querySelector("#theme");select.value=preference;select.addEventListener("change",()=>{preference=select.value;apply();try{localStorage.setItem(key,preference);}catch{document.querySelector("#theme-note").hidden=false;}});
for(const radio of document.querySelectorAll("[name=scenario]")){radio.addEventListener("change",()=>{const active=radio.value;for(const panel of document.querySelectorAll("[data-panel]"))panel.hidden=panel.dataset.panel!==active;for(const cell of document.querySelectorAll("[data-scenario]"))cell.classList.toggle("selected",cell.dataset.scenario===active);});}});
})();
