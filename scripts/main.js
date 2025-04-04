let CachedSkills = [];

Hooks.once("ready", () => {
  const skillSet = new Set();

  for (const actor of game.actors.contents) {
    for (const item of actor.items) {
      if (item.type === "skill") {
        skillSet.add(item.name);
      }
    }
  }

  CachedSkills = Array.from(skillSet).sort();
});

async function getAllSystemSkills() {
  return CachedSkills;
}

Hooks.once("init", () => {
  window.GMTools = window.GMTools || {
    tools: [],
    registerTool: function(tool) {
      this.tools.push(tool);
    }
  };

  GMTools.registerTool({
    name: "prompt-protocol",
    title: "Run Skill Test",
    icon: "fas fa-dice-d20",
    onClick: () => showPromptDialog()
  });
});

async function showPromptDialog() {

  const skills = await getAllSystemSkills();
  if (!skills.length) {
    ui.notifications.error("No skills found.");
    return;
  }

  const skillOptions = skills.map(s => `<option value="${s}">${s}</option>`).join("");

  const content = `
    <form>
      <div class="form-group">
        <label>Skill:</label>
        <select id="skill">${skillOptions}</select>
      </div>
      <div class="form-group">
        <label>DV:</label>
        <input type="number" id="dv" value="15"/>
      </div>
      <div class="form-group">
        <label>Description (optional):</label>
        <input type="text" id="flavor" placeholder="e.g. Under fire while climbing"/>
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="hideDv"/> Hide DV from players</label>
      </div>
    </form>
  `;

  new Dialog({
    title: "Run Skill Test",
    content,
    buttons: {
      ok: {
        label: "Send to Chat",
        callback: (html) => {
          const skill = html.find("#skill").val();
          const dv = parseInt(html.find("#dv").val());
          const flavor = html.find("#flavor").val()?.trim() || "";
          const hideDv = html.find("#hideDv").is(":checked");

          const message = `
<button class="skill-roll-button" data-skill="${skill}" data-dv="${dv}" data-hidedv="${hideDv}" data-flavor="${flavor}">
  🎲 Test: <strong>${skill}</strong>${!hideDv ? ` (DV ${dv})` : ""} ${flavor ? `— <em>${flavor}</em>` : ""}
  — Click to roll
</button>
          `;

          ChatMessage.create({
            content: message,
            flags: { "prompt-protocol": { skill, dv, flavor, hideDv } }
          });
        }
      },
      cancel: { label: "Cancel" }
    }
  }).render(true);
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest(".skill-roll-button");
  if (!button) return;

  const skillName = button.dataset.skill;
  const dv = parseInt(button.dataset.dv);
  const flavor = button.dataset.flavor;
  const hideDv = button.dataset.hidedv === "true";
  const actorId = button.dataset.actorId;

  const actor = game.actors.get(actorId) || game.user.character;
  if (!actor) {
    ui.notifications.warn("Character not found!");
    return;
  }

  const skillItem = actor.items.find(i => i.name === skillName && i.type === "skill");
  if (!skillItem) {
    ui.notifications.error(`Skill not found: ${skillName}`);
    return;
  }

  const statKey = skillItem.system.stat;
  const statValue = actor.system.stats?.[statKey]?.value || 0;
  const skillValue = skillItem.system.level || 0;
  let rollResult;

  try {
    const module = await import("/systems/cyberpunk-red-core/modules/rolls/cpr-rolls.js");
    const { CPRSkillRoll } = module;
    if (!CPRSkillRoll) {
      ui.notifications.error("CPRSkillRoll not found.");
      return;
    }
    const rollInstance = new CPRSkillRoll(statKey, statValue, skillItem.name, skillValue);
    const dummyEvent = new Event("click");
    const proceed = await rollInstance.handleRollDialog(dummyEvent, actor, skillItem);
    if (!proceed) return;
    await rollInstance.roll();
    rollResult = rollInstance;
  } catch (e) {
    ui.notifications.error("Error during roll: " + e);
    return;
  }

  const finalTotal = rollResult?.resultTotal ?? 0;
  const success = finalTotal > dv;
  const resultText = success
    ? `<span style="color:green;">✔ SUCCESS</span>`
    : `<span style="color:red;">✘ FAILURE</span>`;

  const detailedReport = rollResult?.initialRoll !== undefined ? `
    <details>
      <summary>Details</summary>
      <ul>
        <li>d10 Roll: ${rollResult.initialRoll}</li>
        <li>Attribute (${statKey}): ${statValue}</li>
        <li>Skill (${skillName}): ${skillValue}</li>
        <li>Modifiers: ${rollResult.totalMods()}</li>
        <li>Luck used: ${rollResult.luck}</li>
        <li>Final Result: ${rollResult.resultTotal}</li>
      </ul>
    </details>
  ` : "";

  const messageContent = `
Test <strong>${skillName}</strong> by <em>${actor.name}</em><br/>
Result: <strong>${finalTotal}</strong>${!hideDv ? ` vs DV <strong>${dv}</strong>` : ""}<br/>
${resultText}<br/>
${flavor ? `<em>${flavor}</em><br/>` : ""}
${detailedReport}
  `;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: messageContent
  });
});

Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) return;
  let gmTools = controls.find(c => c.name === "gm-tools");
  if (!gmTools) {
    gmTools = {
      name: "gm-tools",
      title: "GM Tools",
      icon: "fas fa-tools",
      layer: "controls",
      tools: []
    };
    controls.push(gmTools);
  }
  if (window.GMTools?.tools) {
    gmTools.tools = window.GMTools.tools;
  }
});
