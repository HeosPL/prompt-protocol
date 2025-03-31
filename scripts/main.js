// main.js – Prompt Protocol with GM Tools integration

// Function to show the prompt dialog for running a skill test
async function showPromptDialog() {
  const actor = game.user.character;
  if (!actor) {
    ui.notifications.error("You don't have an assigned character!");
    return;
  }
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
    title: "Run Skill Test",
    content,
    buttons: {
      ok: {
        label: "Send to Chat",
        callback: (html) => {
          const skill = html.find("#skill").val();
          const dv = parseInt(html.find("#dv").val());
          const flavor = html.find("#flavor").val()?.trim() || "";
          const message = `
<button class="skill-roll-button" data-skill="${skill}" data-dv="${dv}" data-flavor="${flavor}" data-actor-id="${actor.id}">
  🎲 Test: <strong>${skill}</strong> (DV ${dv}) ${flavor ? `— <em>${flavor}</em>` : ""}
  — Click to roll
</button>
          `;
          ChatMessage.create({
            content: message,
            flags: { "prompt-protocol": { skill, dv, flavor, actorId: actor.id } }
          });
        }
      },
      cancel: { label: "Cancel" }
    }
  }).render(true);
}

// Event listener for clicking the chat button that executes the roll
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
  
  if (typeof skillItem.roll === "function") {
    try {
      rollResult = await skillItem.roll();
    } catch (error) {
      console.error("Error during roll:", error);
      return;
    }
  } else {
    try {
      const module = await import("/systems/cyberpunk-red-core/modules/rolls/cpr-rolls.js");
      const { CPRSkillRoll } = module;
      if (!CPRSkillRoll) {
        ui.notifications.error("CPRSkillRoll class not found.");
        return;
      }
      const rollInstance = new CPRSkillRoll(statKey, statValue, skillItem.name, skillValue);
      const dummyEvent = new Event("click");
      const proceed = await rollInstance.handleRollDialog(dummyEvent, actor, skillItem);
      if (!proceed) return;
      await rollInstance.roll();
      rollResult = rollInstance;
    } catch (e) {
      ui.notifications.error("Error importing CPRSkillRoll: " + e);
      return;
    }
  }

  const finalTotal = rollResult?.resultTotal ?? 0;
  const success = finalTotal > dv;
  const resultText = success
    ? `<span style="color:green;">✔ SUCCESS</span>`
    : `<span style="color:red;">✘ FAILURE</span>`;

  let detailedReport = "";
  if (rollResult && rollResult.initialRoll !== undefined) {
    const modsReport = (rollResult.mods && rollResult.mods.length)
      ? `<ul>${rollResult.mods.map(mod => `<li>${mod.source}: ${mod.value > 0 ? '+' : ''}${mod.value}</li>`).join('')}</ul>`
      : "No modifiers";
    const additionalModsReport = (rollResult.additionalMods && rollResult.additionalMods.length)
      ? `<ul>${rollResult.additionalMods.map(m => `<li>Additional mod: ${m}</li>`).join('')}</ul>`
      : "";
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

// Register GM Tools global API and our tool
Hooks.once("ready", () => {
  // Create a global GMTools API object if it doesn't exist
  window.GMTools = window.GMTools || {
    tools: [],
    /**
     * Registers a new GM tool.
     * @param {Object} tool - { name, title, icon, onClick }
     */
    registerTool: function(tool) {
      this.tools.push(tool);
    }
  };

  // Register our Prompt Protocol tool under GMTools
  GMTools.registerTool({
    name: "prompt-protocol",
    title: "Run Skill Test",
    icon: "fas fa-dice-d20",
    onClick: () => showPromptDialog()
  });

  console.log("GMTools API registered:", window.GMTools);
});

// Modify Scene Controls to include a "GM Tools" category populated by GMTools.tools
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
  if (window.GMTools && window.GMTools.tools) {
    gmTools.tools = window.GMTools.tools;
  }
});
