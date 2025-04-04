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

// main.js – Prompt Protocol with GM Tools integration

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
        <label for="skill">Select Skill:</label>
        <select id="skill" name="skill">${skillOptions}</select>
      </div>
      <div class="form-group">
        <label for="flavor">Optional Description:</label>
        <input type="text" id="flavor" name="flavor" placeholder="e.g. Climbing wall in the rain"/>
      </div>
      <div class="form-group">
        <label for="dv">Difficulty Value (DV):</label>
        <input type="number" id="dv" name="dv" value="13"/>
      </div>
    </form>
  `;

  new Dialog({
    title: "Skill Test Prompt",
    content,
    buttons: {
      ok: {
        label: "Send to Chat",
        callback: html => {
          const skill = html.find('[name="skill"]').val();
          const flavor = html.find('[name="flavor"]').val()?.trim() || "";
          const dv = parseInt(html.find('[name="dv"]').val()) || 0;

          const messageContent = `
            <div class="skill-test-prompt">
              <strong>Skill Test:</strong> ${skill}<br/>              
              <strong>DV:</strong> ${dv}<br/>
              <button class="skill-roll-button" 
                      data-skill="${skill}" 
                      
                      data-dv="${dv}">Roll</button>
            </div>
          `;

          ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker(),
            content: flavor ? messageContent + `<em>${flavor}</em>` : messageContent
          });
        }
      },
      cancel: {
        label: "Cancel"
      }
    },
    default: "ok"
  }).render(true);
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest(".skill-roll-button");
  if (!button) return;

  const skillName = button.dataset.skill;
  const dv = parseInt(button.dataset.dv);
  const modifier = 0; // modifier removed

  const actor = game.user.character;
  if (!actor) {
    ui.notifications.warn("Character for roll not found!");
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
      ui.notifications.error("CPRSkillRoll class not found.");
      return;
    }
    const rollInstance = new CPRSkillRoll(statKey, statValue, skillItem.name, skillValue + modifier);
    const dummyEvent = new Event("click");
    const proceed = await rollInstance.handleRollDialog(dummyEvent, actor, skillItem);
    if (!proceed) return;
    await rollInstance.roll();
    rollResult = rollInstance;
  } catch (e) {
    ui.notifications.error("Error importing CPRSkillRoll: " + e);
    return;
  }

  const finalTotal = rollResult?.resultTotal ?? 0;
  const success = finalTotal > dv;
  const resultText = success
    ? `<span style="color:green;">✔ SUCCESS</span>`
    : `<span style="color:red;">✘ FAILURE</span>`;

  const messageContent = `
    <div>
      Test <strong>${skillName}</strong> rolled by <em>${actor.name}</em><br/>
      Result: <strong>${finalTotal}</strong> vs DV <strong>${dv}</strong><br/>
      ${resultText}
    </div>
  `;

  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: flavor ? messageContent + `<em>${flavor}</em>` : messageContent
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
  if (window.GMTools && window.GMTools.tools) {
    gmTools.tools = window.GMTools.tools;
  }
});