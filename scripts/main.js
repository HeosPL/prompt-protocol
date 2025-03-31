// main.js – module "cyberpunk-test-prompts"
const GM_PROMPT_DIALOG_TITLE = "Run Skill Test";

async function showPromptDialog() {
  // Assume the GM has an assigned character – we use game.user.character
  const actor = game.user.character;
  if (!actor) {
    ui.notifications.error("You don't have an assigned character!");
    return;
  }

  // Retrieve the actor's skills – assuming items of type "skill"
  const skills = actor.items.filter(i => i.type === "skill").map(i => i.name).sort();
  if (skills.length === 0) {
    ui.notifications.warn("Your character doesn't have any skills.");
    return;
  }

  const content = `
    <form>
      <div class="form-group">
        <label>Skill:</label>
        <select id="skill">
          ${skills.map(s => `<option value="${s}">${s}</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>DV (Difficulty Value):</label>
        <input type="number" id="dv" value="15"/>
      </div>
      <div class="form-group">
        <label>Situational Description (optional):</label>
        <input type="text" id="flavor" placeholder="e.g. Escape via roof under fire"/>
      </div>
    </form>
  `;

  new Dialog({
    title: GM_PROMPT_DIALOG_TITLE,
    content,
    buttons: {
      ok: {
        label: "Send to Chat",
        callback: (html) => {
          const skill = html.find("#skill").val();
          const dv = parseInt(html.find("#dv").val());
          const flavor = html.find("#flavor").val()?.trim() || "";
          // Append data needed for the roll to the chat message
          const message = `
<button class="skill-roll-button" data-skill="${skill}" data-dv="${dv}" data-flavor="${flavor}" data-actor-id="${actor.id}">
  🎲 Test: <strong>${skill}</strong> (DV ${dv}) ${flavor ? `— <em>${flavor}</em>` : ""}
  — Click to roll
</button>
          `;
          ChatMessage.create({
            content: message,
            flags: { "cyberpunk-test-prompts": { skill, dv, flavor, actorId: actor.id } }
          });
        }
      },
      cancel: {
        label: "Cancel"
      }
    }
  }).render(true);
}

// Chat button click handler
document.addEventListener("click", async (event) => {
  const button = event.target.closest(".skill-roll-button");
  if (!button) return;

  const skillName = button.dataset.skill;
  const dv = parseInt(button.dataset.dv);
  const flavor = button.dataset.flavor;
  const actorId = button.dataset.actorId;
  const actor = game.actors.get(actorId) || game.user.character;
  if (!actor) {
    ui.notifications.warn("Character for roll not found!");
    return;
  }

  // Find the skill item by name on the actor
  const skillItem = actor.items.find(i => i.name === skillName && i.type === "skill");
  if (!skillItem) {
    ui.notifications.error(`Skill not found: ${skillName}`);
    return;
  }

  // Retrieve attribute and skill level data
  const statKey = skillItem.system.stat;
  const statValue = actor.system.stats?.[statKey]?.value || 0;
  const skillValue = skillItem.system.level || 0;

  let rollResult;
  // If skillItem has a roll() method, use it
  if (typeof skillItem.roll === "function") {
    try {
      rollResult = await skillItem.roll();
    } catch (error) {
      console.error("Error during roll:", error);
      return;
    }
  } 
  // Otherwise, dynamically import the system roll classes
  else {
    try {
      const module = await import("/systems/cyberpunk-red-core/modules/rolls/cpr-rolls.js");
      const { CPRSkillRoll } = module;
      if (!CPRSkillRoll) {
        ui.notifications.error("CPRSkillRoll class not found.");
        return;
      }
      // Create an instance of CPRSkillRoll
      const rollInstance = new CPRSkillRoll(statKey, statValue, skillItem.name, skillValue);
      
      // Invoke the default roll dialog (using a dummy event)
      const dummyEvent = new Event("click");
      const proceed = await rollInstance.handleRollDialog(dummyEvent, actor, skillItem);
      if (!proceed) return;
      
      // Execute the roll
      await rollInstance.roll();
      rollResult = rollInstance;
    } catch (e) {
      ui.notifications.error("Error importing CPRSkillRoll: " + e);
      return;
    }
  }

  // Assume the final roll result is in rollResult.resultTotal
  const finalTotal = rollResult?.resultTotal ?? 0;
  const success = finalTotal > dv;
  const resultText = success
    ? `<span style="color:green;">✔ SUCCESS</span>`
    : `<span style="color:red;">✘ FAILURE</span>`;

  // Build detailed report if available
  let detailedReport = "";
  if (rollResult && rollResult.initialRoll !== undefined) {
    const modsReport = (rollResult.mods && rollResult.mods.length)
      ? `<ul>${rollResult.mods.map(mod => `<li>${mod.source}: ${mod.value > 0 ? '+' : ''}${mod.value}</li>`).join('')}</ul>`
      : "No modifiers";
    const additionalModsReport = (rollResult.additionalMods && rollResult.additionalMods.length)
      ? `<ul>${rollResult.additionalMods.map(m => `<li>Additional mod: ${m}</li>`).join('')}</ul>`
      : "";

    // Add critical roll info if available
    const critReport = (rollResult.criticalRoll && rollResult.criticalRoll !== 0)
      ? (rollResult.wasCritSuccess && rollResult.wasCritSuccess() 
            ? `<li>Critical Success, bonus: ${rollResult.criticalRoll}</li>`
            : (rollResult.wasCritFail && rollResult.wasCritFail() 
                ? `<li>Critical Failure, penalty: ${rollResult.criticalRoll}</li>`
                : ""))
      : "";

    detailedReport = `
    <details>
      <summary>Detailed Report</summary>
      <ul>
        <li>d10 Roll (result): ${rollResult.initialRoll}</li>
        <li>Attribute Value (${statKey}): ${statValue}</li>
        <li>Skill Level (${skillName}): ${skillValue}</li>
        <li>Modifiers: ${modsReport} ${additionalModsReport}</li>
        <li>Total Modifier: ${rollResult.totalMods()}</li>
        <li>Luck used: ${rollResult.luck}</li>
        ${critReport}
        <li>Final Result: ${rollResult.resultTotal}</li>
      </ul>
    </details>
    `;
  }

  const messageContent = `
Test <strong>${skillName}</strong> rolled by <em>${actor.name}</em><br>
Result: <strong>${finalTotal}</strong> vs DV <strong>${dv}</strong><br>
${resultText}<br>
${flavor ? `<em>${flavor}</em><br>` : ""}
${detailedReport}
  `;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: messageContent
  });
});

// Add button to the main Scene Controls (visible only for the GM)
Hooks.on("getSceneControlButtons", (controls) => {
  if (!game.user.isGM) return;
  controls.push({
    name: "cyberpunk-test-prompts",
    title: "Cyberpunk Test Prompts",
    icon: "fas fa-dice",
    layer: "controls",
    tools: [{
      name: "open-test-dialog",
      title: "Run Skill Test",
      icon: "fas fa-dice-d20",
      onClick: () => showPromptDialog(),
      button: true
    }]
  });
});

// Log message after module is loaded
Hooks.once("ready", () => {
  console.log("[Cyberpunk Test Prompts] Module active – using built-in roll tools");
});
